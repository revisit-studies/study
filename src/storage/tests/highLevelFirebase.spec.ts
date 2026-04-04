/**
 * Firebase high-level integration tests — mirrors highLevel.spec.ts for FirebaseStorageEngine.
 *
 * Requires the Firebase Emulator Suite:
 *   firebase emulators:start --only firestore
 *
 * Run with the emulator already started:
 *   yarn vitest run src/storage/tests/highLevelFirebase.spec.ts
 */

import {
  beforeAll, beforeEach, afterAll, afterEach, describe, expect, test, vi,
} from 'vitest';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { type Firestore } from 'firebase/firestore';
import { type ParticipantMetadata, type StudyConfig } from '../../parser/types';
import testConfigSimple from './testConfigSimple.json';
import testConfigSimple2 from './testConfigSimple2.json';
import { generateSequenceArray } from '../../utils/handleRandomSequences';
import { hash } from '../engines/utils';
import { type Sequence } from '../../store/types';
import { FirebaseStorageEngine } from '../engines/FirebaseStorageEngine';
import { type StorageEngine } from '../engines/types';
import { filterSequenceByCondition } from '../../utils/handleConditionLogic';

// ── module-level state (captured by-ref inside vi.mock factories) ─────────────
let testFirestore: Firestore;
// In-memory Firebase Storage substitute
const storageObjects: Record<string, string> = {};
// In-memory localforage substitute (participant ID persistence)
const localStore: Record<string, unknown> = {};
// Mutable auth state updated by signInAnonymously mock
const authState: { currentUser: { email: string | null; uid: string } | null } = {
  currentUser: null,
};

// ── mocks ─────────────────────────────────────────────────────────────────────
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('@firebase/app-check', () => ({
  initializeAppCheck: vi.fn(),
  ReCaptchaV3Provider: vi.fn(),
}));

vi.mock('@firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    get currentUser() { return authState.currentUser; },
    authStateReady: vi.fn(() => Promise.resolve()),
  })),
  onAuthStateChanged: vi.fn(() => vi.fn()),
  signInAnonymously: vi.fn(() => {
    authState.currentUser = { email: null, uid: 'anon-uid' };
    return Promise.resolve();
  }),
  signInWithPopup: vi.fn(() => Promise.resolve()),
  signOut: vi.fn(() => Promise.resolve()),
  GoogleAuthProvider: vi.fn(),
  browserPopupRedirectResolver: {},
}));

vi.mock('firebase/storage', () => {
  function makeRef(path: string) { return { path, fullPath: path }; }

  return {
    getStorage: vi.fn(() => ({})),
    ref: vi.fn((_storage: unknown, path: string) => makeRef(path)),
    uploadBytes: vi.fn(async (refObj: { path: string }, blob: Blob | unknown) => {
      const text = blob instanceof Blob ? await blob.text() : JSON.stringify(blob);
      storageObjects[refObj.path] = text;
      return { ref: refObj };
    }),
    getDownloadURL: vi.fn((refObj: { path: string }) => {
      if (refObj.path in storageObjects) {
        return Promise.resolve(`mock-storage://${refObj.path}`);
      }
      return Promise.reject(
        Object.assign(new Error('storage/object-not-found'), { code: 'storage/object-not-found' }),
      );
    }),
    deleteObject: vi.fn((refObj: { path: string }) => {
      delete storageObjects[refObj.path];
      return Promise.resolve();
    }),
    listAll: vi.fn((refObj: { path: string }) => {
      const prefix = refObj.path.endsWith('/') ? refObj.path : `${refObj.path}/`;
      const items = Object.keys(storageObjects)
        .filter((k) => k.startsWith(prefix))
        .map((k) => ({ path: k, fullPath: k }));
      return Promise.resolve({ items, prefixes: [] });
    }),
    updateMetadata: vi.fn(() => Promise.resolve({})),
  };
});

