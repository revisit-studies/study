import {
  beforeAll, beforeEach, afterAll, afterEach, describe, expect, test, vi,
} from 'vitest';
import { signInAnonymously, signOut } from '@firebase/auth';
import {
  enableNetwork, Timestamp, runTransaction, getCountFromServer, getDocs, getDoc, getDocsFromServer,
} from 'firebase/firestore';
import { type ParticipantMetadata, type StudyConfig } from '../../parser/types';
import testConfigSimple from './testConfigSimple.json';
import testConfigSimple2 from './testConfigSimple2.json';
import { makeStoredAnswer } from '../../tests/utils';
import { generateSequenceArray } from '../../utils/handleRandomSequences';
import { hash } from '../engines/utils/storageEngineHelpers';
import { type Sequence } from '../../store/types';
import { FirebaseStorageEngine } from '../engines/FirebaseStorageEngine';
import {
  type StorageEngine, getBetweenSubjectsCombinationKey, type SequenceAssignment, type StoredUser,
} from '../engines/types';
import { filterSequenceByCondition } from '../../utils/handleConditionLogic';

type DocData = Record<string, string | number | boolean | null | object>;

const firestoreData: Record<string, DocData> = {};
const SERVER_TS_SENTINEL = { __sentinel: 'serverTimestamp' };
const DELETE_FIELD_SENTINEL = { __sentinel: 'deleteField' };
const storageObjects: Record<string, string> = {};
let failConfigActivation = false;
let failSequenceReads = false;
let failParticipantReads = false;
const localStore: Record<string, string | number | object | null> = {};
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
  ReCaptchaEnterpriseProvider: vi.fn(),
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
    ref: vi.fn((_storage: object, path: string) => makeRef(path)),
    uploadBytes: vi.fn(async (refObj: { path: string }, blob: Blob | object) => {
      const text = blob instanceof Blob ? await blob.text() : JSON.stringify(blob);
      storageObjects[refObj.path] = text;
      return { ref: refObj };
    }),
    getBlob: vi.fn(async (refObj: { path: string }) => {
      if (failParticipantReads && refObj.path.endsWith('_participantData')) throw new Error('Participant storage unavailable');
      if (failSequenceReads && refObj.path.endsWith('_sequenceArray')) throw new Error('Storage unavailable');
      const data = storageObjects[refObj.path];
      if (data !== undefined) {
        return new Blob([data], { type: 'application/json' });
      }
      throw Object.assign(new Error('storage/object-not-found'), { code: 'storage/object-not-found' });
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
      setItem: vi.fn((key: string, value: string | number | object | null) => {
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
  type QueryConstraint = {
    type: 'where' | 'limit' | 'orderBy';
    field?: string;
    operator?: string;
    value?: unknown;
    count?: number;
    direction?: 'asc' | 'desc';
  };

  function resolveSentinels(data: DocData): DocData {
    const now = Date.now();
    const result: DocData = {};
    for (const [k, v] of Object.entries(data)) {
      result[k] = v === SERVER_TS_SENTINEL ? now : v;
    }
    return result;
  }

  function mockCollection(parent: object | null, path: string) {
    if (parent && typeof parent === 'object' && '_path' in (parent as DocData)) {
      return { _path: `${(parent as { _path: string })._path}/${path}` };
    }
    return { _path: path };
  }

  function mockDoc(...args: [{ _path: string }, string] | [object, string, string]) {
    if (args.length === 2) {
      const [parent, id] = args as [{ _path: string }, string];
      return { _path: `${parent._path}/${id}`, id };
    }
    const [, collPath, docId] = args as [object, string, string];
    return { _path: `${collPath}/${docId}`, id: docId };
  }

  function mockSetDoc(docRef: { _path: string }, data: DocData, options?: { merge?: boolean; mergeFields?: string[] }) {
    if (failConfigActivation && docRef._path.endsWith('/configHash')) {
      failConfigActivation = false;
      throw new Error('Failed to activate study config');
    }
    const resolved = resolveSentinels(data);
    if (options?.merge || options?.mergeFields) {
      const merged = { ...(firestoreData[docRef._path] ?? {}), ...resolved };
      // A merging write also honours deleteField(), same as Firestore itself.
      for (const [key, value] of Object.entries(merged)) {
        if (value === DELETE_FIELD_SENTINEL) delete merged[key];
      }
      firestoreData[docRef._path] = merged;
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
    const docs: Array<{ id: string; data: () => DocData }> = [];
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

  function mockGetDocs(collRef: { _path: string; _constraints?: QueryConstraint[] }) {
    let docs = getDocsInCollection(collRef._path);
    (collRef._constraints ?? []).forEach((constraint) => {
      if (constraint.type === 'where') {
        docs = docs.filter((document) => {
          const fieldValue = document.data()[constraint.field!];
          if (constraint.operator === '==') return fieldValue === constraint.value;
          if (constraint.operator === '<' || constraint.operator === '>=') {
            const toComparableNumber = (value: unknown) => (
              value
              && typeof value === 'object'
              && 'toMillis' in value
              && typeof value.toMillis === 'function'
                ? value.toMillis()
                : Number(value)
            );
            const constraintValue = toComparableNumber(constraint.value);
            const comparableFieldValue = toComparableNumber(fieldValue);
            if (typeof fieldValue !== typeof constraint.value) return false;
            return constraint.operator === '<'
              ? comparableFieldValue < constraintValue
              : comparableFieldValue >= constraintValue;
          }
          if (constraint.operator === '>') {
            return fieldValue !== undefined
              && fieldValue !== null
              && String(fieldValue) > String(constraint.value);
          }
          return true;
        });
      } else if (constraint.type === 'orderBy') {
        docs = [...docs].sort((a, b) => {
          const aValue = a.data()[constraint.field!];
          const bValue = b.data()[constraint.field!];
          const toComparableNumber = (value: unknown) => (
            value
            && typeof value === 'object'
            && 'toMillis' in value
            && typeof value.toMillis === 'function'
              ? value.toMillis()
              : Number(value)
          );
          const typeComparison = typeof aValue === typeof bValue ? 0 : (typeof aValue === 'number' ? -1 : 1);
          return (typeComparison || (toComparableNumber(aValue) - toComparableNumber(bValue)))
            * (constraint.direction === 'desc' ? -1 : 1);
        });
      } else if (constraint.type === 'limit') {
        docs = docs.slice(0, constraint.count);
      }
    });
    return Promise.resolve({
      docs,
      forEach: (cb: (d: { id: string; data: () => DocData }) => void) => docs.forEach(cb),
    });
  }

  function mockUpdateDoc(docRef: { _path: string }, fields: DocData, fieldValue?: unknown) {
    const data = fieldValue === undefined ? fields : { [String(fields.key)]: fieldValue };
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
    callback: (snapshot: { docs: Array<{ id: string; data: () => DocData }> }) => void,
  ) {
    Promise.resolve().then(() => callback({ docs: getDocsInCollection(collRef._path) }));
    return vi.fn();
  }

  function mockWriteBatch() {
    const ops: Array<() => void> = [];
    return {
      set: (docRef: { _path: string }, data: DocData) => {
        ops.push(() => { firestoreData[docRef._path] = resolveSentinels(data); });
      },
      delete: (docRef: { _path: string }) => {
        ops.push(() => { delete firestoreData[docRef._path]; });
      },
      commit: () => { ops.forEach((op) => op()); return Promise.resolve(); },
    };
  }

  async function mockRunTransaction<T>(
    _firestore: unknown,
    updateFunction: (transaction: {
      get: (docRef: { _path: string; id?: string }) => Promise<unknown>;
      set: (docRef: { _path: string }, data: DocData, options?: { merge?: boolean; mergeFields?: string[] }) => void;
      update: (docRef: { _path: string }, data: DocData, value?: unknown) => void;
      delete: (docRef: { _path: string }) => void;
    }) => Promise<T>,
  ): Promise<T> {
    // Model optimistic retries, read-before-write ordering and all-or-nothing
    // commit. Concurrent admissions must work without the browser lease.
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const reads = new Map<string, string | undefined>();
      const writes: Array<() => void> = [];
      const transaction = {
        get: async (ref: { _path: string; id?: string }) => {
          if (writes.length) throw new Error('Transactions must read before writing');
          reads.set(ref._path, JSON.stringify(firestoreData[ref._path]));
          return mockGetDoc(ref);
        },
        set: (ref: { _path: string }, data: DocData, options?: { merge?: boolean; mergeFields?: string[] }) => {
          writes.push(() => { mockSetDoc(ref, data, options); });
        },
        update: (ref: { _path: string }, data: DocData, value?: unknown) => {
          writes.push(() => {
            if (!firestoreData[ref._path]) throw new Error(`No document to update: ${ref._path}`);
            mockUpdateDoc(ref, data, value);
          });
        },
        delete: (ref: { _path: string }) => { writes.push(() => { delete firestoreData[ref._path]; }); },
      };
      // eslint-disable-next-line no-await-in-loop
      const result = await updateFunction(transaction);
      const conflict = [...reads].some(([key, snapshot]) => JSON.stringify(firestoreData[key]) !== snapshot);
      if (!conflict) {
        const before = structuredClone(firestoreData);
        try {
          writes.forEach((write) => write());
        } catch (error) {
          Object.keys(firestoreData).forEach((key) => delete firestoreData[key]);
          Object.assign(firestoreData, before);
          throw error;
        }
        return result;
      }
    }
    throw new Error('Transaction contention exceeded test retry limit');
  }

  class MockTimestamp {
    constructor(public seconds: number, public nanoseconds: number) { }

    toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); }

    static fromMillis(milliseconds: number) {
      return new MockTimestamp(Math.floor(milliseconds / 1000), (milliseconds % 1000) * 1e6);
    }
  }

  return {
    query: vi.fn((parent, ...constraints) => ({ ...parent, _constraints: constraints })),
    where: vi.fn((field, operator, value) => ({
      type: 'where', field, operator, value,
    })),
    orderBy: vi.fn((field, direction) => ({ type: 'orderBy', field, direction })),
    limit: vi.fn((count) => ({ type: 'limit', count })),
    collection: vi.fn(mockCollection),
    doc: vi.fn(mockDoc),
    setDoc: vi.fn(mockSetDoc),
    getDoc: vi.fn(mockGetDoc),
    getDocs: vi.fn(mockGetDocs),
    getCountFromServer: vi.fn(async (reference) => { const snapshot = await mockGetDocs(reference); return { data: () => ({ count: snapshot.docs.length }) }; }),
    getDocsFromServer: vi.fn(mockGetDocs),
    FieldPath: class { constructor(public key: string) {} },
    updateDoc: vi.fn(mockUpdateDoc),
    onSnapshot: vi.fn(mockOnSnapshot),
    writeBatch: vi.fn(mockWriteBatch),
    runTransaction: vi.fn(mockRunTransaction),
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
  $schema: '',
  studyMetadata: {
    title: 'Conditional Latin Square Test',
    version: '1.0.0',
    authors: ['Test Author'],
    description: 'A study config for testing conditional latin square balancing.',
    date: '2026-04-08',
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

  test('rejects lowering stage or condition limits below assigned counts', async () => {
    const config: StudyConfig = { ...configSimple, factors: { group: ['A', 'B'] }, betweenSubjects: ['group'] };
    await storageEngine.setSequenceArray(generateSequenceArray(config));
    const participant = await storageEngine.initializeParticipantSession({}, config, participantMetadata, 'assigned');
    const assignment = await storageEngine.getSequenceAssignment(studyId, participant.participantId);
    await expect(storageEngine.updateStage(studyId, 'DEFAULT', { maxParticipants: 0 })).rejects.toThrow(/already assigned/);
    await expect(storageEngine.setStageDesiredParticipants(studyId, 'DEFAULT', assignment!.betweenSubjectsCombinationKey!, 0, {})).rejects.toThrow(/already assigned/);
    await expect(storageEngine.setStageDesiredParticipants(studyId, 'DEFAULT', assignment!.betweenSubjectsCombinationKey!, 1, {})).resolves.toBeUndefined();
  });

  test('policy changes racing admission never lower the cap below committed reservations', async () => {
    await storageEngine.setCurrentStage(studyId, 'LIMITED', '#00AAFF', 2);
    const second = new FirebaseStorageEngine(true);
    await second.connect();
    await second.initializeStudyDb(studyId);
    [storageEngine, second].forEach((engine) => {
      // @ts-expect-error The database must protect capacity even when leases overlap.
      engine._runWithLock = async (_key, operation) => operation();
    });
    await Promise.allSettled([
      storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'first'),
      second.initializeParticipantSession({}, configSimple, participantMetadata, 'second'),
      storageEngine.updateStage(studyId, 'LIMITED', { maxParticipants: 1 }),
    ]);
    const active = (await storageEngine.getAllSequenceAssignments(studyId)).filter((assignment) => !assignment.rejected);
    const stage = (await storageEngine.getStageData(studyId)).allStages.find((item) => item.stageName === 'LIMITED')!;
    expect(active.length).toBeLessThanOrEqual(stage.maxParticipants!);
  });

  test('balances concurrent admissions across conditions without the browser lease', async () => {
    const config: StudyConfig = { ...configSimple, factors: { group: ['A', 'B'] }, betweenSubjects: ['group'] };
    await storageEngine.setSequenceArray(generateSequenceArray(config));
    await storageEngine.setCurrentStage(studyId, 'LIMITED', '#00AAFF', 2);
    const second = new FirebaseStorageEngine(true);
    await second.connect();
    await second.initializeStudyDb(studyId);
    [storageEngine, second].forEach((engine) => {
      // @ts-expect-error The transaction must protect the condition quota itself.
      engine._runWithLock = async (_key, operation) => operation();
    });
    const participants = await Promise.all([
      storageEngine.initializeParticipantSession({}, config, participantMetadata, 'first'),
      second.initializeParticipantSession({}, config, participantMetadata, 'second'),
    ]);
    expect(new Set(participants.map((participant) => participant.sequence.parameters?.group)).size).toBe(2);
  });

  test('rejection and restoration update committed allocation counts', async () => {
    await storageEngine.setCurrentStage(studyId, 'LIMITED', '#00AAFF', 2);
    const participant = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'first');
    await storageEngine.rejectParticipant(participant.participantId, 'Timed out');
    expect(Object.values(firestoreData).filter((data) => data.count === 0 && data.combinationCounts)).toHaveLength(1);
    await storageEngine.undoRejectParticipant(participant.participantId);
    expect(Object.values(firestoreData).filter((data) => data.count === 1 && data.combinationCounts)).toHaveLength(1);
  });

  test('an initial upload failure frees its transactional reservation for a replacement', async () => {
    await storageEngine.setCurrentStage(studyId, 'LIMITED', '#00AAFF', 1);
    // @ts-expect-error Inject an upload failure after the Firestore reservation commits.
    const write = vi.spyOn(storageEngine, '_pushToStorage');
    write.mockRejectedValueOnce(new Error('upload failed'));
    await expect(storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'failed')).rejects.toThrow('upload failed');
    await expect(storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'replacement')).resolves.toBeDefined();
    expect((await storageEngine.getAllSequenceAssignments(studyId)).filter((assignment) => !assignment.rejected)).toHaveLength(1);
  });

  test('a confirmation failure retains the uploaded participant reservation for retry', async () => {
    await storageEngine.setCurrentStage(studyId, 'LIMITED', '#00AAFF', 1);
    // @ts-expect-error Fail Firestore confirmation after the participant upload is acknowledged.
    vi.spyOn(storageEngine, 'confirmParticipantReservation').mockRejectedValueOnce(new Error('confirmation unavailable'));
    await expect(storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'retry')).rejects.toThrow('confirmation unavailable');
    expect((await storageEngine.getSequenceAssignment(studyId, 'retry'))?.rejected).toBe(false);
    expect((await storageEngine.getParticipantData('retry'))?.rejected).toBe(false);
    await expect(storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'retry')).resolves.toBeDefined();
    await expect(storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'replacement')).rejects.toThrow(/participant limit/);
  });

  test('reserves the final stage slot atomically without relying on the browser lease', async () => {
    await storageEngine.setCurrentStage(studyId, 'LIMITED', '#00AAFF', 1);
    const second = new FirebaseStorageEngine(true);
    await second.connect();
    await second.initializeStudyDb(studyId);
    [storageEngine, second].forEach((engine) => {
      // @ts-expect-error Bypass browser leases to exercise the Firestore transaction itself.
      engine._runWithLock = async (_key, operation) => operation();
    });
    const results = await Promise.allSettled([
      storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'first'),
      second.initializeParticipantSession({}, configSimple, participantMetadata, 'second'),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await storageEngine.getAllSequenceAssignments(studyId)).filter((assignment) => !assignment.rejected)).toHaveLength(1);
    expect(Object.values(firestoreData).filter((data) => data.count === 1 && data.combinationCounts)).toHaveLength(1);
  });

  test('a slow initial upload does not block another participant from joining', async () => {
    await storageEngine.setCurrentStage(studyId, 'LIMITED', '#00AAFF', 2);
    const second = new FirebaseStorageEngine(true);
    await second.connect();
    await second.initializeStudyDb(studyId);
    let release!: () => void;
    let uploading!: () => void;
    const uploadStarted = new Promise<void>((resolve) => { uploading = resolve; });
    // @ts-expect-error Hold the first participant's upload while another joins.
    const upload = storageEngine._pushToStorage.bind(storageEngine);
    // @ts-expect-error Keep the real participant and admission locks enabled.
    vi.spyOn(storageEngine, '_pushToStorage').mockImplementationOnce(async (path, type, data) => {
      uploading();
      await new Promise<void>((resolve) => { release = resolve; });
      return upload(path, type, data);
    });
    const first = storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'slow');
    await uploadStarted;
    vi.useFakeTimers();
    try {
      const result = second.initializeParticipantSession({}, configSimple, participantMetadata, 'fast')
        .then(() => 'joined', () => 'failed');
      await vi.advanceTimersByTimeAsync(30_000);
      const outcome = await result;
      release();
      await first;
      expect(outcome).toBe('joined');
      expect((await storageEngine.getAllSequenceAssignments(studyId)).filter((assignment) => !assignment.rejected)).toHaveLength(2);
    } finally {
      release();
      await first;
      vi.useRealTimers();
    }
  });

  test('a delayed same-ID startup preserves answers saved by the first session', async () => {
    const second = new FirebaseStorageEngine(true);
    await second.connect();
    await second.initializeStudyDb(studyId);
    let releaseUpload!: () => void;
    let uploading!: () => void;
    const uploadStarted = new Promise<void>((resolve) => { uploading = resolve; });
    // @ts-expect-error Pause the first record upload before another startup reads it.
    const upload = storageEngine._pushToStorage.bind(storageEngine);
    // @ts-expect-error Keep the actual locks enabled.
    vi.spyOn(storageEngine, '_pushToStorage').mockImplementationOnce(async (path, type, data) => {
      uploading();
      await new Promise<void>((resolve) => { releaseUpload = resolve; });
      return upload(path, type, data);
    });
    let resumeSecond!: () => void;
    let secondWaiting!: () => void;
    const secondPaused = new Promise<void>((resolve) => { secondWaiting = resolve; });
    // @ts-expect-error Hold the second startup before its first lock acquisition.
    const runWithLock = second._runWithLock.bind(second);
    // @ts-expect-error Let the first session save an answer before the delayed startup continues.
    vi.spyOn(second, '_runWithLock').mockImplementationOnce(async (key, operation) => {
      secondWaiting();
      await new Promise<void>((resolve) => { resumeSecond = resolve; });
      return runWithLock(key, operation);
    });
    const first = storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'same');
    await uploadStarted;
    const retry = second.initializeParticipantSession({}, configSimple, participantMetadata, 'same');
    await secondPaused;
    releaseUpload();
    await first;
    const answers = { trial_0: makeStoredAnswer({ answer: { value: 'already saved' } }) };
    await storageEngine.saveAnswers(answers);
    await storageEngine.flushPendingParticipantData();
    resumeSecond();
    expect((await retry).answers).toEqual(answers);
    expect((await storageEngine.getParticipantData('same'))?.answers).toEqual(answers);
  });

  test('concurrent starts for the same participant reuse one reservation', async () => {
    await storageEngine.setCurrentStage(studyId, 'LIMITED', '#00AAFF', 1);
    const second = new FirebaseStorageEngine(true);
    await second.connect();
    await second.initializeStudyDb(studyId);
    [storageEngine, second].forEach((engine) => {
      // @ts-expect-error Exercise idempotency without the browser lease.
      engine._runWithLock = async (_key, operation) => operation();
    });
    const [first, retry] = await Promise.all([
      storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'same'),
      second.initializeParticipantSession({}, configSimple, participantMetadata, 'same'),
    ]);
    expect(retry.sequence).toEqual(first.sequence);
    expect(retry.participantIndex).toBe(first.participantIndex);
    expect(await storageEngine.getAllSequenceAssignments(studyId)).toHaveLength(1);
  });

  test.each([true, false])('a failed same-ID start preserves the other start (success first: %s)', async (successFirst) => {
    await storageEngine.setCurrentStage(studyId, 'LIMITED', '#00AAFF', 1);
    const second = new FirebaseStorageEngine(true);
    await second.connect();
    await second.initializeStudyDb(studyId);
    [storageEngine, second].forEach((engine) => {
      // @ts-expect-error Overlap starts without trusting browser leases.
      engine._runWithLock = async (_key, operation) => operation();
    });
    let failUpload!: () => void;
    let firstUploading!: () => void;
    const firstStarted = new Promise<void>((resolve) => { firstUploading = resolve; });
    // @ts-expect-error Fail the first upload only after the other client has joined.
    vi.spyOn(storageEngine, '_pushToStorage').mockImplementationOnce(async () => {
      firstUploading();
      await new Promise<void>((resolve) => { failUpload = resolve; });
      throw new Error('upload failed');
    });
    let finishSecond!: () => void;
    let secondUploading!: () => void;
    const secondStarted = new Promise<void>((resolve) => { secondUploading = resolve; });
    // @ts-expect-error Control the second upload independently of the first.
    const upload = second._pushToStorage.bind(second);
    // @ts-expect-error Pause after the second reservation but before its upload.
    vi.spyOn(second, '_pushToStorage').mockImplementationOnce(async (path, type, data) => {
      secondUploading();
      if (!successFirst) await new Promise<void>((resolve) => { finishSecond = resolve; });
      return upload(path, type, data);
    });
    const first = storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'same');
    const failed = expect(first).rejects.toThrow('upload failed');
    await firstStarted;
    const retry = second.initializeParticipantSession({}, configSimple, participantMetadata, 'same');
    await secondStarted;
    if (successFirst) await retry;
    failUpload();
    await failed;
    if (!successFirst) finishSecond();
    await retry;
    expect((await storageEngine.getSequenceAssignment(studyId, 'same'))?.rejected).toBe(false);
    expect((await second.getParticipantData('same'))?.rejected).toBe(false);
    await expect(storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'replacement')).rejects.toThrow(/participant limit/i);
  });

  test('an incompatible same-ID start cannot release an existing reservation', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'same');
    // @ts-expect-error Exercise a caller already past the participant-blob lookup.
    await expect(storageEngine._getSequence(undefined, await storageEngine.getModesAndStageData(studyId), configSimple2, 'different')).rejects.toThrow(/different study configuration/);
    expect((await storageEngine.getSequenceAssignment(studyId, 'same'))?.rejected).toBe(false);
  });

  test('stage policy validates the requested study rather than the connected study', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'first');
    await storageEngine.setCurrentStage('other-study', 'DEFAULT');
    await expect(storageEngine.updateStage('other-study', 'DEFAULT', { maxParticipants: 0 })).resolves.toBeUndefined();
    expect((await storageEngine.getStageData('other-study')).allStages[0].maxParticipants).toBe(0);
    await expect(storageEngine.updateStage(studyId, 'DEFAULT', { maxParticipants: 0 })).rejects.toThrow(/already assigned/);
  });

  test('admin restoration can exceed condition targets after config changes', async () => {
    const original: StudyConfig = {
      ...configSimple, uiConfig: { ...configSimple.uiConfig, numSequences: 4 }, factors: { group: ['A'] }, betweenSubjects: ['group'],
    };
    const appended: StudyConfig = { ...original, factors: { group: ['A', 'B'] } };
    await storageEngine.saveConfig(original);
    await storageEngine.setSequenceArray(generateSequenceArray(original));
    await storageEngine.initializeParticipantSession({}, original, participantMetadata, 'rejected');
    await storageEngine.rejectParticipant('rejected', 'test');
    // Keep the rejected slot unclaimed while creating a different active assignment.
    // @ts-expect-error Model a historical source whose place was already claimed.
    await storageEngine._updateSequenceAssignmentFields('rejected', { claimed: true });
    await storageEngine.initializeParticipantSession({}, original, participantMetadata, 'active');
    // @ts-expect-error Make the rejected assignment restorable again.
    await storageEngine._updateSequenceAssignmentFields('rejected', { claimed: false });
    await storageEngine.saveConfig(appended);
    await storageEngine.updateStage(studyId, 'DEFAULT', { maxParticipants: 2, participantAssignmentMode: 'even' });
    // @ts-expect-error Check the transaction itself, independently of the shared precheck.
    await storageEngine._undoRejectParticipantRealtime('rejected');
    expect((await storageEngine.getSequenceAssignment(studyId, 'rejected'))?.rejected).toBe(false);
    expect((await storageEngine.getAllSequenceAssignments(studyId)).filter((assignment) => !assignment.rejected)).toHaveLength(2);
  });

  test('an older config cannot overwrite conditions appended after its config save', async () => {
    const original: StudyConfig = {
      ...configSimple, uiConfig: { ...configSimple.uiConfig, numSequences: 4 }, factors: { group: ['A'] }, betweenSubjects: ['group'],
    };
    const appended: StudyConfig = { ...original, factors: { group: ['A', 'B'] } };
    await storageEngine.saveConfig(original);
    await storageEngine.setSequenceArray(generateSequenceArray(original));
    await storageEngine.initializeParticipantSession({}, original, participantMetadata, 'first');
    await storageEngine.saveConfig(appended);
    // @ts-expect-error Simulate an older caller that has already finished saveConfig.
    storageEngine.currentParticipantId = 'old-config';
    // @ts-expect-error The allocation-stage registry still predates the appended config.
    await expect(storageEngine._getSequence(undefined, await storageEngine.getModesAndStageData(studyId), original, await hash(JSON.stringify(original)))).rejects.toThrow(/condition/i);
    expect((await storageEngine.getAllSequenceAssignments(studyId)).filter((assignment) => !assignment.rejected)).toHaveLength(1);
  });

  test('releases literal participant lock keys containing periods', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'subject.1');
    expect(Object.values(firestoreData).some((data) => Object.hasOwn(data, 'participant-subject.1'))).toBe(false);
    await expect(storageEngine.updateParticipantMetadata(participantMetadata)).resolves.toBeUndefined();
  });

  test('a failed lock release preserves a successfully saved participant and its reservation', async () => {
    const original = vi.mocked(runTransaction).getMockImplementation()!;
    let failed = false;
    vi.mocked(runTransaction).mockImplementation(async (db, callback) => original(db, async (transaction) => {
      const wrapped = Object.create(transaction) as typeof transaction;
      wrapped.update = ((...args: Parameters<typeof transaction.update>) => {
        if (!failed && String((args[1] as unknown as { key?: string }).key).startsWith('participant-')) {
          failed = true;
          throw new Error('Simulated release failure');
        }
        return transaction.update(...args);
      }) as typeof transaction.update;
      return callback(wrapped);
    }));
    try {
      const participant = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'saved');
      expect(failed).toBe(true);
      expect((await storageEngine.getSequenceAssignment(studyId, participant.participantId))?.rejected).toBe(false);
      expect((await storageEngine.getParticipantData(participant.participantId))?.rejected).toBe(false);
    } finally {
      vi.mocked(runTransaction).mockImplementation(original);
    }
  });

  test('completion winning after the timeout check remains completed and unrejected', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'finishing');
    // @ts-expect-error Inject completion after the UI/storage precheck but before the timeout transaction.
    const read = storageEngine._getSequenceAssignment.bind(storageEngine);
    // @ts-expect-error Exercise an overlapping writer independently of the browser lease.
    vi.spyOn(storageEngine, '_getSequenceAssignment').mockImplementationOnce(async (participantId: string) => {
      const previous = await read(participantId);
      // @ts-expect-error Simulate completion from the participant's other session.
      await storageEngine._completeCurrentParticipantRealtime();
      return previous;
    });
    await storageEngine.timeoutParticipant('finishing');
    const assignment = await storageEngine.getSequenceAssignment(studyId, 'finishing');
    expect(assignment?.completed).not.toBeNull();
    expect(assignment?.rejected).toBe(false);
    expect((await storageEngine.getParticipantData('finishing'))?.rejected).toBe(false);
  });

  test('does not repeatedly scan fully unkeyed legacy history with timeout disabled', async () => {
    await storageEngine.setCurrentStage(studyId, 'LEGACY', '#00AAFF');
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'legacy-occupant');
    const assignment = (await storageEngine.getSequenceAssignment(studyId, 'legacy-occupant'))!;
    delete assignment.sequenceKey;
    delete assignment.sequenceIndex;
    // @ts-expect-error Seed a fully unkeyed record from an older study.
    await storageEngine._createSequenceAssignment('legacy-occupant', assignment);
    Object.keys(firestoreData).filter((path) => path.startsWith(`dev-${studyId}/allocation/stages/`)).forEach((path) => { delete firestoreData[path]; });
    vi.mocked(getDocsFromServer).mockClear();
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'first-newcomer');
    expect(getDocsFromServer).toHaveBeenCalledTimes(1);
    vi.mocked(getDocsFromServer).mockClear();
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'second-newcomer');
    expect(getDocsFromServer).not.toHaveBeenCalled();
  });

  test('refuses a full legacy stage before downloading row history', async () => {
    await storageEngine.setCurrentStage(studyId, 'FULL', '#00AAFF', 1);
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'occupant');
    const assignment = (await storageEngine.getSequenceAssignment(studyId, 'occupant'))!;
    delete assignment.sequenceKey;
    // @ts-expect-error Seed a supported legacy record with a saved index.
    await storageEngine._createSequenceAssignment('occupant', assignment);
    Object.keys(firestoreData).filter((path) => path.startsWith(`dev-${studyId}/allocation/stages/`)).forEach((path) => { delete firestoreData[path]; });
    vi.mocked(getDocsFromServer).mockClear();
    await expect(storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'refused')).rejects.toThrow(/participant limit/);
    expect(getDocsFromServer).not.toHaveBeenCalled();
  });

  test('requires a fresh stage for fully unkeyed legacy assignments', async () => {
    await storageEngine.setCurrentStage(studyId, 'LEGACY', '#00AAFF');
    const existing = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'legacy-order');
    const assignment = (await storageEngine.getSequenceAssignment(studyId, existing.participantId))!;
    delete assignment.sequenceKey;
    delete assignment.sequenceIndex;
    // @ts-expect-error Seed a fully unkeyed legacy record without reading answers.
    await storageEngine._createSequenceAssignment(existing.participantId, assignment);
    await expect(storageEngine.setAutoTimeoutMinutes(studyId, 1)).rejects.toThrow('Create and activate a new stage');
    expect((await storageEngine.getModes(studyId)).autoTimeoutMinutes).toBeUndefined();
    await storageEngine.setMode(studyId, 'dataCollectionEnabled', false);
    await storageEngine.setAutoTimeoutMinutes(studyId, 1);
    await expect(storageEngine.setMode(studyId, 'dataCollectionEnabled', true)).rejects.toThrow('Create and activate a new stage');
    expect((await storageEngine.getModes(studyId)).dataCollectionEnabled).toBe(false);
    await storageEngine.setAutoTimeoutMinutes(studyId, undefined);
    await storageEngine.setMode(studyId, 'dataCollectionEnabled', true);
    firestoreData[`dev-${studyId}/modes`].autoTimeoutMinutes = 1;
    // @ts-expect-error Mock the backend clock, not the participant clock.
    vi.spyOn(storageEngine, '_getServerTimeMs').mockResolvedValue(Date.now());
    // Shell activates the deployed config before resuming saved participants.
    await storageEngine.saveConfig({ ...configSimple, studyMetadata: { ...configSimple.studyMetadata, title: 'Updated title' } });
    await storageEngine.saveConfig(configSimple);
    await storageEngine.setSequenceArray(generateSequenceArray(configSimple));
    await expect(storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'blocked-newcomer')).rejects.toThrow('Create and activate a new stage');
    expect((await storageEngine.getSequenceAssignment(studyId, existing.participantId))?.autoTimedOutAt).toBeUndefined();
    await expect(storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, existing.participantId)).resolves.toMatchObject({ participantId: existing.participantId });
    await storageEngine.setAutoTimeoutMinutes(studyId, undefined);
    await storageEngine.setCurrentStage(studyId, 'FRESH', '#00FFAA');
    await storageEngine.setAutoTimeoutMinutes(studyId, 1);
    await expect(storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'fresh-newcomer')).resolves.toMatchObject({ participantId: 'fresh-newcomer' });
    await expect(storageEngine.setCurrentStage(studyId, 'LEGACY', '#00AAFF')).rejects.toThrow('Create and activate a new stage');
  });

  test.each([
    {
      numSequences: 2, legacy: false, restore: false,
    },
    {
      numSequences: 8, legacy: false, restore: false,
    },
    {
      numSequences: 2, legacy: true, restore: false,
    },
    {
      numSequences: 2, legacy: true, restore: true,
    },
  ])('replaces a timed-out Latin-square order ($numSequences rows, legacy: $legacy, restored: $restore)', async ({
    numSequences, legacy, restore,
  }) => {
    if (restore) {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-03-15T00:00:00Z'));
    }
    try {
      const config: StudyConfig = {
        ...configSimple,
        uiConfig: { ...configSimple.uiConfig, numSequences },
        betweenSubjects: [],
        components: { ...configSimple.components, secondComponent: configSimple.components.testComponent },
        sequence: { order: 'latinSquare', components: ['testComponent', 'secondComponent'] },
      };
      await storageEngine.saveConfig(config);
      const prepared = generateSequenceArray(config);
      await storageEngine.setSequenceArray(prepared);
      await storageEngine.setCurrentStage(studyId, 'LIMITED', '#00AAFF', 2);
      await storageEngine.initializeParticipantSession({}, config, participantMetadata, 'completed-order');
      expect(await storageEngine.finalizeParticipant()).toEqual({ status: 'complete' });
      if (legacy) {
        const assignment = (await storageEngine.getSequenceAssignment(studyId, 'completed-order'))!;
        delete assignment.sequenceKey;
        // @ts-expect-error Seed a completed legacy assignment without a row key.
        await storageEngine._createSequenceAssignment('completed-order', assignment);
        Object.keys(firestoreData).filter((path) => path.startsWith(`dev-${studyId}/allocation/stages/`)).forEach((path) => { delete firestoreData[path]; });
      }
      const expired = await storageEngine.initializeParticipantSession({}, config, participantMetadata, 'expired-order');
      // @ts-expect-error protected backend mutation
      await storageEngine._markSequenceAssignmentTimedOut(expired.participantId, Date.now());
      if (restore) {
        expect((await storageEngine.createSnapshot(studyId, false)).status).toBe('SUCCESS');
        const [snapshot] = Object.keys(await storageEngine.getSnapshots(studyId));
        vi.setSystemTime(new Date('2026-03-15T00:00:01Z'));
        expect((await storageEngine.restoreSnapshot(studyId, snapshot)).status).toBe('SUCCESS');
        // Startup prepares the configured orders again after restoring live data.
        await storageEngine.saveConfig(config);
        await storageEngine.setSequenceArray(prepared);
      }
      const replacement = await storageEngine.initializeParticipantSession({}, config, participantMetadata, 'replacement-order');
      expect(replacement.sequence.components).toEqual(expired.sequence.components);
      expect(await storageEngine.finalizeParticipant()).toEqual({ status: 'complete' });
      await storageEngine.initializeParticipantSession({}, config, participantMetadata, expired.participantId);
      expect(await storageEngine.finalizeParticipant()).toEqual({ status: 'complete' });
      expect((await storageEngine.getSequenceAssignment(studyId, expired.participantId))?.rejected).toBe(false);
      // @ts-expect-error Verify that late completion does not reclaim capacity.
      const allocation = await storageEngine.getStageAllocation('LIMITED');
      expect(allocation.count).toBe(2);
      if (!legacy) expect(Object.values(allocation.rowCounts).sort()).toEqual([1, 1]);
    } finally {
      if (restore) vi.useRealTimers();
    }
  });

  test('an automatic timeout winning during manual timeout upload preserves late completion', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'auto-expired');
    // @ts-expect-error protected upload boundary
    const upload = storageEngine._pushToStorage.bind(storageEngine);
    // @ts-expect-error Simulate the automatic sweep while the manual upload is in flight.
    vi.spyOn(storageEngine, '_pushToStorage').mockImplementationOnce(async (path, type, data) => {
      // @ts-expect-error protected backend mutation
      await storageEngine._markSequenceAssignmentTimedOut('auto-expired', Date.now());
      return upload(path, type, data);
    });
    await storageEngine.timeoutParticipant('auto-expired');
    const assignment = await storageEngine.getSequenceAssignment(studyId, 'auto-expired');
    expect(assignment?.autoTimedOutAt).toBeDefined();
    expect(assignment?.rejected).toBe(false);
    expect((await storageEngine.getParticipantData('auto-expired'))?.rejected).toBe(false);
    expect(await storageEngine.finalizeParticipant()).toEqual({ status: 'complete' });
    // Explicit rejection remains available for a participant whose allocation timed out.
    await storageEngine.rejectParticipant('auto-expired', 'Explicit rejection');
    expect((await storageEngine.getSequenceAssignment(studyId, 'auto-expired'))?.rejected).toBe(true);
  });

  test('a completed participant cannot be timed out by an older admin snapshot', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'finished');
    await storageEngine.finalizeParticipant();
    await storageEngine.timeoutParticipant('finished');
    expect((await storageEngine.getSequenceAssignment(studyId, 'finished'))?.rejected).toBe(false);
  });

  test('concurrent preparation returns one saved array and reuses it during startup', async () => {
    const configHash = await hash(JSON.stringify(configSimple));
    const second = new FirebaseStorageEngine(true);
    await second.connect();
    await second.initializeStudyDb(studyId);
    const canonical = generateSequenceArray(configSimple);
    let release!: () => void;
    let uploading!: () => void;
    const started = new Promise<void>((resolve) => { uploading = resolve; });
    // @ts-expect-error Pause publication while the other client observes the missing array.
    const upload = storageEngine._pushToStorage.bind(storageEngine);
    // @ts-expect-error Exercise the actual distributed lock.
    vi.spyOn(storageEngine, '_pushToStorage').mockImplementationOnce(async (path, type, data) => {
      uploading();
      await new Promise<void>((resolve) => { release = resolve; });
      return upload(path, type, data);
    });
    const first = storageEngine.getOrCreateSequenceArray(configHash, () => canonical);
    await started;
    let sawMissing!: () => void;
    const missing = new Promise<void>((resolve) => { sawMissing = resolve; });
    const read = second.getSequenceArray.bind(second);
    vi.spyOn(second, 'getSequenceArray').mockImplementationOnce(async (version) => {
      const result = await read(version);
      expect(result).toBeNull();
      sawMissing();
      return result;
    });
    const competingGenerator = vi.fn(() => generateSequenceArray(configSimple2));
    const retry = second.getOrCreateSequenceArray(configHash, competingGenerator);
    await missing;
    release();
    expect(await first).toEqual(canonical);
    const prepared = await retry;
    expect(prepared).toEqual(canonical);
    expect(competingGenerator).not.toHaveBeenCalled();
    expect(await storageEngine.getSequenceArray(configHash)).toEqual(canonical);
    const modesDocument = await second.getModes(studyId);
    const readSpy = vi.spyOn(second, 'getSequenceArray');
    readSpy.mockClear();
    const session = await second.initializeParticipantSession({}, configSimple, participantMetadata, 'prepared', { modesDocument, sequenceArray: prepared });
    expect(canonical).toContainEqual(session.sequence);
    expect(readSpy).not.toHaveBeenCalled();
  });

  test.each([false, true])('failed sequence reads cannot replace published orders (locked recheck: %s)', async (lockedRecheck) => {
    const configHash = await hash(JSON.stringify(configSimple));
    const canonical = generateSequenceArray(configSimple);
    await storageEngine.setSequenceArray(canonical, configHash);
    if (lockedRecheck) vi.spyOn(storageEngine, 'getSequenceArray').mockResolvedValueOnce(null);
    const generate = vi.fn(() => generateSequenceArray(configSimple2));
    // @ts-expect-error Failed reads must never result in a replacement upload.
    const upload = vi.spyOn(storageEngine, '_pushToStorage');
    failSequenceReads = true;
    try {
      await expect(storageEngine.getOrCreateSequenceArray(configHash, generate)).rejects.toMatchObject({ message: 'Storage unavailable' });
    } finally {
      failSequenceReads = false;
    }
    expect(generate).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(await storageEngine.getSequenceArray(configHash)).toEqual(canonical);
  });

  test('existing prepared arrays skip the publication lock and generation', async () => {
    const configHash = await hash(JSON.stringify(configSimple));
    const canonical = generateSequenceArray(configSimple);
    await storageEngine.setSequenceArray(canonical, configHash);
    const generate = vi.fn(() => generateSequenceArray(configSimple2));
    // @ts-expect-error Existing arrays must take the normal read path without a lock.
    const lock = vi.spyOn(storageEngine, '_runWithLock');
    expect(await storageEngine.getOrCreateSequenceArray(configHash, generate)).toEqual(canonical);
    expect(generate).not.toHaveBeenCalled();
    expect(lock).not.toHaveBeenCalled();
  });

  test('failed publication releases the preparation lock for a retry', async () => {
    const configHash = await hash(JSON.stringify(configSimple));
    const canonical = generateSequenceArray(configSimple);
    // @ts-expect-error A failed first upload must not leave the preparation lock held.
    vi.spyOn(storageEngine, '_pushToStorage').mockRejectedValueOnce(new Error('upload failed'));
    await expect(storageEngine.getOrCreateSequenceArray(configHash, () => canonical)).rejects.toThrow('upload failed');
    await expect(storageEngine.getOrCreateSequenceArray(configHash, () => canonical)).resolves.toEqual(canonical);
  });

  test('a restored participant reloads past a cached rejection and saves answers', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'restored-cache');
    const admin = new FirebaseStorageEngine(true);
    await admin.connect();
    await admin.initializeStudyDb(studyId);
    await admin.timeoutParticipant('restored-cache');
    await storageEngine.saveAnswers({});
    await storageEngine.flushPendingParticipantData();
    expect(storageEngine.getCurrentParticipantDataSnapshot()?.rejected).not.toBe(false);
    await admin.undoRejectParticipant('restored-cache');
    const resumed = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'restored-cache');
    expect(resumed.rejected).toBe(false);
    const answers = { trial_0: makeStoredAnswer({ answer: { value: 'saved after restoration' } }) };
    await storageEngine.saveAnswers(answers);
    await storageEngine.flushPendingParticipantData();
    expect((await storageEngine.getParticipantData('restored-cache'))?.answers).toEqual(answers);
  });

  test('admin restoration overrides limits while new admissions remain closed', async () => {
    const config: StudyConfig = { ...configSimple, factors: { group: ['A'] }, betweenSubjects: ['group'] };
    await storageEngine.saveConfig(config);
    await storageEngine.setSequenceArray(generateSequenceArray(config));
    await storageEngine.initializeParticipantSession({}, config, participantMetadata, 'restored');
    const assignment = await storageEngine.getSequenceAssignment(studyId, 'restored');
    await storageEngine.rejectParticipant('restored', 'test');
    await storageEngine.setStageDesiredParticipants(studyId, 'DEFAULT', assignment!.betweenSubjectsCombinationKey!, 0, {});
    await storageEngine.undoRejectParticipant('restored');
    expect((await storageEngine.getParticipantData('restored'))?.rejected).toBe(false);
    expect((await storageEngine.getSequenceAssignment(studyId, 'restored'))?.rejected).toBe(false);
    expect((await storageEngine.getStageData(studyId)).allStages[0].maxParticipants).toBe(0);
    await storageEngine.updateStage(studyId, 'DEFAULT', { color: '#123456' });
    await expect(storageEngine.initializeParticipantSession({}, config, participantMetadata, 'blocked')).rejects.toThrow(/participant limit/);
  });

  test('a failed config upload leaves the previous condition definitions usable', async () => {
    const original: StudyConfig = {
      ...configSimple, uiConfig: { ...configSimple.uiConfig, numSequences: 4 }, factors: { group: ['A'] }, betweenSubjects: ['group'],
    };
    const appended: StudyConfig = { ...original, factors: { group: ['A', 'B'] } };
    await storageEngine.saveConfig(original);
    await storageEngine.saveConfig(original);
    await storageEngine.setSequenceArray(generateSequenceArray(original));
    await storageEngine.initializeParticipantSession({}, original, participantMetadata, 'first');
    // @ts-expect-error Inject an upload failure after append-only validation.
    vi.spyOn(storageEngine, '_pushToStorage').mockRejectedValueOnce(new Error('config upload failed'));
    await expect(storageEngine.saveConfig(appended)).rejects.toThrow('config upload failed');
    await expect(storageEngine.saveConfig(original)).resolves.toBeUndefined();
    await expect(storageEngine.initializeParticipantSession({}, original, participantMetadata, 'second')).resolves.toBeDefined();
    expect((await storageEngine.getStageData(studyId)).allStages[0].conditionKeys).toHaveLength(1);
  });

  test('failed config activation commits neither the definitions nor the active hash', async () => {
    const original: StudyConfig = { ...configSimple, factors: { group: ['A'] }, betweenSubjects: ['group'] };
    const appended: StudyConfig = { ...original, factors: { group: ['A', 'B'] } };
    await storageEngine.saveConfig(original);
    await storageEngine.setSequenceArray(generateSequenceArray(original));
    await storageEngine.initializeParticipantSession({}, original, participantMetadata, 'first');
    failConfigActivation = true;
    await expect(storageEngine.saveConfig(appended)).rejects.toThrow('Failed to activate study config');
    expect(await storageEngine.getCurrentConfigHash(studyId)).toBe(await hash(JSON.stringify(original)));
    expect((await storageEngine.getStageData(studyId)).allStages[0].conditionKeys).toHaveLength(1);
    await expect(storageEngine.saveConfig(original)).resolves.toBeUndefined();
    await expect(storageEngine.initializeParticipantSession({}, original, participantMetadata, 'second')).resolves.toBeDefined();
  });

  test('a delayed old config cannot overwrite the current config prepared orders', async () => {
    const original: StudyConfig = {
      ...configSimple, uiConfig: { ...configSimple.uiConfig, numSequences: 4 }, factors: { group: ['A'] }, betweenSubjects: ['group'],
    };
    const appended: StudyConfig = { ...original, factors: { group: ['A', 'B'] } };
    const oldHash = await hash(JSON.stringify(original));
    const currentHash = await hash(JSON.stringify(appended));
    await storageEngine.saveConfig(original);
    const oldOrders = generateSequenceArray(original);
    await storageEngine.saveConfig(appended);
    const currentOrders = generateSequenceArray(appended);
    await storageEngine.setSequenceArray(currentOrders, currentHash);
    // Simulate the old startup finishing its upload last.
    await storageEngine.setSequenceArray(oldOrders, oldHash);
    expect(await storageEngine.getSequenceArray()).toEqual(currentOrders);
    await storageEngine.updateStage(studyId, 'DEFAULT', { maxParticipants: 2 });
    const first = await storageEngine.initializeParticipantSession({}, appended, participantMetadata, 'one');
    const second = await storageEngine.initializeParticipantSession({}, appended, participantMetadata, 'two');
    expect(new Set([first.sequence.parameters?.group, second.sequence.parameters?.group]).size).toBe(2);
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
    expect(participantData!.rejected).toBe(false);
    expect(participantData!.participantTags).toEqual([]);
  });

  test('concurrent rejected-slot claims retry the next available vacancy', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'original-a');
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'original-b');
    // @ts-expect-error protected rejection boundary
    await storageEngine._rejectParticipantRealtime('original-a');
    // @ts-expect-error protected rejection boundary
    await storageEngine._rejectParticipantRealtime('original-b');
    const assignment = (await storageEngine.getAllSequenceAssignments(studyId))[0];
    const allocate = (participantId: string) => (
      // @ts-expect-error protected allocation boundary
      storageEngine._allocateSequenceAssignment(participantId, {
        ...assignment, participantId, rejected: false, claimed: false,
      })
    );
    const allocations = await Promise.all([allocate('new-a'), allocate('new-b')]);
    expect(allocations.map((allocation) => allocation.sequenceIndex).sort()).toEqual([0, 1]);
  });

  test('all rejected participants still preserve stage condition history', async () => {
    const original: StudyConfig = { ...configSimple, factors: { group: ['A', 'B'] }, betweenSubjects: ['group'] };
    const changed: StudyConfig = { ...original, factors: { group: ['C', 'D'] } };
    await storageEngine.saveConfig(original);
    await storageEngine.setSequenceArray(generateSequenceArray(original));
    await storageEngine.setCurrentStage(studyId, 'HISTORY', '#00AAFF');
    await storageEngine.initializeParticipantSession({}, original, participantMetadata, 'historical');
    await storageEngine.rejectParticipant('historical', 'review');
    await storageEngine.setCurrentStage(studyId, 'EMPTY', '#00AAFF');
    await storageEngine.saveConfig(changed);
    await storageEngine.setSequenceArray(generateSequenceArray(changed));
    await storageEngine.setCurrentStage(studyId, 'HISTORY', '#00AAFF');
    await storageEngine.saveConfig(changed);
    await expect(storageEngine.initializeParticipantSession({}, changed, participantMetadata, 'blocked-change'))
      .rejects.toThrow(/append|condition/i);
  });

  test('snapshot copies preserve returned allocator slots and high-water marks', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'snapshot-seed');
    firestoreData[`dev-${studyId}/sequenceAssignmentAllocator`] = {
      nextSequenceIndex: 7, nextCreationIndex: 10, availableSequenceIndexes: [1, 3],
    };
    // @ts-expect-error Exercise the realtime portion used by snapshot creation and restoration.
    await storageEngine._copyRealtimeData(`dev-${studyId}`, 'snapshot-copy');
    expect(firestoreData['snapshot-copy/sequenceAssignmentAllocator']).toEqual({
      nextSequenceIndex: 7, nextCreationIndex: 10, availableSequenceIndexes: [1, 3],
    });
    // @ts-expect-error Copy back to the live collection, as snapshot restoration does.
    await storageEngine._copyRealtimeData('snapshot-copy', `dev-${studyId}`);
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'after-snapshot');
    expect(await storageEngine.getSequenceAssignment(studyId, 'after-snapshot'))
      .toMatchObject({ sequenceIndex: 1, creationIndex: 10 });
  });

  test.each(['download', 'json', 'payload'])('failed participant %s reads cannot release a live reservation', async (failure) => {
    await storageEngine.setCurrentStage(studyId, 'READ-FAILURE', '#00AAFF', 1);
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'still-active');
    await storageEngine.clearCurrentParticipantId();
    const path = `dev-${studyId}/participants/still-active_participantData`;
    const saved = storageObjects[path];
    if (failure === 'download') failParticipantReads = true;
    else storageObjects[path] = failure === 'json' ? '{broken' : '{}';
    try {
      await expect(storageEngine.rejectParticipant('still-active', 'review')).rejects.toBeDefined();
    } finally {
      failParticipantReads = false;
      storageObjects[path] = saved;
    }
    expect((await storageEngine.getSequenceAssignment(studyId, 'still-active'))?.rejected).toBe(false);
    expect((await storageEngine.getParticipantData('still-active'))?.rejected).toBe(false);
    await expect(storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'replacement')).rejects.toThrow(/participant limit/);
  });

  test('an orphan recheck read failure leaves the assignment reserved', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'recheck-active');
    await storageEngine.clearCurrentParticipantId();
    // @ts-expect-error Simulate an initially absent blob followed by a failing admission-lock recheck.
    vi.spyOn(storageEngine, '_getFromStorage').mockResolvedValueOnce({});
    failParticipantReads = true;
    try {
      await expect(storageEngine.rejectParticipant('recheck-active', 'review')).rejects.toMatchObject({ message: 'Participant storage unavailable' });
    } finally {
      failParticipantReads = false;
    }
    expect((await storageEngine.getSequenceAssignment(studyId, 'recheck-active'))?.rejected).toBe(false);
    expect((await storageEngine.getParticipantData('recheck-active'))?.rejected).toBe(false);
  });

  test('manual edits discard obsolete conditions and preserve current defaults', async () => {
    const original: StudyConfig = { ...configSimple, factors: { group: ['A', 'B'] }, betweenSubjects: ['group'] };
    const changed: StudyConfig = { ...original, factors: { group: ['C', 'D'] } };
    await storageEngine.saveConfig(original);
    const [a, b, c, d] = ['A', 'B', 'C', 'D'].map((group) => getBetweenSubjectsCombinationKey({ group }, ['group']));
    await storageEngine.setStageDesiredParticipants(studyId, 'DEFAULT', a, 5, { [a]: 5, [b]: 5 });
    await storageEngine.saveConfig(changed);
    // The UI can still hold the previous saved map after the config changes.
    await storageEngine.setStageDesiredParticipants(studyId, 'DEFAULT', c, 6, { [a]: 5, [b]: 5 });
    const stage = (await storageEngine.getStageData(studyId)).allStages[0];
    expect(stage.maxParticipants).toBe(11);
    expect(stage.manualDesiredParticipantsByCombination).toEqual({ [c]: 6, [d]: 5 });
  });

  test('manual edits refresh an empty reactivated stage while protecting enrolled stages', async () => {
    const original: StudyConfig = { ...configSimple, factors: { group: ['A', 'B'] }, betweenSubjects: ['group'] };
    const changed: StudyConfig = { ...original, factors: { group: ['C', 'D'] } };
    const [a, b, c, d] = ['A', 'B', 'C', 'D'].map((group) => getBetweenSubjectsCombinationKey({ group }, ['group']));
    await storageEngine.saveConfig(original);
    await storageEngine.setStageDesiredParticipants(studyId, 'DEFAULT', a, 5, { [a]: 5, [b]: 5 });
    await storageEngine.setCurrentStage(studyId, 'OTHER', '#00AAFF');
    await storageEngine.saveConfig(changed);
    await storageEngine.setCurrentStage(studyId, 'DEFAULT', '#00AAFF');
    await storageEngine.saveConfig(changed);
    await storageEngine.setStageDesiredParticipants(studyId, 'DEFAULT', c, 6, { [a]: 5, [b]: 5 });
    const stage = (await storageEngine.getStageData(studyId)).allStages[0];
    expect(stage).toMatchObject({ maxParticipants: 11, conditionKeys: [c, d], manualDesiredParticipantsByCombination: { [c]: 6, [d]: 5 } });
    await expect(storageEngine.setStageDesiredParticipants(studyId, 'DEFAULT', a, 6, { [a]: 5, [b]: 5 })).rejects.toThrow(/no longer available/);
    await storageEngine.setSequenceArray(generateSequenceArray(changed));
    await storageEngine.initializeParticipantSession({}, changed, participantMetadata, 'enrolled');
    await storageEngine.setCurrentStage(studyId, 'OTHER', '#00AAFF');
    await storageEngine.saveConfig(original);
    await expect(storageEngine.setStageDesiredParticipants(studyId, 'DEFAULT', a, 6, { [a]: 5, [b]: 5 })).rejects.toThrow(/removed or renamed/);
    expect((await storageEngine.getStageData(studyId)).allStages[0]).toEqual(stage);
  });

  test('manual edits stop when the active config cannot be loaded', async () => {
    const config: StudyConfig = { ...configSimple, factors: { group: ['A', 'B'] }, betweenSubjects: ['group'] };
    await storageEngine.saveConfig(config);
    const stage = (await storageEngine.getStageData(studyId)).allStages[0];
    const a = getBetweenSubjectsCombinationKey({ group: 'A' }, ['group']);
    // @ts-expect-error Do not fall back to stale keys if the authoritative config is unavailable.
    vi.spyOn(storageEngine, '_getFromStorage').mockResolvedValueOnce({});
    await expect(storageEngine.setStageDesiredParticipants(studyId, 'DEFAULT', a, 6, { [a]: 5 })).rejects.toThrow(/configuration could not be loaded/);
    expect((await storageEngine.getStageData(studyId)).allStages[0]).toEqual(stage);
  });

  test('analysis receives the assignment start time even when the participant clock is wrong', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'clock-skew');
    const path = `dev-${studyId}/participants/clock-skew_participantData`;
    const participant = JSON.parse(storageObjects[path]);
    storageObjects[path] = JSON.stringify({ ...participant, createdTime: 1 });
    const assignment = await storageEngine.getSequenceAssignment(studyId, 'clock-skew');
    const analysis = (await storageEngine.getAllParticipantsData(studyId))[0];
    expect(analysis.createdTime).toBe(1);
    expect(analysis).toHaveProperty('assignmentCreatedTime', assignment!.createdTime);
    expect(assignment!.createdTime).toBeGreaterThan(1);
  });

  test.each(['.', '..', '__pilot__', '界'.repeat(600), 'A/B'])('stage name %s uses a safe bounded Firestore ID', async (stageName) => {
    await storageEngine.setCurrentStage(studyId, stageName, '#00AAFF', 1);
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'safe-stage');
    const stageDocuments = Object.keys(firestoreData).filter((path) => path.startsWith(`dev-${studyId}/allocation/stages/`));
    expect(stageDocuments.length).toBeGreaterThan(0);
    stageDocuments.forEach((path) => {
      const documentId = path.split('/').at(-1)!;
      expect(['.', '..']).not.toContain(documentId);
      expect(documentId).not.toMatch(/^__.*__$/);
      expect(new TextEncoder().encode(documentId).length).toBeLessThanOrEqual(1500);
    });
    await expect(storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'blocked-stage')).rejects.toThrow(/participant limit/);
  });

  test('stage admission preserves bounded reads and zero-based allocator metadata', async () => {
    const config: StudyConfig = { ...configSimple, factors: { version: ['A', 'B'] }, betweenSubjects: ['version'] };
    await storageEngine.saveConfig(config);
    const prepared = generateSequenceArray(config);
    await storageEngine.setSequenceArray(prepared);
    await storageEngine.setCurrentStage(studyId, 'BOUNDED', '#00AAFF', 10);
    const first = await storageEngine.initializeParticipantSession({}, config, participantMetadata, 'stage-first');
    expect(first.participantIndex).toBe(1);
    expect((await storageEngine.getAllSequenceAssignments(studyId))[0]).toMatchObject({ creationIndex: 0, sequenceIndex: 0 });
    const scans = vi.spyOn(storageEngine, 'getAllSequenceAssignments');
    const serverScans = vi.mocked(getDocsFromServer);
    serverScans.mockClear();
    await storageEngine.saveConfig(config);
    const second = await storageEngine.initializeParticipantSession({}, config, participantMetadata, 'stage-second', { modesDocument: await storageEngine.getModes(studyId), sequenceArray: prepared });
    expect(second.participantIndex).toBe(2);
    expect(scans).not.toHaveBeenCalled();
    expect(serverScans).not.toHaveBeenCalled();
    // @ts-expect-error Inspect the bounded allocation state without a history scan.
    const state = await storageEngine.getStageAllocation('BOUNDED');
    expect(state.count).toBe(2);
    expect(Object.values(state.combinationCounts).sort()).toEqual([1, 1]);
    expect(Object.values(state.rowCounts).reduce((total, count) => total + count, 0)).toBe(2);
  });

  test('a delayed timeout sweep preserves a fresh reservation for the same participant', async () => {
    const first = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'retrying');
    const path = Object.keys(firestoreData).find((key) => key.endsWith(`/sequenceAssignment/${first.participantId}`))!;
    firestoreData[path].createdTime = Timestamp.fromMillis(Date.now() - 120_000);
    await storageEngine.setAutoTimeoutMinutes(studyId, 1);
    // @ts-expect-error Mock the trusted backend clock at the external boundary.
    vi.spyOn(storageEngine, '_getServerTimeMs').mockResolvedValue(Date.now());
    // A failed initial upload can release the old reservation, then a retry
    // replaces it at the same document ID after the sweep selected it.
    // @ts-expect-error protected test seam
    const mark = storageEngine._markSequenceAssignmentTimedOut.bind(storageEngine);
    // @ts-expect-error protected test seam
    vi.spyOn(storageEngine, '_markSequenceAssignmentTimedOut').mockImplementationOnce(async (...args: [string, number, number?]) => {
      firestoreData[path] = {
        ...firestoreData[path],
        createdTime: Timestamp.fromMillis(Date.now()),
        creationIndex: Number(firestoreData[path].creationIndex) + 1,
      };
      return mark(...args);
    });
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'sweeping');
    const assignment = (await storageEngine.getAllSequenceAssignments(studyId)).find((item) => item.participantId === first.participantId);
    expect(assignment?.autoTimedOutAt).toBeUndefined();
  });

  test.each([false, true])('sweeps a timeout backlog without repeated history downloads (legacy stage: %s)', async (legacy) => {
    await storageEngine.saveConfig(configSimple);
    await storageEngine.setSequenceArray(generateSequenceArray(configSimple));
    await storageEngine.setCurrentStage(studyId, 'LIMITED', '#00AAFF', 3);
    for (let index = 0; index < 3; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, `expired-${index}`);
    }
    const serverNow = Date.now();
    Object.entries(firestoreData).forEach(([path, data]) => {
      if (path.includes('/sequenceAssignment/sequenceAssignment/')) data.createdTime = Timestamp.fromMillis(serverNow - 120_000);
      if (legacy && path.includes('/allocation/stages/')) delete firestoreData[path];
    });
    await storageEngine.setAutoTimeoutMinutes(studyId, 1);
    // @ts-expect-error Mock only the external backend clock.
    vi.spyOn(storageEngine, '_getServerTimeMs').mockResolvedValue(serverNow);
    const historyReads = vi.mocked(getDocsFromServer);
    historyReads.mockClear();
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'new-participant');
    expect(historyReads).toHaveBeenCalledTimes(legacy ? 1 : 0);
    if (legacy) {
      expect(historyReads.mock.calls[0][0]).toMatchObject({
        _constraints: expect.arrayContaining([{
          type: 'where', field: 'stage', operator: '==', value: 'LIMITED',
        }]),
      });
    }
    const assignments = await storageEngine.getAllSequenceAssignments(studyId);
    expect(assignments.filter((assignment) => assignment.autoTimedOutAt !== undefined)).toHaveLength(3);
    // @ts-expect-error Inspect persisted allocation counts.
    const allocation = await storageEngine.getStageAllocation('LIMITED');
    expect(allocation.count).toBe(1);
    expect(Object.values(allocation.rowCounts).reduce((total, count) => total + count, 0)).toBe(1);
    expect(Object.values(allocation.combinationCounts).reduce((total, count) => total + count, 0)).toBe(1);
  });

  test('concurrent automatic timeouts release an allocation only once', async () => {
    await storageEngine.setCurrentStage(studyId, 'LIMITED', '#00AAFF', 1);
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'expiring');
    const results = await Promise.all([
      // @ts-expect-error protected backend mutation
      storageEngine._markSequenceAssignmentTimedOut('expiring', Date.now()),
      // @ts-expect-error protected backend mutation
      storageEngine._markSequenceAssignmentTimedOut('expiring', Date.now()),
    ]);
    expect(results.sort()).toEqual([false, true]);
    // @ts-expect-error Inspect persisted allocation counts.
    const allocation = await storageEngine.getStageAllocation('LIMITED');
    expect(allocation.count).toBe(0);
    expect(Object.values(allocation.rowCounts).reduce((total, count) => total + count, 0)).toBe(0);
  });

  test('an auto-timeout frees its slot in the stage allocation', async () => {
    await storageEngine.setCurrentStage(studyId, 'LIMITED', '#ff0000', 1);
    const first = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'timeout-first');
    await expect(storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'timeout-blocked'))
      .rejects.toThrow(/participant limit/);

    // @ts-expect-error protected
    expect(await storageEngine._markSequenceAssignmentTimedOut(first.participantId, Date.now())).toBe(true);
    // @ts-expect-error protected
    expect((await storageEngine.getStageAllocation('LIMITED')).count).toBe(0);
    // A second timeout of the same participant is a no-op and frees nothing more.
    // @ts-expect-error protected
    expect(await storageEngine._markSequenceAssignmentTimedOut(first.participantId, Date.now())).toBe(false);
    // @ts-expect-error protected
    expect((await storageEngine.getStageAllocation('LIMITED')).count).toBe(0);

    const second = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'timeout-second');
    expect(second.participantId).toBe('timeout-second');
    // @ts-expect-error protected
    expect((await storageEngine.getStageAllocation('LIMITED')).count).toBe(1);
  });

  test('fresh stage policy wins over prefetched startup settings', async () => {
    await storageEngine.setCurrentStage(studyId, 'FRESH', '#00AAFF', 2);
    const modesDocument = await storageEngine.getModes(studyId);
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'admitted');
    await storageEngine.updateStage(studyId, 'FRESH', { maxParticipants: 1 });
    await expect(storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'blocked', { modesDocument, sequenceArray }))
      .rejects.toThrow(/participant limit/);
  });

  test('fresh participant startup does not scan all sequence assignments', async () => {
    const scanSpy = vi.spyOn(storageEngine, 'getAllSequenceAssignments');
    const countMock = vi.mocked(getCountFromServer);
    const getDocsMock = vi.mocked(getDocs);
    const transactionMock = vi.mocked(runTransaction);
    countMock.mockClear();
    getDocsMock.mockClear();
    transactionMock.mockClear();

    const participant = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    expect(scanSpy).not.toHaveBeenCalled();
    expect(countMock).toHaveBeenCalledTimes(4);
    expect(getDocsMock).toHaveBeenCalledTimes(2);
    expect(transactionMock).toHaveBeenCalledTimes(8);

    const getDocMock = vi.mocked(getDoc);
    getDocMock.mockClear();
    countMock.mockClear();
    getDocsMock.mockClear();
    transactionMock.mockClear();
    await storageEngine.getParticipantCompletionStatus(participant.participantId);
    expect(scanSpy).not.toHaveBeenCalled();
    expect(getDocMock).toHaveBeenCalledTimes(1);
    expect(countMock).not.toHaveBeenCalled();
    expect(getDocsMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  test('fresh participant startup with an initialized allocator skips legacy counts', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'allocator-seed');
    await storageEngine.clearCurrentParticipantId();

    const scanSpy = vi.spyOn(storageEngine, 'getAllSequenceAssignments');
    const countMock = vi.mocked(getCountFromServer);
    const getDocsMock = vi.mocked(getDocs);
    const transactionMock = vi.mocked(runTransaction);
    countMock.mockClear();
    getDocsMock.mockClear();
    transactionMock.mockClear();

    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'post-seed');

    expect(scanSpy).not.toHaveBeenCalled();
    expect(countMock).not.toHaveBeenCalled();
    expect(getDocsMock).toHaveBeenCalledTimes(2);
    expect(transactionMock).toHaveBeenCalledTimes(6);
  });

  test('returning legacy assignment derives its indexes without an assignment scan', async () => {
    const createAssignment = (
      storageEngine as unknown as {
        _createSequenceAssignment: (
          participantId: string,
          assignment: SequenceAssignment,
          withServerTimestamp: boolean,
        ) => Promise<void>;
      }
    )._createSequenceAssignment.bind(storageEngine);
    await createAssignment('legacy-returning', {
      participantId: 'legacy-returning',
      timestamp: 1,
      rejected: false,
      claimed: false,
      completed: null,
      createdTime: 1,
      total: 0,
      answered: [],
      isDynamic: false,
      stage: 'DEFAULT',
    }, false);

    const scanSpy = vi.spyOn(storageEngine, 'getAllSequenceAssignments');
    const countMock = vi.mocked(getCountFromServer);
    const getDocsMock = vi.mocked(getDocs);
    const transactionMock = vi.mocked(runTransaction);
    countMock.mockClear();
    getDocsMock.mockClear();
    transactionMock.mockClear();

    const participant = await storageEngine.initializeParticipantSession(
      {},
      configSimple,
      participantMetadata,
      'legacy-returning',
    );

    expect(participant.participantIndex).toBe(1);
    expect(scanSpy).not.toHaveBeenCalled();
    expect(countMock).toHaveBeenCalledTimes(3);
    expect(getDocsMock).not.toHaveBeenCalled();
    expect(transactionMock).toHaveBeenCalledTimes(6);
  });

  test.each([false, true])('legacy mixed timestamps preserve the sequence slot (returning: %s)', async (returning) => {
    sequenceArray = [sequenceArray[0], {
      ...sequenceArray[0], components: [...sequenceArray[0].components].reverse(),
    }];
    await storageEngine.setSequenceArray(sequenceArray);
    const assignment: SequenceAssignment = {
      participantId: 'earlier',
      timestamp: 1000,
      createdTime: 1000,
      rejected: false,
      claimed: false,
      completed: null,
      total: 0,
      answered: [],
      isDynamic: false,
      stage: 'DEFAULT',
    };
    const path = `dev-${studyId}/sequenceAssignment/sequenceAssignment`;
    firestoreData[`${path}/earlier`] = {
      ...assignment, timestamp: new Timestamp(1, 0), createdTime: new Timestamp(1, 0),
    };
    firestoreData[`${path}/legacy`] = {
      ...assignment,
      participantId: 'legacy',
      timestamp: 2000,
      createdTime: new Timestamp(2, 0),
      rejected: !returning,
    };

    const participant = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, returning ? 'legacy' : 'replacement');

    expect(participant.sequence).toEqual(sequenceArray[1]);
    expect(participant.participantIndex).toBe(returning ? 2 : 3);
  });

  test('legacy rejected-slot selection compares numeric and Firestore timestamps chronologically', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'seed');
    await storageEngine.clearCurrentParticipantId();
    const path = `dev-${studyId}/sequenceAssignment/sequenceAssignment`;
    const assignment = firestoreData[`${path}/seed`];
    firestoreData[`${path}/older`] = {
      ...assignment, participantId: 'older', timestamp: new Timestamp(1, 0), rejected: true, sequenceIndex: 1,
    };
    firestoreData[`${path}/newer`] = {
      ...assignment, participantId: 'newer', timestamp: 2000, rejected: true, sequenceIndex: 2,
    };

    const participant = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'replacement');

    expect(participant.sequence).toEqual(sequenceArray[1]);
    expect(firestoreData[`${path}/older`].claimed).toBe(true);
    expect(firestoreData[`${path}/newer`].claimed).toBe(false);
  });

  test('rejecting a legacy replacement initializes the missing allocator', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'original');
    await storageEngine.rejectParticipant('original', 'test');
    await storageEngine.clearCurrentParticipantId();
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'replacement');
    delete firestoreData[`dev-${studyId}/sequenceAssignmentAllocator`];
    const path = `dev-${studyId}/sequenceAssignment/sequenceAssignment`;
    delete firestoreData[`${path}/original`].sequenceIndex;
    delete firestoreData[`${path}/replacement`].sequenceIndex;
    delete firestoreData[`${path}/original`].creationIndex;
    delete firestoreData[`${path}/replacement`].creationIndex;

    await storageEngine.rejectParticipant('replacement', 'test');

    expect(firestoreData[`${path}/original`].claimed).toBe(false);
    expect(firestoreData[`${path}/replacement`].rejected).toBe(true);
    expect(firestoreData[`${path}/replacement`].reusableSequenceIndex).toBe(1);
    expect(firestoreData[`dev-${studyId}/sequenceAssignmentAllocator`]).toEqual({
      nextSequenceIndex: 2, nextCreationIndex: 2,
    });
  });

  test('legacy rejected-slot reuse uses bounded counts instead of an assignment scan', async () => {
    const createAssignment = (
      storageEngine as unknown as {
        _createSequenceAssignment: (
          participantId: string,
          assignment: SequenceAssignment,
          withServerTimestamp: boolean,
        ) => Promise<void>;
      }
    )._createSequenceAssignment.bind(storageEngine);
    for (let index = 0; index < 5; index += 1) {
      // Sequential writes intentionally build a deterministic legacy assignment history.
      // eslint-disable-next-line no-await-in-loop
      await createAssignment(`legacy-${index}`, {
        participantId: `legacy-${index}`,
        timestamp: index,
        rejected: index === 1,
        claimed: false,
        completed: null,
        createdTime: index,
        total: 0,
        answered: [],
        isDynamic: false,
        stage: 'DEFAULT',
      }, false);
    }

    const scanSpy = vi.spyOn(storageEngine, 'getAllSequenceAssignments');
    const countMock = vi.mocked(getCountFromServer);
    countMock.mockClear();

    const participant = await storageEngine.initializeParticipantSession(
      {},
      configSimple,
      participantMetadata,
      'legacy-replacement',
    );

    expect(participant.sequence).toEqual(sequenceArray[1]);
    expect(scanSpy).not.toHaveBeenCalled();
    expect(countMock).toHaveBeenCalledTimes(4);
  });

  test('rejected-slot reuse selects the earliest assignment timestamp', async () => {
    const createAssignment = (
      storageEngine as unknown as {
        _createSequenceAssignment: (
          participantId: string,
          assignment: SequenceAssignment,
          withServerTimestamp: boolean,
        ) => Promise<void>;
      }
    )._createSequenceAssignment.bind(storageEngine);
    const rejectedAssignment = (
      participantId: string,
      timestamp: number,
      sequenceIndex: number,
    ): SequenceAssignment => ({
      participantId,
      timestamp,
      rejected: true,
      claimed: false,
      completed: null,
      createdTime: timestamp,
      total: 0,
      answered: [],
      isDynamic: false,
      stage: 'DEFAULT',
      sequenceIndex,
      creationIndex: sequenceIndex,
    });
    await createAssignment('newer-rejected', rejectedAssignment('newer-rejected', 20, 1), false);
    await createAssignment('older-rejected', rejectedAssignment('older-rejected', 10, 0), false);

    const participant = await storageEngine.initializeParticipantSession(
      {},
      configSimple,
      participantMetadata,
      'ordered-replacement',
    );
    const assignments = await storageEngine.getAllSequenceAssignments(studyId);

    expect(participant.sequence).toEqual(sequenceArray[0]);
    expect(assignments.find(({ participantId }) => participantId === 'older-rejected')?.claimed).toBe(true);
    expect(assignments.find(({ participantId }) => participantId === 'newer-rejected')?.claimed).toBe(false);
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

  test('concurrent participant starts reserve unique sequence and creation indexes', async () => {
    const engines = Array.from({ length: 12 }, () => new TestEngine(true));
    await Promise.all(engines.map(async (engine) => {
      await engine.connect();
      await engine.initializeStudyDb(studyId);
    }));

    const sessions = await Promise.all(engines.map((engine, index) => (
      engine.initializeParticipantSession(
        {},
        configSimple,
        participantMetadata,
        `concurrent-${index}`,
      )
    )));
    const assignments = (await storageEngine.getAllSequenceAssignments(studyId))
      .filter((assignment) => assignment.participantId.startsWith('concurrent-'));

    expect(new Set(assignments.map((assignment) => assignment.sequenceIndex)).size).toBe(12);
    expect(assignments.map((assignment) => assignment.sequenceIndex).sort((a, b) => a! - b!))
      .toEqual(Array.from({ length: 12 }, (_, index) => index));
    expect(new Set(sessions.map((session) => session.participantIndex)).size).toBe(12);
    expect(sessions.map((session) => session.participantIndex).sort((a, b) => a - b))
      .toEqual(Array.from({ length: 12 }, (_, index) => index + 1));
  });

  test('initializeParticipantSession omits conditions field in sequence assignment when empty', async () => {
    const participant = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    const assignment = await storageEngine.getSequenceAssignment(studyId, participant.participantId);
    expect(Object.hasOwn(assignment!, 'conditions')).toBe(false);
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
    expect(sequenceAssignment1!.claimed).toBe(false);
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
    expect(new Set([
      sequenceAssignment3!.sequenceIndex,
      sequenceAssignment4!.sequenceIndex,
    ]).size).toBe(2);

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

  test('_rejectParticipantRealtime clears the claimed assignment when reused timestamps are stored as Firestore Timestamps', async () => {
    const participantSession = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    const { participantId: participantId1 } = participantSession;

    await storageEngine.rejectParticipant(participantId1, 'Participant rejected for testing');
    await storageEngine.clearCurrentParticipantId();

    const newParticipantSession = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    const participantId2 = newParticipantSession.participantId;

    const participant1Path = Object.keys(firestoreData).find((path) => path.endsWith(`/sequenceAssignment/${participantId1}`));
    const participant2Path = Object.keys(firestoreData).find((path) => path.endsWith(`/sequenceAssignment/${participantId2}`));

    if (!participant1Path || !participant2Path) {
      throw new Error('Expected both sequence assignment docs to exist');
    }

    firestoreData[participant1Path].timestamp = new Timestamp(1, 0);
    firestoreData[participant2Path].timestamp = new Timestamp(1, 0);

    // @ts-expect-error protected
    await storageEngine._rejectParticipantRealtime(participantId2);

    const sequenceAssignments = await storageEngine.getAllSequenceAssignments(studyId);
    const sequenceAssignment1 = sequenceAssignments.find((assignment) => assignment.participantId === participantId1);
    const sequenceAssignment2 = sequenceAssignments.find((assignment) => assignment.participantId === participantId2);

    expect(sequenceAssignment1).toBeDefined();
    expect(sequenceAssignment1!.rejected).toBe(true);
    expect(sequenceAssignment1!.claimed).toBe(false);
    expect(sequenceAssignment2).toBeDefined();
    expect(sequenceAssignment2!.rejected).toBe(true);
    expect(sequenceAssignment2!.claimed).toBe(false);
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

  test('clearing live data resets participant allocation', async () => {
    const first = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'before-clear');
    expect(first.participantIndex).toBe(1);

    expect((await storageEngine.removeSnapshotOrLive(studyId, studyId)).status).toBe('SUCCESS');
    await storageEngine.setSequenceArray(sequenceArray);
    const next = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'after-clear');

    expect(next.participantIndex).toBe(1);
    const assignments = await storageEngine.getAllSequenceAssignments(studyId);
    expect(assignments).toHaveLength(1);
    expect(assignments[0].sequenceIndex).toBe(0);
  });

  test('clearing live data allows the unchanged config to be saved again', async () => {
    await storageEngine.saveConfig(configSimple);
    const configHash = await hash(JSON.stringify(configSimple));

    expect((await storageEngine.removeSnapshotOrLive(studyId, studyId)).status).toBe('SUCCESS');
    await storageEngine.saveConfig(configSimple);

    const configs = await storageEngine.getAllConfigsFromHash([configHash], studyId);
    expect(configs[configHash]).toEqual(configSimple);
  });

  test.each([false, true])('restoring a snapshot resumes its allocation (legacy: %s)', async (legacy) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    try {
      await storageEngine.saveConfig(configSimple);
      await storageEngine.setSequenceArray(sequenceArray);
      // Older snapshots can contain offset indexes after live data was cleared.
      if (legacy) {
        firestoreData[`dev-${studyId}/sequenceAssignmentAllocator`] = {
          nextSequenceIndex: 3, nextCreationIndex: 3,
        };
      }
      for (let index = 0; index < 3; index += 1) {
        // eslint-disable-next-line no-await-in-loop
        await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, `snapshot-${index}`);
      }
      expect((await storageEngine.createSnapshot(studyId, false)).status).toBe('SUCCESS');
      const [snapshotName] = Object.keys(await storageEngine.getSnapshots(studyId));
      if (legacy) delete firestoreData[`${snapshotName}/sequenceAssignmentAllocator`];
      expect(firestoreData[`${snapshotName}/sequenceAssignmentAllocator`]).toEqual(legacy ? undefined : {
        nextSequenceIndex: 3, nextCreationIndex: 3,
      });

      await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'after-snapshot');
      vi.setSystemTime(new Date('2026-01-01T00:00:01Z'));
      expect((await storageEngine.restoreSnapshot(studyId, snapshotName)).status).toBe('SUCCESS');
      const next = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'after-restore');

      expect(next.participantIndex).toBe(legacy ? 7 : 4);
      const assignments = await storageEngine.getAllSequenceAssignments(studyId);
      expect(assignments).toHaveLength(4);
      expect(assignments.find(({ participantId }) => participantId === 'after-restore')?.sequenceIndex).toBe(legacy ? 6 : 3);
    } finally {
      vi.useRealTimers();
    }
  });

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

  test.each([false, true])('concurrent duplicate rejection reserves one vacancy (legacy: %s)', async (legacy) => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'original');
    await storageEngine.flushPendingParticipantData();
    await storageEngine.rejectParticipant('original', 'review');
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'replacement');
    await storageEngine.flushPendingParticipantData();
    if (legacy) {
      const replacement = (await storageEngine.getAllSequenceAssignments(studyId))
        .find((assignment) => assignment.participantId === 'replacement')!;
      delete replacement.claimedParticipantId;
      // @ts-expect-error protected storage boundary
      await storageEngine._createSequenceAssignment('replacement', replacement, false);
    }
    await Promise.all([
      storageEngine.rejectParticipant('replacement', 'review'),
      storageEngine.rejectParticipant('replacement', 'review'),
    ]);
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'next-a');
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'next-b');
    const assignments = await storageEngine.getAllSequenceAssignments(studyId);
    expect(assignments.find((assignment) => assignment.participantId === 'replacement')?.reusableSequenceIndex).toBe(1);
    expect(assignments.find((assignment) => assignment.participantId === 'next-a')?.sequenceIndex).toBe(0);
    expect(assignments.find((assignment) => assignment.participantId === 'next-b')?.sequenceIndex).toBe(1);
  });

  test('undo rejection returns an unused replacement slot exactly once', async () => {
    const rows = [
      { ...sequenceArray[0], parameters: { row: 'first' } },
      { ...sequenceArray[0], parameters: { row: 'second' } },
    ];
    await storageEngine.setSequenceArray(rows);
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'original');
    await storageEngine.rejectParticipant('original', 'review');
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'replacement');
    await storageEngine.rejectParticipant('replacement', 'review');
    await storageEngine.undoRejectParticipant('replacement');
    await storageEngine.undoRejectParticipant('replacement');
    const next = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'next');
    expect(next.sequence.parameters?.row).toBe('second');
    const following = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'following');
    expect(following.sequence.parameters?.row).toBe('first');
  });

  test('restoration waits for source ownership and returns its unused allocator slot', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'original');
    await storageEngine.rejectParticipant('original', 'review');
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'replacement');
    await storageEngine.rejectParticipant('replacement', 'review');
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'reuse-original');
    await expect(storageEngine.undoRejectParticipant('replacement')).rejects.toThrow(/reassigned/);
    await storageEngine.rejectParticipant('reuse-original', 'review');
    await storageEngine.undoRejectParticipant('replacement');
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'reuse-again');
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'returned-slot');
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'fresh-slot');
    const assignments = await storageEngine.getAllSequenceAssignments(studyId);
    expect(assignments.find((assignment) => assignment.participantId === 'returned-slot'))
      .toMatchObject({ sequenceIndex: 1, creationIndex: 4 });
    expect(assignments.find((assignment) => assignment.participantId === 'fresh-slot'))
      .toMatchObject({ sequenceIndex: 3, creationIndex: 5 });
    const active = assignments.filter((assignment) => !assignment.rejected);
    expect(new Set(active.map((assignment) => assignment.sequenceIndex)).size).toBe(active.length);
  });

  test('undo rejection does not return a replacement slot already claimed by another participant', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'original');
    await storageEngine.rejectParticipant('original', 'review');
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'replacement');
    await storageEngine.rejectParticipant('replacement', 'review');
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'reuse-original');
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'reuse-replacement');
    await expect(storageEngine.undoRejectParticipant('replacement')).rejects.toThrow(/reassigned/);
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'next');
    const assignments = await storageEngine.getAllSequenceAssignments(studyId);
    expect(assignments.find((assignment) => assignment.participantId === 'next')?.sequenceIndex).toBe(2);
  });

  // ── _undoRejectParticipantRealtime ───────────────────────────────────────────
  test('_undoRejectParticipantRealtime throws when studyId is not set', async () => {
    const fresh = new FirebaseStorageEngine(true);
    authState.currentUser = { email: null, uid: 'uid' };
    await fresh.connect();
    // @ts-expect-error protected
    await expect(fresh._undoRejectParticipantRealtime('p1')).rejects.toThrow('Study ID is not set');
  });

  test('_undoRejectParticipantRealtime sets rejected=false on the assignment', async () => {
    const session = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    await storageEngine.rejectParticipant(session.participantId, 'test');
    // @ts-expect-error protected
    await storageEngine._undoRejectParticipantRealtime(session.participantId);
    const all = await storageEngine.getAllSequenceAssignments(studyId);
    expect(all.find((a) => a.participantId === session.participantId)?.rejected).toBe(false);
  });

  test('_undoRejectParticipantRealtime restores the claimed source assignment for reused slots', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:01.000Z'));
      const session1 = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

      vi.setSystemTime(new Date('2026-01-01T00:00:02.000Z'));
      await storageEngine.rejectParticipant(session1.participantId, 'test');

      const assignmentsAfterFirstReject = await storageEngine.getAllSequenceAssignments(studyId);
      const originalAssignment = assignmentsAfterFirstReject.find((a) => a.participantId === session1.participantId);
      expect(originalAssignment).toBeDefined();

      await storageEngine.clearCurrentParticipantId();
      vi.setSystemTime(new Date('2026-01-01T00:00:03.000Z'));
      const session2 = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
      const assignmentsAfterReuse = await storageEngine.getAllSequenceAssignments(studyId);
      const reusedAssignmentBeforeReject = assignmentsAfterReuse.find((a) => a.participantId === session2.participantId);
      expect(reusedAssignmentBeforeReject?.timestamp).toBe(originalAssignment?.timestamp);

      vi.setSystemTime(new Date('2026-01-01T00:00:04.000Z'));
      await storageEngine.rejectParticipant(session2.participantId, 'test');

      // @ts-expect-error protected
      storageEngine.currentParticipantId = session2.participantId;
      // @ts-expect-error protected
      await storageEngine._undoRejectParticipantRealtime(session2.participantId);

      const all = await storageEngine.getAllSequenceAssignments(studyId);
      expect(all.find((a) => a.participantId === session2.participantId)?.rejected).toBe(false);
      expect(all.find((a) => a.participantId === session1.participantId)?.rejected).toBe(true);
      expect(all.find((a) => a.participantId === session1.participantId)?.claimed).toBe(true);
      expect(all.find((a) => a.participantId === session2.participantId)?.timestamp).toBe(originalAssignment?.timestamp);
    } finally {
      vi.useRealTimers();
    }
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

  test('setAutoTimeoutMinutes leaves the other stored settings alone', async () => {
    await storageEngine.setMode(studyId, 'dataCollectionEnabled', false);
    await storageEngine.setCurrentStage(studyId, 'STAGE_A', '#ff0000');
    await storageEngine.setAutoTimeoutMinutes(studyId, 45);

    const modes = await storageEngine.getModes(studyId);
    expect(modes.autoTimeoutMinutes).toBe(45);
    expect(modes.dataCollectionEnabled).toBe(false);
    expect(modes.stage?.currentStage.stageName).toBe('STAGE_A');

    await storageEngine.setAutoTimeoutMinutes(studyId, undefined);
    const modesAfterDisable = await storageEngine.getModes(studyId);
    expect(modesAfterDisable.autoTimeoutMinutes).toBeUndefined();
    expect(modesAfterDisable.dataCollectionEnabled).toBe(false);
    expect(modesAfterDisable.stage?.currentStage.stageName).toBe('STAGE_A');
  });

  test('setAutoTimeoutMinutes removes the Firebase setting when disabled', async () => {
    await storageEngine.setAutoTimeoutMinutes(studyId, 60);
    expect((await storageEngine.getModes(studyId)).autoTimeoutMinutes).toBe(60);

    await storageEngine.setAutoTimeoutMinutes(studyId, undefined);
    expect((await storageEngine.getModes(studyId)).autoTimeoutMinutes).toBeUndefined();
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

  test('_getWebcamRecordingUrl returns URL when recording exists', async () => {
    // @ts-expect-error protected
    const prefix = storageEngine.collectionPrefix;
    const path = `${prefix}${studyId}/webcamRecording/p1_task2`;
    storageObjects[path] = 'data';
    // @ts-expect-error protected
    expect(await storageEngine._getWebcamRecordingUrl('task2', 'p1')).toContain(path);
  });

  test('_getWebcamRecordingUrl returns null when recording does not exist', async () => {
    // @ts-expect-error protected
    expect(await storageEngine._getWebcamRecordingUrl('missing', 'p1')).toBeNull();
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
    expect((result as { adminUsersList: StoredUser[] }).adminUsersList).toHaveLength(1);
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
    const result = await (storageEngine as FirebaseStorageEngine).getUserManagementData('adminUsers') as { adminUsersList: StoredUser[] };
    expect(result.adminUsersList).toHaveLength(1);
  });

  test('addAdminUser appends user to existing list', async () => {
    await (storageEngine as FirebaseStorageEngine).addAdminUser({ email: 'a@a.com', uid: 'u0' });
    await (storageEngine as FirebaseStorageEngine).addAdminUser({ email: 'b@b.com', uid: 'u1' });
    const result = await (storageEngine as FirebaseStorageEngine).getUserManagementData('adminUsers') as { adminUsersList: StoredUser[] };
    expect(result.adminUsersList).toHaveLength(2);
  });

  test('addAdminUser does not add duplicate user', async () => {
    await (storageEngine as FirebaseStorageEngine).addAdminUser({ email: 'a@a.com', uid: 'u0' });
    await (storageEngine as FirebaseStorageEngine).addAdminUser({ email: 'a@a.com', uid: 'u0' });
    const result = await (storageEngine as FirebaseStorageEngine).getUserManagementData('adminUsers') as { adminUsersList: StoredUser[] };
    expect(result.adminUsersList).toHaveLength(1);
  });

  // ── removeAdminUser ──────────────────────────────────────────────────────────
  test('removeAdminUser removes user when multiple users exist', async () => {
    await (storageEngine as FirebaseStorageEngine).addAdminUser({ email: 'a@a.com', uid: 'u0' });
    await (storageEngine as FirebaseStorageEngine).addAdminUser({ email: 'b@b.com', uid: 'u1' });
    await (storageEngine as FirebaseStorageEngine).removeAdminUser('a@a.com');
    const result = await (storageEngine as FirebaseStorageEngine).getUserManagementData('adminUsers') as { adminUsersList: StoredUser[] };
    expect(result.adminUsersList).toHaveLength(1);
  });

  test('removeAdminUser does not remove user when they are the only admin', async () => {
    await (storageEngine as FirebaseStorageEngine).addAdminUser({ email: 'a@a.com', uid: 'u0' });
    await (storageEngine as FirebaseStorageEngine).removeAdminUser('a@a.com');
    const result = await (storageEngine as FirebaseStorageEngine).getUserManagementData('adminUsers') as { adminUsersList: StoredUser[] };
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
        selectedTags: [{ id: 't1', name: 'T1', color: 'red' }, undefined],
        annotation: '',
        transcriptMappingStart: 0,
        transcriptMappingEnd: 0,
      },
    ];
    // @ts-expect-error intentionally including undefined in selectedTags to test filtering
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
    vi.mocked(enableNetwork).mockRejectedValueOnce(new Error('network'));
    const engine = new FirebaseStorageEngine(true);
    await engine.connect();
    expect(engine.isConnected()).toBe(false);
  });
});
