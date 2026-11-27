/**
 * Load-performance budgets for the Firebase storage engine.
 *
 * Each scenario replays the storage calls a participant's browser makes while a
 * study loads, against a simulated backend where every Firestore and Cloud
 * Storage call costs virtual network time (see utils/simulatedFirebase.ts).
 * The measured time is the critical path at a fixed round trip and bandwidth,
 * so it changes only when the code adds, removes, parallelizes or serializes
 * network calls, never because of the machine running the tests.
 *
 * A failing budget prints the scenario's call timeline. If the extra cost is
 * intended, raise the budget in the same PR so reviewers see it. If a change
 * makes a scenario cheaper, lower the budget so the gain cannot quietly erode.
 */
import {
  afterEach, beforeAll, beforeEach, describe, expect, test, vi,
} from 'vitest';
import {
  createFirestoreMock, createLocalforageMock, createStorageMock, drainBackgroundWork, formatCalls, resetSimulation,
  ROUND_TRIP_MS, runOnSimulatedNetwork, simulatedDigest, simulatedFetch, simulatedRunTransaction, simulation, switchBrowser, TRANSACTION_MAX_ATTEMPTS, transactionStats,
  type SimulatedRun,
} from './utils/simulatedFirebase';
import { FirebaseStorageEngine } from '../engines/FirebaseStorageEngine';
import { hash } from '../engines/utils/storageEngineHelpers';
import { generateSequenceArray } from '../../utils/handleRandomSequences';
import type { ParticipantMetadata, StudyConfig } from '../../parser/types';

vi.mock('firebase/firestore', () => createFirestoreMock());
vi.mock('firebase/storage', () => createStorageMock());
vi.mock('localforage', () => createLocalforageMock());
vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('@firebase/app-check', () => ({
  initializeAppCheck: vi.fn(),
  ReCaptchaV3Provider: vi.fn(),
  ReCaptchaEnterpriseProvider: vi.fn(),
}));
vi.mock('@firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: { email: null, uid: 'participant' },
    authStateReady: vi.fn(() => Promise.resolve()),
  })),
  onAuthStateChanged: vi.fn(() => vi.fn()),
  signInAnonymously: vi.fn(() => Promise.resolve()),
  signInWithPopup: vi.fn(() => Promise.resolve()),
  signOut: vi.fn(() => Promise.resolve()),
  GoogleAuthProvider: vi.fn(),
  browserPopupRedirectResolver: {},
}));

type Budget = {
  /** Virtual critical path, in milliseconds at ROUND_TRIP_MS per round trip and 10 Mbit/s. */
  ms: number;
  /** Network requests, including transaction reads and commits. */
  requests: number;
  /** Kilobytes downloaded. */
  downloadedKb: number;
};

type Transport = 'longPolling' | 'streaming';