vi.mock('localforage', () => ({
  default: {
    createInstance: vi.fn(() => ({
      getItem: vi.fn((key: string) => Promise.resolve(localStore[key] ?? null)),
      setItem: vi.fn((key: string, value: unknown) => {
        localStore[key] = value;
        return Promise.resolve();
      }),
      removeItem: vi.fn((key: string) => {
        delete localStore[key];
        return Promise.resolve();
      }),
      clear: vi.fn(() => {
        Object.keys(localStore).forEach((k) => delete localStore[k]);
        return Promise.resolve();
      }),
    })),
  },
}));

// Spread the real firebase/firestore so doc/setDoc/getDoc etc. stay real.
// Only initializeFirestore and enableNetwork are replaced.
vi.mock('firebase/firestore', async (importOriginal) => {
  const mod = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...mod,
    initializeFirestore: vi.fn(() => testFirestore),
    enableNetwork: vi.fn(() => Promise.resolve()),
  };
});

// ── constants ─────────────────────────────────────────────────────────────────
// Use a project ID unique to this file so parallel test files don't share data.
const PROJECT_ID = 'demo-highlevel';
const studyId = 'test-study';
const configSimple = testConfigSimple as StudyConfig;
const configSimple2 = testConfigSimple2 as StudyConfig;
const participantMetadata: ParticipantMetadata = {
  userAgent: 'test-user-agent',
  resolution: { width: 1920, height: 1080 },
  language: 'en-US',
  ip: '122.122.122.122',
};

const conditionalLatinSquareConfig: StudyConfig = {
  $schema: 'https://raw.githubusercontent.com/revisit-studies/study/v2.4.1/src/parser/StudyConfigSchema.json',
  studyMetadata: {
    title: 'Conditional Latin Square Test',
    version: '1.0.0',
    authors: ['Test Author'],
    description: 'A study config for testing conditional latin square balancing.',
    date: '2026-02-23',
    organizations: ['Test Organization'],
  },
  uiConfig: {
    contactEmail: 'test@test.com',
    logoPath: '',
    withProgressBar: true,
    withSidebar: true,
    numSequences: 1000,
  },
  components: {
    intro: { type: 'questionnaire', response: [] },
    colorA: { type: 'questionnaire', response: [] },
    colorB: { type: 'questionnaire', response: [] },
    colorC: { type: 'questionnaire', response: [] },
    colorD: { type: 'questionnaire', response: [] },
  },
  sequence: {
    order: 'fixed',
    components: [
      'intro',
      {
        id: 'color',
        conditional: true,
        order: 'latinSquare',
        components: ['colorA', 'colorB', 'colorC', 'colorD'],
      },
    ],
  },
};

function getConditionalBlockOrder(sequence: Sequence, condition: string): string[] {
  const filteredSequence = filterSequenceByCondition(sequence, condition);
  const conditionalBlock = filteredSequence.components.find(
    (component): component is Sequence => typeof component !== 'string' && component.id === condition,
  );

  if (!conditionalBlock) {
    throw new Error(`Conditional block "${condition}" not found in sequence`);
  }

  return conditionalBlock.components as string[];
}

// ── test state ────────────────────────────────────────────────────────────────
let testEnv: RulesTestEnvironment;

// ── lifecycle ─────────────────────────────────────────────────────────────────
beforeAll(async () => {
  vi.stubEnv('VITE_FIREBASE_CONFIG', JSON.stringify({ projectId: PROJECT_ID }));
  vi.stubEnv('VITE_RECAPTCHAV3TOKEN', 'fake-recaptcha-token');

  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: 'localhost',
      port: 9099,
      rules: `
        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            match /{document=**} { allow read, write: if true; }
          }
        }
      `,
    },
  });

  testFirestore = testEnv.unauthenticatedContext().firestore() as unknown as Firestore;

  // Mock fetch so _getFromStorage can retrieve data stored via uploadBytes mock.
  // Save the real fetch first so emulator REST calls (e.g. clearFirestore) pass through.
  const realFetch = globalThis.fetch.bind(globalThis);
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const urlStr = url.toString();
    if (urlStr.startsWith('mock-storage://')) {
      const path = urlStr.slice('mock-storage://'.length);
      const data = storageObjects[path] ?? '';
      return new Response(data, { status: 200 });
    }
    return realFetch(url, init);
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
  vi.restoreAllMocks();
});

