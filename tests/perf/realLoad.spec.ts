/**
 * Real-network study load test. Run with `yarn test:perf-real`.
 *
 * Builds the app for production and loads the test-load-performance study
 * against the real Firebase project in .env (revisit-utah), as a new
 * participant and then as the same participant returning. Each load reads the
 * app's `revisit:*` performance marks (the same phases stored in participant
 * metadata) and counts Firebase requests. Results print as a table and are
 * written to test-results/perf-real/.
 *
 * Participants are created for real, under prod-test-load-performance, with
 * IDs starting `perf-` so they can be told apart.
 *
 * Environment:
 * - PERF_RUNS: loads per scenario (default 5).
 * - REVISIT_APPCHECK_DEBUG_TOKEN (required): a debug token registered for the
 *   web app in the Firebase console (App Check > Apps > Manage debug tokens).
 *   The reCAPTCHA key only accepts the deployed domains, so a local build
 *   cannot pass App Check without one.
 * - PERF_HEADED=1: open the browsers visibly.
 * - PERF_BROWSERS=chrome,webkit: also run WebKit, which takes the Safari
 *   long-polling path (default: chrome only; see playwright.perf.config.ts).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  expect, test, type Page, type Request,
} from '@playwright/test';

const STUDY = 'test-load-performance';
const RUNS = Number(process.env.PERF_RUNS) || 5;

// The phases the app marks, in order, as stored in ParticipantLoadTiming.
const PHASES = [
  'config-loaded',
  'storage-ready',
  'study-database-ready',
  'config-saved',
  'sequence-array-loaded',
  'participant-joined',
  'ready',
] as const;

// About 1.5x the medians measured in Chrome on 2026-11-27 (new participant
// 9.0s and 57 requests; returning 2.4s and 35 requests), so they catch a real
// regression without failing on ordinary network noise. Lower them as the
// load gets faster.
const CEILINGS = {
  'new participant': { readyMs: 13_500, firebaseRequests: 85 },
  'returning participant': { readyMs: 3_600, firebaseRequests: 52 },
} as const;
type Scenario = keyof typeof CEILINGS;

type LoadResult = {
  scenario: Scenario;
  run: number;
  documentLoadedMs: number;
  /** The app's `revisit:*` marks, when the build has them. */
  phases: Record<string, number>;
  /** When the first trial was on screen and usable, in ms since navigation. */
  readyMs: number;
  /** Requests to Firestore, Cloud Storage, and Firebase sign-in and App Check. */
  firebaseRequests: number;
  firestoreRequests: number;
  storageRequests: number;
  /** Response bytes from Firebase, for requests that finished during the load. */
  firebaseKb: number;
};

const FIREBASE_HOSTS = /(firestore|firebasestorage|identitytoolkit|securetoken|firebaseappcheck|content-firebaseappcheck)\.googleapis\.com/;

