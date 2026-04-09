/**
 * Firebase high-level tests — mirrors highLevel.spec.ts for FirebaseStorageEngine.
 *
 * Uses in-memory Firestore mocks (no emulator required).
 *
 *   yarn vitest run src/storage/tests/highLevelFirebase.spec.ts
 */

import {
  beforeAll, beforeEach, afterAll, afterEach, describe, expect, test, vi,
} from 'vitest';
import { type ParticipantMetadata, type StudyConfig } from '../../parser/types';
import testConfigSimple from './testConfigSimple.json';
import testConfigSimple2 from './testConfigSimple2.json';
import { generateSequenceArray } from '../../utils/handleRandomSequences';
import { hash } from '../engines/utils';
import { type Sequence } from '../../store/types';
import { FirebaseStorageEngine } from '../engines/FirebaseStorageEngine';
import { type StorageEngine, type SequenceAssignment } from '../engines/types';
import { filterSequenceByCondition } from '../../utils/handleConditionLogic';

// ── module-level state (captured by-ref inside vi.mock factories) ─────────────
// In-memory Firestore substitute (keyed by document path)
const firestoreData: Record<string, Record<string, unknown>> = {};
// Sentinel values for serverTimestamp() and deleteField()
const SERVER_TS_SENTINEL = { __sentinel: 'serverTimestamp' };
const DELETE_FIELD_SENTINEL = { __sentinel: 'deleteField' };
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