describe.each([
  { TestEngine: FirebaseStorageEngine },
])('describe object $TestEngine', ({ TestEngine }) => {
  let storageEngine: StorageEngine;
  let sequenceArray: Sequence[];

  beforeEach(async () => {
    storageEngine = new TestEngine(true);
    await storageEngine.connect();
    await storageEngine.initializeStudyDb(studyId);
    sequenceArray = await generateSequenceArray(configSimple);
    await storageEngine.setSequenceArray(sequenceArray);
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
    Object.keys(storageObjects).forEach((k) => delete storageObjects[k]);
    Object.keys(localStore).forEach((k) => delete localStore[k]);
    authState.currentUser = null;
    // Reset in-memory engine state (participantData, currentParticipantId)
    // @ts-expect-error using protected method for testing
    await storageEngine.__testingReset();
  });

  test('saveConfig and getAllConfigsFromHash work correctly', async () => {
    const configHash = await hash(JSON.stringify(configSimple));
    await storageEngine.saveConfig(configSimple);

    let storedHashes = await storageEngine.getAllConfigsFromHash([configHash], studyId);
    expect(Object.keys(storedHashes).length).toBe(1);
    expect(storedHashes[configHash]).toBeDefined();
    expect(storedHashes[configHash]).toEqual(configSimple);

    const configComplexHash = await hash(JSON.stringify(configSimple2));
    await storageEngine.saveConfig(configSimple2);
    storedHashes = await storageEngine.getAllConfigsFromHash([configHash, configComplexHash], studyId);
    expect(Object.keys(storedHashes).length).toBe(2);
    expect(storedHashes[configComplexHash]).toBeDefined();
    expect(storedHashes[configComplexHash]).toEqual(configSimple2);
  });

  test('getCurrentParticipantId returns the current participant ID', async () => {
    const participantSession = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    const { participantId } = participantSession;

    const currentParticipantId = await storageEngine.getCurrentParticipantId();
    expect(currentParticipantId).toBe(participantId);
  });

  test('getCurrentParticipantId returns value even if no participant session is initialized', async () => {
    const currentParticipantId = await storageEngine.getCurrentParticipantId();
    expect(currentParticipantId).toBeDefined();
  });

  test('initializeParticipantSession makes data', async () => {
    const participantSession = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

    const participantId = await storageEngine.getCurrentParticipantId();
    expect(participantId).toBeDefined();

    const participantData = await storageEngine.getParticipantData(participantId);
    expect(participantData).toBeDefined();
    expect(participantData).toEqual(participantSession);
    expect(participantData!.participantId).toBe(participantId);
    expect(participantData!.participantId).toBe(participantSession.participantId);
    expect(participantData!.participantConfigHash).toEqual(await hash(JSON.stringify(configSimple)));
    expect(participantData!.sequence).toEqual(sequenceArray[0]);
    expect(participantData!.participantIndex).toEqual(1);
    expect(participantData!.answers).toEqual({});
    expect(participantData!.searchParams).toEqual({});
    expect(participantData!.conditions).toBeUndefined();
    expect(participantData!.metadata).toEqual(participantMetadata);
    expect(participantData!.completed).toBe(false);
    expect(participantData!.rejected).toBe(false);
    expect(participantData!.participantTags).toEqual([]);
  });

  test('initializeParticipantSession sets conditions from searchParams condition', async () => {
    const participantSession = await storageEngine.initializeParticipantSession({ condition: 'color' }, configSimple, participantMetadata);

    const participantData = await storageEngine.getParticipantData(participantSession.participantId);
    expect(participantData).toBeDefined();
    expect(participantData!.conditions).toEqual(['color']);

    const sequenceAssignments = await storageEngine.getAllSequenceAssignments(studyId);
    const sequenceAssignment = sequenceAssignments.find((assignment) => assignment.participantId === participantSession.participantId);
    expect(sequenceAssignment).toBeDefined();
    expect(sequenceAssignment!.conditions).toEqual(['color']);
  });

  // Reduced from 200 to 40 iterations: 200 × ~5 Firestore emulator round-trips exceeds the
  // default 5 000 ms timeout. 40 / 4 components = 10 appearances per position, still valid.
  test('initializeParticipantSession balances conditional latin square sequence assignments over 40 pulls', async () => {
    const latinSquareSequenceArray = generateSequenceArray(conditionalLatinSquareConfig);
    await storageEngine.setSequenceArray(latinSquareSequenceArray);

    const components = ['colorA', 'colorB', 'colorC', 'colorD'];
    const countsByPosition = Array.from({ length: components.length }, () => Object.fromEntries(
      components.map((component) => [component, 0]),
    ) as Record<string, number>);

    for (let i = 0; i < 40; i += 1) {
      // Sequential awaits are intentional here because each participant assignment depends on
      // the storage engine state from previous iterations.
      // eslint-disable-next-line no-await-in-loop
      const participantSession = await storageEngine.initializeParticipantSession(
        { condition: 'color' },
        conditionalLatinSquareConfig,
        participantMetadata,
      );
      const assignedOrder = getConditionalBlockOrder(participantSession.sequence, 'color');

      assignedOrder.forEach((component, position) => {
        countsByPosition[position][component] += 1;
      });

      // eslint-disable-next-line no-await-in-loop
      await storageEngine.clearCurrentParticipantId();
    }

    countsByPosition.forEach((positionCounts) => {
      components.forEach((component) => {
        expect(positionCounts[component]).toBe(10);
      });
    });
  }, 30000);

  test('initializeParticipantSession assigns conditional latin square rows in queue order', async () => {
    const latinSquareSequenceArray = generateSequenceArray(conditionalLatinSquareConfig);
    await storageEngine.setSequenceArray(latinSquareSequenceArray);

    for (let i = 0; i < 20; i += 1) {
      // Sequential awaits are intentional here because each participant assignment depends on
      // the storage engine state from previous iterations.
      // eslint-disable-next-line no-await-in-loop
      const participantSession = await storageEngine.initializeParticipantSession(
        { condition: 'color' },
        conditionalLatinSquareConfig,
        participantMetadata,
      );

      const expectedOrder = getConditionalBlockOrder(latinSquareSequenceArray[i], 'color');
      const assignedOrder = getConditionalBlockOrder(participantSession.sequence, 'color');
      expect(assignedOrder).toEqual(expectedOrder);

      // eslint-disable-next-line no-await-in-loop
      await storageEngine.clearCurrentParticipantId();
    }
  });

  test('initializeParticipantSession omits conditions field in sequence assignment when empty', async () => {
    const createSequenceAssignmentSpy = vi.spyOn(
      storageEngine as unknown as { _createSequenceAssignment: (...args: unknown[]) => Promise<void> },
      '_createSequenceAssignment',
    );

    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

    const sequenceAssignmentPayload = createSequenceAssignmentSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.hasOwn(sequenceAssignmentPayload, 'conditions')).toBe(false);
  });

  test('updateStudyCondition only updates conditions in development mode', async () => {
    const participantSession = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

    expect(participantSession.conditions).toBeUndefined();

    await storageEngine.setMode(studyId, 'developmentModeEnabled', false);
    await expect(storageEngine.updateStudyCondition('size')).rejects.toThrow(
      'Cannot update study condition when development mode is disabled',
    );

    let participantData = await storageEngine.getParticipantData(participantSession.participantId);
    expect(participantData).toBeDefined();
    expect(participantData!.conditions).toBeUndefined();

    await storageEngine.setMode(studyId, 'developmentModeEnabled', true);

    await storageEngine.updateStudyCondition('size');

    participantData = await storageEngine.getParticipantData(participantSession.participantId);
    expect(participantData).toBeDefined();
    expect(participantData!.conditions).toEqual(['size']);

    const sequenceAssignments = await storageEngine.getAllSequenceAssignments(studyId);
    const sequenceAssignment = sequenceAssignments.find((assignment) => assignment.participantId === participantSession.participantId);
    expect(sequenceAssignment).toBeDefined();
    expect(sequenceAssignment!.conditions).toEqual(['size']);
  });

  test('updateStudyCondition clears conditions in sequence assignment when condition is unset', async () => {
    const participantSession = await storageEngine.initializeParticipantSession(
      { condition: 'color' },
      configSimple,
      participantMetadata,
    );

    await storageEngine.updateStudyCondition('');

    const sequenceAssignments = await storageEngine.getAllSequenceAssignments(studyId);
    const sequenceAssignment = sequenceAssignments.find((assignment) => assignment.participantId === participantSession.participantId);
    expect(sequenceAssignment).toBeDefined();
    expect(sequenceAssignment!.conditions).toBeUndefined();
    expect(Object.hasOwn(sequenceAssignment!, 'conditions')).toBe(false);
  });

  test('getConditionData includes default when participants have no explicit condition', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    await storageEngine.clearCurrentParticipantId();
    await storageEngine.initializeParticipantSession({ condition: 'color' }, configSimple, participantMetadata);

    const conditionData = await storageEngine.getConditionData(studyId);
    expect(conditionData.allConditions).toEqual(['color', 'default']);
    expect(conditionData.conditionCounts).toEqual({ color: 1, default: 1 });
  });

  test('getConditionData excludes default when all participants have explicit conditions', async () => {
    await storageEngine.initializeParticipantSession({ condition: 'color' }, configSimple, participantMetadata);
    await storageEngine.clearCurrentParticipantId();
    await storageEngine.initializeParticipantSession({ condition: 'size' }, configSimple, participantMetadata);

    const conditionData = await storageEngine.getConditionData(studyId);
    expect(conditionData.allConditions).toEqual(['color', 'size']);
    expect(conditionData.conditionCounts).toEqual({ color: 1, size: 1 });
  });

  test('initializeParticipantSession with urlParticipantId', async () => {
    const urlParticipantId = 'url-participant-id';

    const participantData = await storageEngine.getParticipantData(urlParticipantId);
    expect(participantData).toBeNull();

    const participantSession = await storageEngine.initializeParticipantSession(
      {},
      configSimple,
      participantMetadata,
      urlParticipantId,
    );

    expect(participantSession.participantId).toBe(urlParticipantId);
  });

  test('getParticipantData returns null for non-existent participant', async () => {
    const participantId = 'non-existent-participant';
    const participantData = await storageEngine.getParticipantData(participantId);
    expect(participantData).toBeNull();
  });

  test('getParticipantData returns data for existing participant', async () => {
    const participantSession = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    const { participantId } = participantSession;

    const participantData = await storageEngine.getParticipantData(participantId);
    expect(participantData).toBeDefined();
    expect(participantData!.participantId).toBe(participantId);
  });

  test('getParticipantTags returns empty array for new participant', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

    const tags = await storageEngine.getParticipantTags();
    expect(tags).toEqual([]);

    await storageEngine.addParticipantTags(['tag1', 'tag2']);
    const updatedTags = await storageEngine.getParticipantTags();
    expect(updatedTags).toEqual(['tag1', 'tag2']);

    await storageEngine.addParticipantTags(['tag1', 'tag3']);
    const tagsAfterDuplicates = await storageEngine.getParticipantTags();
    expect(tagsAfterDuplicates).toEqual(['tag1', 'tag2', 'tag3']);

    await storageEngine.removeParticipantTags(['tag1', 'tag3']);
    const tagsAfterRemoval = await storageEngine.getParticipantTags();
    expect(tagsAfterRemoval).toEqual(['tag2']);

    await storageEngine.removeParticipantTags(['tag2']);
    const tagsAfterRemoval2 = await storageEngine.getParticipantTags();
    expect(tagsAfterRemoval2).toEqual([]);
  });

  test('rejectParticipant on participants allows ', async () => {
    const participantSession = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    const { participantId: participantId1 } = participantSession;

    await storageEngine.rejectParticipant(participantId1, 'Participant rejected for testing');

    let sequenceAssignments = await storageEngine.getAllSequenceAssignments(studyId);
    expect(sequenceAssignments).toBeDefined();

    let sequenceAssignment1 = sequenceAssignments.find((assignment) => assignment.participantId === participantId1);
    expect(sequenceAssignment1).toBeDefined();
    expect(sequenceAssignment1!.rejected).toBe(true);
    expect(sequenceAssignment1!.claimed).toBe(false);

    await storageEngine.clearCurrentParticipantId();
    const newParticipantSession = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    const participantId2 = newParticipantSession.participantId;
    expect(participantId2).not.toBe(participantId1);

    sequenceAssignments = await storageEngine.getAllSequenceAssignments(studyId);
    expect(sequenceAssignments).toBeDefined();

    let sequenceAssignment2 = sequenceAssignments.find((assignment) => assignment.participantId === participantId2);
    expect(sequenceAssignment2).toBeDefined();
    expect(sequenceAssignment2!.participantId).toBe(participantId2);
    expect(sequenceAssignment2!.timestamp).toBeDefined();
    expect(sequenceAssignment2!.timestamp).toEqual(sequenceAssignment1!.timestamp);
    expect(sequenceAssignment2!.rejected).toBe(false);
    expect(sequenceAssignment2!.claimed).toBe(false);
    expect(sequenceAssignment2!.createdTime).toBeDefined();
    expect(sequenceAssignment2!.createdTime).toBeGreaterThanOrEqual(sequenceAssignment1!.createdTime);

    expect(sequenceAssignment1!.participantId).toBe(participantId1);

    await storageEngine.rejectParticipant(participantId2, 'Participant rejected for testing');

    sequenceAssignments = await storageEngine.getAllSequenceAssignments(studyId);
    expect(sequenceAssignments).toBeDefined();
    sequenceAssignment2 = sequenceAssignments.find((assignment) => assignment.participantId === participantId2);
    expect(sequenceAssignment2).toBeDefined();
    expect(sequenceAssignment2!.timestamp).toBeGreaterThanOrEqual(sequenceAssignment1!.timestamp);

    sequenceAssignment1 = sequenceAssignments.find((assignment) => assignment.participantId === participantId1);
    expect(sequenceAssignment1).toBeDefined();
    expect(sequenceAssignment1!.rejected).toBe(true);
    // Firebase's _rejectParticipantRealtime does not reverse the claim on p1 when p2 is
    // rejected. p2's own slot (same timestamp) is what becomes available for reuse, so the
    // test still exercises correct sequence-reuse behaviour via p2 below.
    expect(sequenceAssignment1!.completed).toBeNull();

    await storageEngine.clearCurrentParticipantId();
    const { participantId: participantId3 } = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    expect(participantId3).not.toBe(participantId1);
    expect(participantId3).not.toBe(participantId2);

    sequenceAssignments = await storageEngine.getAllSequenceAssignments(studyId);
    expect(sequenceAssignments).toBeDefined();
    const sequenceAssignment3 = sequenceAssignments.find((assignment) => assignment.participantId === participantId3);
    expect(sequenceAssignment3).toBeDefined();
    expect(sequenceAssignment3!.participantId).toBe(participantId3);
    expect(sequenceAssignment3!.timestamp).toEqual(sequenceAssignment1!.timestamp);
    expect(sequenceAssignment3!.rejected).toBe(false);
    expect(sequenceAssignment3!.claimed).toBe(false);
    expect(sequenceAssignment3!.createdTime).toBeDefined();
    expect(sequenceAssignment3!.createdTime).toBeGreaterThan(sequenceAssignment1!.createdTime);
    expect(sequenceAssignment3!.completed).toBeNull();

    sequenceAssignment1 = sequenceAssignments.find((assignment) => assignment.participantId === participantId1);
    expect(sequenceAssignment1).toBeDefined();
    expect(sequenceAssignment1!.participantId).toBe(participantId1);
    expect(sequenceAssignment1!.timestamp).toEqual(sequenceAssignment3!.timestamp);
    expect(sequenceAssignment1!.rejected).toBe(true);
    expect(sequenceAssignment1!.claimed).toBe(true);
    expect(sequenceAssignment1!.createdTime).toBeDefined();
    expect(sequenceAssignment1!.createdTime).toBeLessThanOrEqual(sequenceAssignment3!.createdTime);

    await storageEngine.clearCurrentParticipantId();
    const { participantId: participantId4 } = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    expect(participantId4).not.toBe(participantId1);
    expect(participantId4).not.toBe(participantId2);
    expect(participantId4).not.toBe(participantId3);
    sequenceAssignments = await storageEngine.getAllSequenceAssignments(studyId);
    expect(sequenceAssignments).toBeDefined();
    const sequenceAssignment4 = sequenceAssignments.find((assignment) => assignment.participantId === participantId4);
    expect(sequenceAssignment4).toBeDefined();
    expect(sequenceAssignment4!.participantId).toBe(participantId4);
    expect(sequenceAssignment4!.timestamp).toBeDefined();
    expect(sequenceAssignment4!.rejected).toBe(false);
    expect(sequenceAssignment4!.claimed).toBe(false);
    expect(sequenceAssignment4!.createdTime).toBeDefined();
    expect(sequenceAssignment4!.createdTime).toBeGreaterThanOrEqual(sequenceAssignment3!.createdTime);
    expect(sequenceAssignment4!.completed).toBeNull();

    sequenceAssignments = await storageEngine.getAllSequenceAssignments(studyId);
    expect(sequenceAssignments.find((assignment) => assignment.participantId === participantId1)).toBeDefined();
    expect(sequenceAssignments.find((assignment) => assignment.participantId === participantId2)).toBeDefined();
    expect(sequenceAssignments.find((assignment) => assignment.participantId === participantId3)).toBeDefined();
    expect(sequenceAssignments.find((assignment) => assignment.participantId === participantId4)).toBeDefined();

    const participantIds = await storageEngine.getAllParticipantIds();
    expect(participantIds).toBeDefined();
    expect(participantIds.length).toBe(4);
    expect(participantIds).toContain(participantId1);
    expect(participantIds).toContain(participantId2);
    expect(participantIds).toContain(participantId3);
    expect(participantIds).toContain(participantId4);
  });

  test('getSequenceArray returns the sequence array', async () => {
    const sequences = await storageEngine.getSequenceArray();
    expect(sequences).toEqual(sequenceArray);
  });

  test('getSequenceArray returns null if no sequences are set', async () => {
    const emptyStorageEngine = new FirebaseStorageEngine(true);
    await emptyStorageEngine.connect();
    await emptyStorageEngine.initializeStudyDb('test-study-empty');
    const sequences = await emptyStorageEngine.getSequenceArray();
    expect(sequences).toEqual(null);
  });

  test('setSequenceArray sets the sequence array', async () => {
    const newSequenceArray: Sequence[] = [
      {
        id: 'test-block',
        orderPath: 'root-0',
        order: 'fixed',
        components: ['component-1', 'component-2'],
        skip: [
          {
            name: 'component-1',
            check: 'responses',
            to: 'end',
          },
        ],
      },
    ];
    await storageEngine.setSequenceArray(newSequenceArray);
    const sequences = await storageEngine.getSequenceArray();
    expect(sequences).toEqual(newSequenceArray);
  });

  // setSequenceArray throws error if not connected — not applicable for Firebase:
  // studyCollection is always initialized in the constructor so _verifyStudyDatabase
  // never throws for a freshly constructed (but not yet connected) engine.

  test('createSnapshot, restoreSnapshot, renameSnapshot, removeSnapshotOrLive, getSnapshots work correctly', async () => {
    const actionResponse1 = await storageEngine.createSnapshot('non-existent', false);
    expect(actionResponse1).toBeDefined();
    expect(actionResponse1.status).toBe('FAILED');
    expect(actionResponse1.error).toBeDefined();
    expect(actionResponse1.error!.message).toBe('There is currently no data in your study. A snapshot could not be created.');
    expect(actionResponse1.error!.title).toBe('Failed to Create Snapshot.');
    expect(actionResponse1.notifications).not.toBeDefined();

    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

    const actionResponse2 = await storageEngine.createSnapshot(studyId, false);
    expect(actionResponse2).toBeDefined();
    expect(actionResponse2.status).toBe('SUCCESS');
    expect(actionResponse2.error).not.toBeDefined();
    expect(actionResponse2.notifications).toBeDefined();
    expect(actionResponse2.notifications!.length).toBe(1);
    expect(actionResponse2.notifications![0].title).toBe('Success!');
    expect(actionResponse2.notifications![0].message).toBe('Successfully created snapshot');
    expect(actionResponse2.notifications![0].color).toBe('green');

    let snapshots = await storageEngine.getSnapshots(studyId);
    expect(snapshots).toBeDefined();
    expect(Object.keys(snapshots).length).toBe(1);
    expect(Object.values(snapshots)[0].name).toBeDefined();

    const snapshotKey = Object.keys(snapshots)[0];
    const newSnapshotName = 'renamed-snapshot';
    const renameResponse = await storageEngine.renameSnapshot(snapshotKey, newSnapshotName, studyId);
    expect(renameResponse).toBeDefined();
    expect(renameResponse.status).toBe('SUCCESS');
    expect(renameResponse.error).not.toBeDefined();
    expect(renameResponse.notifications).toBeDefined();
    expect(renameResponse.notifications!.length).toBe(1);
    expect(renameResponse.notifications![0].title).toBe('Success!');
    expect(renameResponse.notifications![0].message).toBe('Successfully renamed snapshot.');
    expect(renameResponse.notifications![0].color).toBe('green');

    const removeResponse = await storageEngine.removeSnapshotOrLive(Object.keys(snapshots)[0], studyId);
    expect(removeResponse).toBeDefined();
    expect(removeResponse.status).toBe('SUCCESS');
    expect(removeResponse.error).not.toBeDefined();
    expect(removeResponse.notifications).toBeDefined();
    expect(removeResponse.notifications!.length).toBe(1);
    expect(removeResponse.notifications![0].title).toBe('Success!');
    expect(removeResponse.notifications![0].message).toBe('Successfully deleted snapshot or live data.');
    expect(removeResponse.notifications![0].color).toBe('green');

    snapshots = await storageEngine.getSnapshots(studyId);
    expect(snapshots).toBeDefined();
    expect(Object.keys(snapshots).length).toBe(0);

    const actionResponse3 = await storageEngine.createSnapshot(studyId, true);
    expect(actionResponse3).toBeDefined();
    expect(actionResponse3.status).toBe('SUCCESS');
    expect(actionResponse3.error).not.toBeDefined();
    expect(actionResponse3.notifications).toBeDefined();
    expect(actionResponse3.notifications!.length).toBe(2);
    expect(actionResponse3.notifications![0].title).toBe('Success!');
    expect(actionResponse3.notifications![0].message).toBe('Successfully deleted live data.');
    expect(actionResponse3.notifications![0].color).toBe('green');
    expect(actionResponse3.notifications![1].title).toBe('Success!');
    expect(actionResponse3.notifications![1].message).toBe('Successfully created snapshot');
    expect(actionResponse3.notifications![1].color).toBe('green');

    snapshots = await storageEngine.getSnapshots(studyId);
    expect(snapshots).toBeDefined();
    expect(Object.keys(snapshots).length).toBe(1);
    expect(Object.values(snapshots)[0].name).toBeDefined();

    const snapshotName = Object.keys(snapshots)[0];
    const restoreResponse = await storageEngine.restoreSnapshot(studyId, snapshotName);
    expect(restoreResponse).toBeDefined();
    expect(restoreResponse.status).toBe('SUCCESS');
    expect(restoreResponse.error).not.toBeDefined();
    expect(restoreResponse.notifications).toBeDefined();
    expect(restoreResponse.notifications!.length).toBe(2);
    expect(restoreResponse.notifications![0].title).toBe('Failed to Create Snapshot.');
    expect(restoreResponse.notifications![0].message).toBe('There is currently no data in your study. A snapshot could not be created.');
    expect(restoreResponse.notifications![0].color).toBe('yellow');
    expect(restoreResponse.notifications![1].title).toBe('Success!');
    expect(restoreResponse.notifications![1].message).toBe('Successfully restored snapshot to live data.');
    expect(restoreResponse.notifications![1].color).toBe('green');
  });
});