async function measureLoad(page: Page, scenario: Scenario, run: number, navigate: () => Promise<unknown>): Promise<LoadResult> {
  const requests: Request[] = [];
  let readyMs = 0;
  const bytes: Promise<number>[] = [];
  const onRequest = (request: Request) => {
    if (FIREBASE_HOSTS.test(request.url())) requests.push(request);
  };
  const onFinished = (request: Request) => {
    if (FIREBASE_HOSTS.test(request.url())) bytes.push(request.sizes().then((sizes) => sizes.responseBodySize).catch(() => 0));
  };
  page.on('request', onRequest);
  page.on('requestfinished', onFinished);
  try {
    await navigate();
    // Timed in the page on every frame, so it works for builds without the
    // app's marks (such as older branches) and does not include polling delay.
    const visible = await page.waitForFunction(() => {
      const shown = [...document.querySelectorAll('h1')].some((heading) => heading.textContent?.trim() === 'Load performance test');
      const ready = document.querySelector('[data-testid="study-interface"]')?.getAttribute('aria-busy') === 'false';
      return shown && ready ? Math.round(performance.now()) : false;
    }, undefined, { polling: 'raf', timeout: 120_000 });
    readyMs = await visible.jsonValue() as number;
    await expect(page.getByRole('heading', { name: 'Load performance test' })).toBeVisible();
  } finally {
    page.off('request', onRequest);
    page.off('requestfinished', onFinished);
  }

  const timing = await page.evaluate(() => {
    const marks = Object.fromEntries(performance.getEntriesByType('mark')
      .filter((mark) => mark.name.startsWith('revisit:'))
      .map((mark) => [mark.name.slice('revisit:'.length), Math.round(mark.startTime)]));
    const [navigation] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    return { marks, documentLoadedMs: Math.round(navigation?.domContentLoadedEventEnd ?? 0) };
  });
  const urls = requests.map((request) => request.url());
  return {
    scenario,
    run,
    documentLoadedMs: timing.documentLoadedMs,
    phases: timing.marks,
    readyMs,
    firebaseRequests: requests.length,
    firestoreRequests: urls.filter((url) => url.includes('firestore.googleapis.com')).length,
    storageRequests: urls.filter((url) => url.includes('firebasestorage.googleapis.com')).length,
    firebaseKb: Math.round((await Promise.all(bytes)).reduce((total, size) => total + size, 0) / 1024),
  };
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function formatTable(results: LoadResult[]) {
  const rows = (Object.keys(CEILINGS) as Scenario[]).map((scenario) => {
    const loads = results.filter((result) => result.scenario === scenario);
    const phaseMedians = PHASES.map((phase, index) => {
      const previous = index === 0 ? undefined : PHASES[index - 1];
      // Time spent in this phase: from the previous mark (or the document load) to this one.
      if (loads.some((load) => load.phases[phase] === undefined)) return '-';
      return median(loads.map((load) => load.phases[phase] - (previous ? load.phases[previous] : load.documentLoadedMs)));
    });
    return [
      scenario,
      `${median(loads.map((load) => load.readyMs))} (${Math.min(...loads.map((load) => load.readyMs))}-${Math.max(...loads.map((load) => load.readyMs))})`,
      median(loads.map((load) => load.documentLoadedMs)),
      ...phaseMedians,
      median(loads.map((load) => load.firebaseRequests)),
      median(loads.map((load) => load.firebaseKb)),
    ].join(' | ');
  });
  const header = ['scenario', 'first trial shown ms median (min-max)', 'document', ...PHASES, 'firebase requests', 'firebase KB'].join(' | ');
  return [header, ...rows].join('\n');
}

test('study load times on the real network', async ({ browser, browserName }, testInfo) => {
  const results: LoadResult[] = [];
  const token = process.env.REVISIT_APPCHECK_DEBUG_TOKEN;
  if (!token) {
    throw new Error('Set REVISIT_APPCHECK_DEBUG_TOKEN to an App Check debug token registered for the web app in the Firebase console (App Check > Apps > Manage debug tokens). Without one, a local build cannot pass App Check.');
  }
  // Loads run one after another, so they don't compete for the network.
  /* eslint-disable no-await-in-loop */
  for (let run = 1; run <= RUNS; run += 1) {
    // A fresh context has no local storage, so the first load is a new participant.
    const context = await browser.newContext();
    await context.addInitScript((debugToken) => {
      (globalThis as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
    }, token);
    const page = await context.newPage();
    const participantId = `perf-${testInfo.project.name}-${Date.now()}-${run}`;
    try {
      results.push(await measureLoad(page, 'new participant', run, () => page.goto(`/${STUDY}?PROLIFIC_PID=${participantId}`)));
      results.push(await measureLoad(page, 'returning participant', run, () => page.reload()));
    } finally {
      await context.close();
    }
  }
  /* eslint-enable no-await-in-loop */

  const table = formatTable(results);
  const outputDirectory = 'test-results/perf-real';
  mkdirSync(outputDirectory, { recursive: true });
  const outputFile = `${outputDirectory}/${testInfo.project.name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  writeFileSync(outputFile, `${JSON.stringify({
    browser: browserName, project: testInfo.project.name, runs: RUNS, results,
  }, null, 2)}\n`);
  await testInfo.attach('load times', { body: table, contentType: 'text/plain' });
  process.stdout.write(`\n${testInfo.project.name}, ${RUNS} runs (ms per phase, medians):\n${table}\nFull results: ${outputFile}\n\n`);

  (Object.keys(CEILINGS) as Scenario[]).forEach((scenario) => {
    const loads = results.filter((result) => result.scenario === scenario);
    const { readyMs, firebaseRequests } = CEILINGS[scenario];
    expect.soft(median(loads.map((load) => load.readyMs)), `${scenario} median ready time`).toBeLessThanOrEqual(readyMs);
    expect.soft(median(loads.map((load) => load.firebaseRequests)), `${scenario} median Firebase requests`).toBeLessThanOrEqual(firebaseRequests);
  });
});