// Safari and all iOS browsers use forced long-polling; other browsers stream.
const USER_AGENTS: Record<Transport, string> = {
  longPolling: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
  streaming: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

// Set to the measured values, so any added cost fails.
const BUDGETS: Record<string, Record<Transport, Budget>> = {
  'new participant': {
    longPolling: { ms: 4126, requests: 32, downloadedKb: 505 },
    streaming: { ms: 3226, requests: 32, downloadedKb: 505 },
  },
  'returning participant in the same browser': {
    longPolling: { ms: 1417, requests: 7, downloadedKb: 504 },
    streaming: { ms: 1117, requests: 7, downloadedKb: 504 },
  },
  'returning participant in a new browser': {
    longPolling: { ms: 1518, requests: 8, downloadedKb: 505 },
    streaming: { ms: 1218, requests: 8, downloadedKb: 505 },
  },
  'first participant after the config changes': {
    longPolling: { ms: 6540, requests: 52, downloadedKb: 6 },
    streaming: { ms: 5240, requests: 52, downloadedKb: 6 },
  },
  // Contended transactions back off with seeded jitter, as the SDK does, so
  // this budget depends on which retries collide and moves more than the others.
  'ten participants arriving at once': {
    longPolling: { ms: 11902, requests: 446, downloadedKb: 5070 },
    streaming: { ms: 11002, requests: 446, downloadedKb: 5070 },
  },
};

const studyId = 'load-performance';
const participantMetadata: ParticipantMetadata = {
  userAgent: 'load-performance',
  resolution: { width: 1920, height: 1080 },
  language: 'en-US',
  ip: '',
};

// A study shaped like a typical crowdsourced study: a latin-square block, a
// randomized block and 1000 prepared orders.
function makeConfig(version: string): StudyConfig {
  const trials = Array.from({ length: 24 }, (_, index) => `trial${index + 1}`);
  return {
    $schema: '',
    studyMetadata: {
      title: 'Load performance',
      version,
      authors: ['reVISit'],
      description: 'Fixture for load-performance budgets.',
      date: '2026-11-19',
      organizations: ['reVISit'],
    },
    uiConfig: {
      contactEmail: 'test@test.com',
      logoPath: '',
      withProgressBar: true,
      withSidebar: true,
      numSequences: 1000,
    },
    components: Object.fromEntries(['introduction', ...trials, 'survey'].map((name) => [name, { type: 'questionnaire', response: [] }])),
    sequence: {
      order: 'fixed',
      components: [
        'introduction',
        { order: 'latinSquare', components: trials.slice(0, 8) },
        { order: 'random', components: trials.slice(8) },
        'survey',
      ],
    },
  } as StudyConfig;
}

const config = makeConfig('1.0.0');

function newEngine(browser: string) {
  switchBrowser(browser);
  return new FirebaseStorageEngine(true);
}

/**
 * The storage calls Shell makes before a participant sees the study, in the
 * same order (see initializeUserStoreRouting in src/components/Shell.tsx).
 * Keep the two in step.
 */
async function loadStudy(engine: FirebaseStorageEngine, studyConfig: StudyConfig, urlParticipantId?: string) {
  await engine.initializeStudyDb(studyId);
  const activeHash = await hash(JSON.stringify(studyConfig));
  await engine.saveConfig(studyConfig);
  const sequenceArray = await engine.getOrCreateSequenceArray(activeHash, () => generateSequenceArray(studyConfig));
  const modes = await engine.getModes(studyId);
  const session = await engine.initializeParticipantSession({}, studyConfig, participantMetadata, urlParticipantId, {
    modesDocument: modes,
    sequenceArray,
  });
  if (session.participantConfigHash !== activeHash) {
    await engine.getAllConfigsFromHash([session.participantConfigHash], studyId);
  }
  if (modes.dataCollectionEnabled && !engine.isNewlyCreatedParticipant(session.participantId)) {
    await engine.getParticipantCompletionStatus(session.participantId);
  }
  return session;
}

async function connectedEngine(browser: string) {
  const engine = newEngine(browser);
  await engine.connect();
  return engine;
}

// A live study with a few participants already in it, prepared outside any
// measurement.
async function prepareLiveStudy(existingParticipants: number) {
  for (let index = 0; index < existingParticipants; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    await runOnSimulatedNetwork(async () => loadStudy(await connectedEngine(`existing-${index}`), config));
  }
  await drainBackgroundWork();
}

function summarize(run: SimulatedRun<unknown>): Budget {
  return {
    ms: run.elapsedMs,
    requests: run.calls.length,
    downloadedKb: Math.round(run.calls.filter((call) => !call.kind.endsWith('upload') && call.kind !== 'firestore.write')
      .reduce((total, call) => total + call.bytes, 0) / 1024),
  };
}

function expectWithinBudget(scenario: string, transport: Transport, run: SimulatedRun<unknown>) {
  const measured = summarize(run);
  const budget = BUDGETS[scenario]?.[transport];
  const report = [
    `${scenario} (${transport}): ${measured.ms}ms (${(measured.ms / ROUND_TRIP_MS).toFixed(1)} round trips), ${measured.requests} requests, ${measured.downloadedKb} KB downloaded`,
    `budget: ${budget ? JSON.stringify(budget) : 'none'}`,
    'calls:',
    formatCalls(run.calls, run.startedAt),
  ].join('\n');
  expect(budget, `No budget for this scenario. Measured ${JSON.stringify(measured)}\n${report}`).toBeDefined();
  expect(measured.ms, report).toBeLessThanOrEqual(budget!.ms);
  expect(measured.requests, report).toBeLessThanOrEqual(budget!.requests);
  expect(measured.downloadedKb, report).toBeLessThanOrEqual(budget!.downloadedKb);
}

beforeAll(() => {
  vi.stubEnv('VITE_FIREBASE_CONFIG', JSON.stringify({ projectId: 'load-performance' }));
  vi.stubEnv('VITE_RECAPTCHAV3TOKEN', 'fake-recaptcha-token');
});

beforeEach(() => {
  resetSimulation();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
  vi.spyOn(globalThis.crypto.subtle, 'digest').mockImplementation(simulatedDigest);
  vi.spyOn(globalThis, 'fetch').mockImplementation((url) => simulatedFetch(url.toString()) as unknown as Promise<Response>);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe.each(['longPolling', 'streaming'] as const)('study load budgets (%s)', (transport) => {
  beforeEach(() => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(USER_AGENTS[transport]);
  });

  test('new participant', async () => {
    await prepareLiveStudy(3);
    const engine = await connectedEngine('newcomer');
    expectWithinBudget('new participant', transport, await runOnSimulatedNetwork(() => loadStudy(engine, config)));
  });

  test('returning participant in the same browser', async () => {
    await prepareLiveStudy(3);
    const first = await connectedEngine('returning');
    const { result: session } = await runOnSimulatedNetwork(() => loadStudy(first, config));
    await drainBackgroundWork();
    // A reload constructs a new engine over the same local storage.
    const reloaded = await connectedEngine('returning');
    const run = await runOnSimulatedNetwork(() => loadStudy(reloaded, config));
    expect(run.result.participantId).toBe(session.participantId);
    expectWithinBudget('returning participant in the same browser', transport, run);
  });

  test('returning participant in a new browser', async () => {
    await prepareLiveStudy(3);
    const first = await connectedEngine('first-device');
    await runOnSimulatedNetwork(() => loadStudy(first, config, 'PROLIFIC-1'));
    await drainBackgroundWork();
    const second = await connectedEngine('second-device');
    const run = await runOnSimulatedNetwork(() => loadStudy(second, config, 'PROLIFIC-1'));
    expect(run.result.participantId).toBe('PROLIFIC-1');
    expectWithinBudget('returning participant in a new browser', transport, run);
  });

  test('first participant after the config changes', async () => {
    await prepareLiveStudy(3);
    const engine = await connectedEngine('after-change');
    const run = await runOnSimulatedNetwork(() => loadStudy(engine, makeConfig('1.0.1')));
    expectWithinBudget('first participant after the config changes', transport, run);
  });

  test('ten participants arriving at once', async () => {
    await prepareLiveStudy(3);
    const engines = await Promise.all(Array.from({ length: 10 }, (_, index) => connectedEngine(`burst-${index}`)));
    const run = await runOnSimulatedNetwork(() => Promise.all(engines.map((engine) => loadStudy(engine, config))));
    expect(new Set(run.result.map((session) => session.participantId)).size).toBe(10);
    // A transaction can exhaust the SDK's attempts in a burst; the allocation
    // retries it, so every participant still joins (checked above).
    // The slowest participant's wait, and the requests all of them made.
    expectWithinBudget('ten participants arriving at once', transport, run);
  });

  test('the simulation is deterministic', async () => {
    const measure = async () => {
      resetSimulation();
      await prepareLiveStudy(1);
      const engine = await connectedEngine('determinism');
      return summarize(await runOnSimulatedNetwork(() => loadStudy(engine, config)));
    };
    expect(await measure()).toEqual(await measure());
  });

  test('sequential reads add up and parallel reads overlap', async () => {
    // Guards the cost model itself.
    const engine = await connectedEngine('model');
    await engine.initializeStudyDb(studyId);
    // The first read also creates the default settings.
    await runOnSimulatedNetwork(() => engine.getModes(studyId));
    const one = await runOnSimulatedNetwork(() => engine.getModes(studyId));
    const three = await runOnSimulatedNetwork(async () => {
      await engine.getModes(studyId);
      await engine.getModes(studyId);
      await engine.getModes(studyId);
    });
    const parallel = await runOnSimulatedNetwork(() => Promise.all([engine.getModes(studyId), engine.getModes(studyId), engine.getModes(studyId)]));
    expect(one.elapsedMs).toBe((transport === 'longPolling' ? 2 : 1) * ROUND_TRIP_MS + 1);
    expect(three.elapsedMs).toBe(3 * one.elapsedMs);
    expect(parallel.elapsedMs).toBe(one.elapsedMs);
    expect(parallel.calls).toHaveLength(3);
    expect(simulation.calls.length).toBeGreaterThan(0);
  });
});

test('contended transactions give up after the SDK attempt limit', async () => {
  // Guards the retry model: a document that changes during every attempt.
  const ref = { _path: 'contended/document', _longPolling: false };
  simulation.firestoreData[ref._path] = { version: 0 };
  let attempts = 0;
  const run = runOnSimulatedNetwork(() => simulatedRunTransaction(undefined, async (transaction) => {
    attempts += 1;
    await transaction.get(ref as never);
    simulation.firestoreData[ref._path] = { version: attempts };
  }));
  await expect(run).rejects.toMatchObject({ name: 'FirebaseError', code: 'aborted' });
  expect(attempts).toBe(TRANSACTION_MAX_ATTEMPTS);
  expect(transactionStats).toMatchObject({ retries: TRANSACTION_MAX_ATTEMPTS - 1, aborted: 1, maxAttempts: TRANSACTION_MAX_ATTEMPTS });
  // Each retry waited for its backoff, about 1s, 1.5s, 2.25s and 3.4s.
  const commits = simulation.calls.filter((call) => call.kind === 'transaction.commit');
  const gaps = commits.slice(1).map((call, index) => call.start - commits[index].end);
  gaps.forEach((gap) => expect(gap).toBeGreaterThan(0));
  expect(commits.at(-1)!.end - commits[0].start).toBeGreaterThan(0.5 * (1000 + 1500 + 2250 + 3375));
});