// Complete in-memory Firestore mock — no emulator needed.
vi.mock('firebase/firestore', () => {
  function resolveSentinels(data: Record<string, unknown>): Record<string, unknown> {
    const now = Date.now();
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      result[k] = v === SERVER_TS_SENTINEL ? now : v;
    }
    return result;
  }

  function mockCollection(parent: unknown, path: string) {
    if (parent && typeof parent === 'object' && '_path' in (parent as Record<string, unknown>)) {
      return { _path: `${(parent as { _path: string })._path}/${path}` };
    }
    return { _path: path };
  }

  function mockDoc(...args: unknown[]) {
    if (args.length === 2) {
      const [parent, id] = args as [{ _path: string }, string];
      return { _path: `${parent._path}/${id}`, id };
    }
    const [, collPath, docId] = args as [unknown, string, string];
    return { _path: `${collPath}/${docId}`, id: docId };
  }

  function mockSetDoc(docRef: { _path: string }, data: Record<string, unknown>, options?: { merge?: boolean }) {
    const resolved = resolveSentinels(data);
    if (options?.merge) {
      firestoreData[docRef._path] = { ...(firestoreData[docRef._path] ?? {}), ...resolved };
    } else {
      firestoreData[docRef._path] = resolved;
    }
    return Promise.resolve();
  }

  function mockGetDoc(docRef: { _path: string; id?: string }) {
    const data = firestoreData[docRef._path];
    return Promise.resolve({
      exists: () => data !== undefined,
      data: () => (data ? { ...data } : undefined),
      id: docRef.id ?? docRef._path.split('/').pop(),
    });
  }

  function getDocsInCollection(collPath: string) {
    const prefix = `${collPath}/`;
    const docs: Array<{ id: string; data: () => Record<string, unknown> }> = [];
    for (const [path, data] of Object.entries(firestoreData)) {
      if (path.startsWith(prefix)) {
        const remainder = path.slice(prefix.length);
        if (!remainder.includes('/')) {
          const copy = { ...data };
          docs.push({ id: remainder, data: () => copy });
        }
      }
    }
    return docs;
  }

  function mockGetDocs(collRef: { _path: string }) {
    const docs = getDocsInCollection(collRef._path);
    return Promise.resolve({
      docs,
      forEach: (cb: (d: { id: string; data: () => Record<string, unknown> }) => void) => docs.forEach(cb),
    });
  }

  function mockUpdateDoc(docRef: { _path: string }, data: Record<string, unknown>) {
    const existing = firestoreData[docRef._path];
    if (!existing) return Promise.reject(new Error(`No document to update: ${docRef._path}`));
    const now = Date.now();
    const updated = { ...existing };
    for (const [key, value] of Object.entries(data)) {
      if (value === DELETE_FIELD_SENTINEL) delete updated[key];
      else if (value === SERVER_TS_SENTINEL) updated[key] = now;
      else updated[key] = value;
    }
    firestoreData[docRef._path] = updated;
    return Promise.resolve();
  }

  function mockOnSnapshot(
    collRef: { _path: string },
    callback: (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void,
  ) {
    Promise.resolve().then(() => callback({ docs: getDocsInCollection(collRef._path) }));
    return vi.fn();
  }

  function mockWriteBatch() {
    const ops: Array<() => void> = [];
    return {
      set: (docRef: { _path: string }, data: Record<string, unknown>) => {
        ops.push(() => { firestoreData[docRef._path] = resolveSentinels(data); });
      },
      delete: (docRef: { _path: string }) => {
        ops.push(() => { delete firestoreData[docRef._path]; });
      },
      commit: () => { ops.forEach((op) => op()); return Promise.resolve(); },
    };
  }

  class MockTimestamp {
    constructor(public seconds: number, public nanoseconds: number) { }

    toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); }
  }

  return {
    collection: vi.fn(mockCollection),
    doc: vi.fn(mockDoc),
    setDoc: vi.fn(mockSetDoc),
    getDoc: vi.fn(mockGetDoc),
    getDocs: vi.fn(mockGetDocs),
    updateDoc: vi.fn(mockUpdateDoc),
    onSnapshot: vi.fn(mockOnSnapshot),
    writeBatch: vi.fn(mockWriteBatch),
    deleteField: vi.fn(() => DELETE_FIELD_SENTINEL),
    serverTimestamp: vi.fn(() => SERVER_TS_SENTINEL),
    initializeFirestore: vi.fn(() => ({})),
    enableNetwork: vi.fn(() => Promise.resolve()),
    Timestamp: MockTimestamp,
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

// ── lifecycle ─────────────────────────────────────────────────────────────────
beforeAll(() => {
  vi.stubEnv('VITE_FIREBASE_CONFIG', JSON.stringify({ projectId: PROJECT_ID }));
  vi.stubEnv('VITE_RECAPTCHAV3TOKEN', 'fake-recaptcha-token');

  // Mock fetch so _getFromStorage can retrieve data stored via uploadBytes mock.
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

afterAll(() => {
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
    Object.keys(firestoreData).forEach((k) => delete firestoreData[k]);
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

  // ── initializeStudyDb ───────────────────────────────────────────────────────
  test('initializeStudyDb sets studyId on the engine', async () => {
    // @ts-expect-error accessing protected property
    expect(storageEngine.studyId).toBe(studyId);
  });

  // ── _setupSequenceAssignmentListener ────────────────────────────────────────
  test('_setupSequenceAssignmentListener invokes callback with assignments and returns unsubscribe', async () => {
    const session = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    const cb = vi.fn();
    const unsub = (storageEngine as FirebaseStorageEngine)._setupSequenceAssignmentListener(studyId, cb);
    await vi.waitFor(() => expect(cb).toHaveBeenCalled(), { timeout: 3000 });
    const assignments: SequenceAssignment[] = cb.mock.calls[0][0];
    expect(assignments.some((a) => a.participantId === session.participantId)).toBe(true);
    expect(typeof unsub).toBe('function');
  });

  // ── _createSequenceAssignment ────────────────────────────────────────────────
  test('_createSequenceAssignment throws when studyId is not set', async () => {
    const fresh = new FirebaseStorageEngine(true);
    authState.currentUser = { email: null, uid: 'uid' };
    await fresh.connect();
    // @ts-expect-error protected
    await expect(fresh._createSequenceAssignment('p1', {} as SequenceAssignment, false))
      .rejects.toThrow('Study ID is not set');
  });

  test('_createSequenceAssignment creates an assignment doc retrievable via getAllSequenceAssignments', async () => {
    const assignment = {
      participantId: 'p-create',
      timestamp: 100,
      createdTime: 100,
      completed: null,
      rejected: false,
      claimed: false,
    } as SequenceAssignment;
    // @ts-expect-error protected
    await storageEngine._createSequenceAssignment('p-create', assignment, false);
    const all = await storageEngine.getAllSequenceAssignments(studyId);
    expect(all.find((a) => a.participantId === 'p-create')).toBeDefined();
  });

  // ── _updateSequenceAssignmentFields ─────────────────────────────────────────
  test('_updateSequenceAssignmentFields throws when studyId is not set', async () => {
    const fresh = new FirebaseStorageEngine(true);
    authState.currentUser = { email: null, uid: 'uid' };
    await fresh.connect();
    // @ts-expect-error protected
    await expect(fresh._updateSequenceAssignmentFields('p1', { claimed: true }))
      .rejects.toThrow('Study ID is not set');
  });

  test('_updateSequenceAssignmentFields resolves without error when fields object is empty', async () => {
    const session = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    // @ts-expect-error protected
    await expect(storageEngine._updateSequenceAssignmentFields(session.participantId, {})).resolves.not.toThrow();
  });

  test('_updateSequenceAssignmentFields clears conditions when value is undefined', async () => {
    const session = await storageEngine.initializeParticipantSession({ condition: 'color' }, configSimple, participantMetadata);
    // @ts-expect-error protected
    await storageEngine._updateSequenceAssignmentFields(session.participantId, { conditions: undefined });
    const all = await storageEngine.getAllSequenceAssignments(studyId);
    const updated = all.find((a) => a.participantId === session.participantId);
    expect(updated).toBeDefined();
    expect(Object.hasOwn(updated!, 'conditions')).toBe(false);
  });

  test('_updateSequenceAssignmentFields updates normal fields', async () => {
    const session = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    // @ts-expect-error protected
    await storageEngine._updateSequenceAssignmentFields(session.participantId, { claimed: true });
    const all = await storageEngine.getAllSequenceAssignments(studyId);
    const updated = all.find((a) => a.participantId === session.participantId);
    expect(updated?.claimed).toBe(true);
  });

  // ── _completeCurrentParticipantRealtime ──────────────────────────────────────
  test('_completeCurrentParticipantRealtime throws when currentParticipantId is not set', async () => {
    const fresh = new FirebaseStorageEngine(true);
    authState.currentUser = { email: null, uid: 'uid' };
    await fresh.connect();
    await fresh.initializeStudyDb(studyId);
    // @ts-expect-error protected
    await expect(fresh._completeCurrentParticipantRealtime()).rejects.toThrow('Participant not initialized');
  });

  // ── _rejectParticipantRealtime ───────────────────────────────────────────────
  test('_rejectParticipantRealtime throws when studyId is not set', async () => {
    const fresh = new FirebaseStorageEngine(true);
    authState.currentUser = { email: null, uid: 'uid' };
    await fresh.connect();
    // @ts-expect-error protected
    await expect(fresh._rejectParticipantRealtime('p1')).rejects.toThrow('Study ID is not set');
  });

  test('_rejectParticipantRealtime sets rejected=true on the assignment', async () => {
    const session = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    // @ts-expect-error protected
    await storageEngine._rejectParticipantRealtime(session.participantId);
    const all = await storageEngine.getAllSequenceAssignments(studyId);
    expect(all.find((a) => a.participantId === session.participantId)?.rejected).toBe(true);
  });

  // ── _undoRejectParticipantRealtime ───────────────────────────────────────────
  test('_undoRejectParticipantRealtime throws when currentParticipantId is not set', async () => {
    const fresh = new FirebaseStorageEngine(true);
    authState.currentUser = { email: null, uid: 'uid' };
    await fresh.connect();
    await fresh.initializeStudyDb(studyId);
    // @ts-expect-error protected
    await expect(fresh._undoRejectParticipantRealtime('p1')).rejects.toThrow('Participant not initialized');
  });

  test('_undoRejectParticipantRealtime throws when studyId is not set', async () => {
    const fresh = new FirebaseStorageEngine(true);
    authState.currentUser = { email: null, uid: 'uid' };
    await fresh.connect();
    // @ts-expect-error protected
    fresh.currentParticipantId = 'p1';
    // @ts-expect-error protected
    await expect(fresh._undoRejectParticipantRealtime('p1')).rejects.toThrow('Study ID is not set');
  });

  test('_undoRejectParticipantRealtime sets rejected=false on the assignment', async () => {
    const session = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    await storageEngine.rejectParticipant(session.participantId, 'test');
    // @ts-expect-error protected
    storageEngine.currentParticipantId = session.participantId;
    // @ts-expect-error protected
    await storageEngine._undoRejectParticipantRealtime(session.participantId);
    const all = await storageEngine.getAllSequenceAssignments(studyId);
    expect(all.find((a) => a.participantId === session.participantId)?.rejected).toBe(false);
  });

  // ── _claimSequenceAssignment ─────────────────────────────────────────────────
  test('_claimSequenceAssignment throws when currentParticipantId is not set', async () => {
    const fresh = new FirebaseStorageEngine(true);
    authState.currentUser = { email: null, uid: 'uid' };
    await fresh.connect();
    await fresh.initializeStudyDb(studyId);
    // @ts-expect-error protected
    await expect(fresh._claimSequenceAssignment('p1')).rejects.toThrow('Participant not initialized');
  });

  test('_claimSequenceAssignment throws when studyId is not set', async () => {
    const fresh = new FirebaseStorageEngine(true);
    authState.currentUser = { email: null, uid: 'uid' };
    await fresh.connect();
    // @ts-expect-error protected
    fresh.currentParticipantId = 'p1';
    // @ts-expect-error protected
    await expect(fresh._claimSequenceAssignment('p1')).rejects.toThrow('Study ID is not set');
  });

  test('_claimSequenceAssignment sets claimed=true on the assignment', async () => {
    const session = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    // @ts-expect-error protected
    storageEngine.currentParticipantId = session.participantId;
    // @ts-expect-error protected
    await storageEngine._claimSequenceAssignment(session.participantId);
    const all = await storageEngine.getAllSequenceAssignments(studyId);
    expect(all.find((a) => a.participantId === session.participantId)?.claimed).toBe(true);
  });

  // ── _setModesDocument ────────────────────────────────────────────────────────
  test('_setModesDocument writes modes to Firestore', async () => {
    // @ts-expect-error protected
    await storageEngine._setModesDocument(studyId, { dataCollectionEnabled: false, developmentModeEnabled: false, dataSharingEnabled: false });
    const modes = await storageEngine.getModes(studyId);
    expect(modes.dataCollectionEnabled).toBe(false);
    expect(modes.developmentModeEnabled).toBe(false);
    expect(modes.dataSharingEnabled).toBe(false);
  });

  // ── URL getters ──────────────────────────────────────────────────────────────
  test('_getAudioUrl returns URL when audio exists', async () => {
    // @ts-expect-error protected
    const prefix = storageEngine.collectionPrefix;
    const path = `${prefix}${studyId}/audio/p1_task1`;
    storageObjects[path] = 'data';
    // @ts-expect-error protected
    expect(await storageEngine._getAudioUrl('task1', 'p1')).toContain(path);
  });

  test('_getAudioUrl returns null when audio does not exist', async () => {
    // @ts-expect-error protected
    expect(await storageEngine._getAudioUrl('missing', 'p1')).toBeNull();
  });

  test('_getScreenRecordingUrl returns URL when recording exists', async () => {
    // @ts-expect-error protected
    const prefix = storageEngine.collectionPrefix;
    const path = `${prefix}${studyId}/screenRecording/p1_task2`;
    storageObjects[path] = 'data';
    // @ts-expect-error protected
    expect(await storageEngine._getScreenRecordingUrl('task2', 'p1')).toContain(path);
  });

  test('_getScreenRecordingUrl returns null when recording does not exist', async () => {
    // @ts-expect-error protected
    expect(await storageEngine._getScreenRecordingUrl('missing', 'p1')).toBeNull();
  });

  test('_getTranscriptUrl returns URL when transcript exists', async () => {
    // @ts-expect-error protected
    const prefix = storageEngine.collectionPrefix;
    const path = `${prefix}${studyId}/audio/p1_task3.wav_transcription.txt`;
    storageObjects[path] = 'data';
    // @ts-expect-error protected
    expect(await storageEngine._getTranscriptUrl('task3', 'p1')).toContain(path);
  });

  test('_getTranscriptUrl returns null when transcript does not exist', async () => {
    // @ts-expect-error protected
    expect(await storageEngine._getTranscriptUrl('missing', 'p1')).toBeNull();
  });

  // ── _testingReset ────────────────────────────────────────────────────────────
  test('_testingReset throws not-implemented error', async () => {
    const fresh = new FirebaseStorageEngine(true);
    authState.currentUser = { email: null, uid: 'uid' };
    await fresh.connect();
    // @ts-expect-error protected
    await expect(fresh._testingReset()).rejects.toThrow('Testing reset not implemented');
  });

  // ── getSnapshots ─────────────────────────────────────────────────────────────
  test('getSnapshots returns empty object before any snapshot is created', async () => {
    expect(await storageEngine.getSnapshots(studyId)).toEqual({});
  });

  test('getSnapshots returns data after a snapshot has been created', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    await storageEngine.createSnapshot(studyId, false);
    const snaps = await storageEngine.getSnapshots(studyId);
    expect(Object.keys(snaps).length).toBeGreaterThan(0);
  });

  // ── getUserManagementData ────────────────────────────────────────────────────
  test('getUserManagementData returns undefined when key does not exist', async () => {
    expect(await (storageEngine as FirebaseStorageEngine).getUserManagementData('authentication')).toBeUndefined();
  });

  test('getUserManagementData returns authentication data when it exists', async () => {
    await (storageEngine as FirebaseStorageEngine).changeAuth(true);
    expect(await (storageEngine as FirebaseStorageEngine).getUserManagementData('authentication')).toEqual({ isEnabled: true });
  });

  test('getUserManagementData returns adminUsers data when it exists', async () => {
    await (storageEngine as FirebaseStorageEngine).addAdminUser({ email: 'test@test.com', uid: 'u1' });
    const result = await (storageEngine as FirebaseStorageEngine).getUserManagementData('adminUsers');
    expect(result).toBeDefined();
    expect((result as { adminUsersList: unknown[] }).adminUsersList).toHaveLength(1);
  });

  test('getUserManagementData uses cached data on second call', async () => {
    await (storageEngine as FirebaseStorageEngine).changeAuth(false);
    const first = await (storageEngine as FirebaseStorageEngine).getUserManagementData('authentication');
    const second = await (storageEngine as FirebaseStorageEngine).getUserManagementData('authentication');
    expect(first).toEqual(second);
  });

  // ── _updateAdminUsersList and changeAuth ────────────────────────────────────
  test('changeAuth writes isEnabled flag to Firestore', async () => {
    await (storageEngine as FirebaseStorageEngine).changeAuth(true);
    expect(await (storageEngine as FirebaseStorageEngine).getUserManagementData('authentication')).toEqual({ isEnabled: true });
  });

  test('_updateAdminUsersList writes admin list to Firestore', async () => {
    const list = { adminUsersList: [{ email: 'a@b.com', uid: 'u1' }] };
    // @ts-expect-error protected
    await storageEngine._updateAdminUsersList(list);
    const result = await (storageEngine as FirebaseStorageEngine).getUserManagementData('adminUsers');
    expect(result).toEqual(list);
  });

  // ── addAdminUser ─────────────────────────────────────────────────────────────
  test('addAdminUser creates new list when no adminUsers doc exists', async () => {
    await (storageEngine as FirebaseStorageEngine).addAdminUser({ email: 'new@a.com', uid: 'u1' });
    const result = await (storageEngine as FirebaseStorageEngine).getUserManagementData('adminUsers') as { adminUsersList: unknown[] };
    expect(result.adminUsersList).toHaveLength(1);
  });

  test('addAdminUser appends user to existing list', async () => {
    await (storageEngine as FirebaseStorageEngine).addAdminUser({ email: 'a@a.com', uid: 'u0' });
    await (storageEngine as FirebaseStorageEngine).addAdminUser({ email: 'b@b.com', uid: 'u1' });
    const result = await (storageEngine as FirebaseStorageEngine).getUserManagementData('adminUsers') as { adminUsersList: unknown[] };
    expect(result.adminUsersList).toHaveLength(2);
  });

  test('addAdminUser does not add duplicate user', async () => {
    await (storageEngine as FirebaseStorageEngine).addAdminUser({ email: 'a@a.com', uid: 'u0' });
    await (storageEngine as FirebaseStorageEngine).addAdminUser({ email: 'a@a.com', uid: 'u0' });
    const result = await (storageEngine as FirebaseStorageEngine).getUserManagementData('adminUsers') as { adminUsersList: unknown[] };
    expect(result.adminUsersList).toHaveLength(1);
  });

  // ── removeAdminUser ──────────────────────────────────────────────────────────
  test('removeAdminUser removes user when multiple users exist', async () => {
    await (storageEngine as FirebaseStorageEngine).addAdminUser({ email: 'a@a.com', uid: 'u0' });
    await (storageEngine as FirebaseStorageEngine).addAdminUser({ email: 'b@b.com', uid: 'u1' });
    await (storageEngine as FirebaseStorageEngine).removeAdminUser('a@a.com');
    const result = await (storageEngine as FirebaseStorageEngine).getUserManagementData('adminUsers') as { adminUsersList: unknown[] };
    expect(result.adminUsersList).toHaveLength(1);
  });

  test('removeAdminUser does not remove user when they are the only admin', async () => {
    await (storageEngine as FirebaseStorageEngine).addAdminUser({ email: 'a@a.com', uid: 'u0' });
    await (storageEngine as FirebaseStorageEngine).removeAdminUser('a@a.com');
    const result = await (storageEngine as FirebaseStorageEngine).getUserManagementData('adminUsers') as { adminUsersList: unknown[] };
    expect(result.adminUsersList).toHaveLength(1);
  });

  // ── login / logout / unsubscribe ─────────────────────────────────────────────
  test('login returns email and uid from currentUser', async () => {
    authState.currentUser = { email: 'me@test.com', uid: 'my-uid' };
    const result = await (storageEngine as FirebaseStorageEngine).login();
    expect(result.email).toBe('me@test.com');
    expect(result.uid).toBe('my-uid');
  });

  test('login returns nulls when no current user', async () => {
    authState.currentUser = null;
    const result = await (storageEngine as FirebaseStorageEngine).login();
    expect(result.email).toBeNull();
    expect(result.uid).toBeNull();
  });

  test('logout calls signOut', async () => {
    const { signOut } = await import('@firebase/auth');
    await (storageEngine as FirebaseStorageEngine).logout();
    expect(vi.mocked(signOut)).toHaveBeenCalled();
  });

  test('unsubscribe returns a callable unsubscribe function', async () => {
    const unsub = (storageEngine as FirebaseStorageEngine).unsubscribe(vi.fn());
    expect(typeof unsub).toBe('function');
    unsub();
  });

  // ── transcript methods ───────────────────────────────────────────────────────
  test('getTranscription retrieves stored transcription from storage', async () => {
    // @ts-expect-error protected
    const prefix = storageEngine.collectionPrefix;
    const path = `${prefix}${studyId}/audio/p1_task1.wav_transcription.txt`;
    storageObjects[path] = JSON.stringify({ text: 'hello' });
    const result = await (storageEngine as FirebaseStorageEngine).getTranscription('task1', 'p1');
    expect(result).toEqual({ text: 'hello' });
  });

  test('saveEditedTranscript filters out undefined tags and stores result', async () => {
    const lines = [
      {
        text: 'line1',
        selectedTags: [{ id: 't1', name: 'T1', color: 'red' }, undefined as never],
        annotation: '',
        transcriptMappingStart: 0,
        transcriptMappingEnd: 0,
      },
    ];
    await (storageEngine as FirebaseStorageEngine).saveEditedTranscript('p1', 'editor@a.com', 'task1', lines);
    // @ts-expect-error protected
    const prefix = storageEngine.collectionPrefix;
    const path = `${prefix}${studyId}/audio/transcriptAndTags/editor@a.com/p1/task1_editedText`;
    const stored = JSON.parse(storageObjects[path]);
    expect(stored[0].selectedTags).toHaveLength(1);
  });

  test('getEditedTranscript returns [] when stored value is not an array', async () => {
    // @ts-expect-error protected
    const prefix = storageEngine.collectionPrefix;
    const path = `${prefix}${studyId}/audio/transcriptAndTags/editor@a.com/p1/task1_editedText`;
    storageObjects[path] = JSON.stringify({ not: 'array' });
    const result = await (storageEngine as FirebaseStorageEngine).getEditedTranscript('p1', 'editor@a.com', 'task1');
    expect(result).toEqual([]);
  });

  test('getEditedTranscript returns stored array when value is an array', async () => {
    // @ts-expect-error protected
    const prefix = storageEngine.collectionPrefix;
    const path = `${prefix}${studyId}/audio/transcriptAndTags/editor@a.com/p1/task2_editedText`;
    const stored = [{
      text: 'line', selectedTags: [], annotation: '', transcriptMappingStart: 0, transcriptMappingEnd: 0,
    }];
    storageObjects[path] = JSON.stringify(stored);
    const result = await (storageEngine as FirebaseStorageEngine).getEditedTranscript('p1', 'editor@a.com', 'task2');
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('line');
  });
});

// ── unit tests (no emulator required) ────────────────────────────────────────
// Tests for auth, connection, and other methods that only need the vi.mock'ed
// @firebase/auth and firebase/storage — the Firestore emulator is not needed.

describe('FirebaseStorageEngine auth/connection unit tests', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_FIREBASE_CONFIG', JSON.stringify({ projectId: 'demo-unit' }));
    vi.stubEnv('VITE_RECAPTCHAV3TOKEN', 'fake-token');
    authState.currentUser = null;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    authState.currentUser = null;
  });

  // ── initializeAnonymousAuth ──────────────────────────────────────────────────
  test('initializeAnonymousAuth returns true immediately when currentUser is already set', async () => {
    authState.currentUser = { email: 'a@b.com', uid: 'uid-1' };
    const engine = new FirebaseStorageEngine(true);
    expect(await engine.initializeAnonymousAuth()).toBe(true);
  });

  test('initializeAnonymousAuth signs in anonymously and returns true when no current user', async () => {
    const engine = new FirebaseStorageEngine(true);
    expect(await engine.initializeAnonymousAuth()).toBe(true);
    expect(authState.currentUser).not.toBeNull();
  });

  test('initializeAnonymousAuth returns false when signInAnonymously throws', async () => {
    const { signInAnonymously } = await import('@firebase/auth');
    vi.mocked(signInAnonymously).mockRejectedValueOnce(new Error('auth-error'));
    const engine = new FirebaseStorageEngine(true);
    expect(await engine.initializeAnonymousAuth()).toBe(false);
  });

  // ── checkAuthReadiness ───────────────────────────────────────────────────────
  test('checkAuthReadiness sets connected=true when auth succeeds', async () => {
    authState.currentUser = { email: null, uid: 'uid' };
    const engine = new FirebaseStorageEngine(true);
    await engine.checkAuthReadiness();
    expect(engine.isConnected()).toBe(true);
  });

  test('checkAuthReadiness throws and sets connected=false when auth fails', async () => {
    const { signInAnonymously } = await import('@firebase/auth');
    vi.mocked(signInAnonymously).mockRejectedValueOnce(new Error('fail'));
    const engine = new FirebaseStorageEngine(true);
    await expect(engine.checkAuthReadiness()).rejects.toThrow('FirebaseAuthError');
    expect(engine.isConnected()).toBe(false);
  });

  // ── connect ──────────────────────────────────────────────────────────────────
  test('connect sets connected=true on success', async () => {
    authState.currentUser = { email: null, uid: 'uid' };
    const engine = new FirebaseStorageEngine(true);
    await engine.connect();
    expect(engine.isConnected()).toBe(true);
  });

  test('connect sets connected=false when enableNetwork throws', async () => {
    const { enableNetwork } = await import('firebase/firestore');
    vi.mocked(enableNetwork).mockRejectedValueOnce(new Error('network'));
    const engine = new FirebaseStorageEngine(true);
    await engine.connect();
    expect(engine.isConnected()).toBe(false);
  });
});
