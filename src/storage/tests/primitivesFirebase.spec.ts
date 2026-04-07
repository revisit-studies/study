/**
 * Firebase primitives tests — mirrors primitives.spec.ts for LocalStorageEngine.
 *
 * Uses in-memory Firestore mocks (no emulator required).
 *
 *   yarn vitest run src/storage/tests/primitivesFirebase.spec.ts
 */

import {
  beforeAll, beforeEach, afterAll, afterEach, describe, expect, test, vi,
} from 'vitest';

import { type ParticipantMetadata, type StudyConfig } from '../../parser/types';
import testConfigSimple from './testConfigSimple.json';
import { generateSequenceArray } from '../../utils/handleRandomSequences';
import { FirebaseStorageEngine } from '../engines/FirebaseStorageEngine';
import { type StorageEngine, cleanupModes } from '../engines/types';
import { hash } from '../engines/utils';

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
    constructor(public seconds: number, public nanoseconds: number) {}

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
const PROJECT_ID = 'demo-primitives';
const studyId = 'test-study';
const configSimple = testConfigSimple as StudyConfig;
const participantMetadata: ParticipantMetadata = {
  userAgent: 'test-user-agent',
  resolution: { width: 1920, height: 1080 },
  language: 'en-US',
  ip: '122.122.122.122',
};

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

  beforeEach(async () => {
    storageEngine = new TestEngine(true);
    await storageEngine.connect();
    await storageEngine.initializeStudyDb(studyId);
    const sequenceArray = await generateSequenceArray(configSimple);
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

  // _pushToStorage, _getFromStorage tests
  test('_pushToStorage, _getFromStorage, and _deleteFromStorage work correctly', async () => {
    const sequenceArray = await generateSequenceArray(configSimple);
    const participantData = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    const randomBuffer = { test: 1 };

    // @ts-expect-error using protected method for testing
    await storageEngine._pushToStorage('', 'sequenceArray', sequenceArray);
    // @ts-expect-error using protected method for testing
    const storedSequenceArray = await storageEngine._getFromStorage('', 'sequenceArray');
    expect(storedSequenceArray).toBeDefined();
    expect(storedSequenceArray).toEqual(sequenceArray);

    // @ts-expect-error using protected method for testing
    await storageEngine._pushToStorage('participants', 'participantData', participantData);
    // @ts-expect-error using protected method for testing
    const storedParticipantData = await storageEngine._getFromStorage('participants', 'participantData', studyId);
    expect(storedParticipantData).toBeDefined();
    expect((storedParticipantData as typeof participantData)!.participantId).toBe(participantData.participantId);

    // @ts-expect-error using protected method for testing
    await storageEngine._pushToStorage('testBlob', 'blob', randomBuffer);
    // @ts-expect-error using protected method for testing
    const storedBlob = await storageEngine._getFromStorage('testBlob', 'blob');
    expect(storedBlob).toBeDefined();
    expect(storedBlob).toBeInstanceOf(Object);
  });

  // _cacheStorageObject test (Firebase implements updateMetadata)
  test('_cacheStorageObject calls updateMetadata without throwing', async () => {
    // Push something first so a ref exists
    // @ts-expect-error using protected method for testing
    await storageEngine._pushToStorage('', 'sequenceArray', []);
    // @ts-expect-error using protected method for testing
    await expect(storageEngine._cacheStorageObject('', 'sequenceArray')).resolves.not.toThrow();
  });

  // _verifyStudyDatabase — for Firebase, studyCollection is always initialized
  // in the constructor so this test is not applicable; omitted.

  // _getCurrentConfigHash and _setCurrentConfigHash tests
  test('_getCurrentConfigHash and _setCurrentConfigHash work correctly', async () => {
    // @ts-expect-error using protected method for testing
    const initialHash = await storageEngine._getCurrentConfigHash();
    expect(initialHash).toBeNull();

    const configHash = await hash(JSON.stringify(configSimple));
    // @ts-expect-error using protected method for testing
    await storageEngine._setCurrentConfigHash(configHash);
    // @ts-expect-error using protected method for testing
    const updatedHash = await storageEngine._getCurrentConfigHash();
    expect(updatedHash).toBe(configHash);
  });

  // getAllSequenceAssignments test
  test('getAllSequenceAssignments returns sequence assignment for participant', async () => {
    const participantSession = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    const { participantId } = participantSession;

    const sequenceAssignments = await storageEngine.getAllSequenceAssignments(studyId);
    expect(sequenceAssignments).toBeDefined();

    const sequenceAssignment = sequenceAssignments.find((a) => a.participantId === participantId);
    expect(sequenceAssignment).toBeDefined();
    expect(sequenceAssignment!.participantId).toBe(participantId);
    expect(sequenceAssignment!.timestamp).toBeDefined();
    expect(sequenceAssignment!.rejected).toBe(false);
    expect(sequenceAssignment!.claimed).toBe(false);
    expect(sequenceAssignment!.completed).toBeNull();
    expect(sequenceAssignment!.createdTime).toBeDefined();
    expect(sequenceAssignment!.createdTime).equal(sequenceAssignment!.timestamp);
  });

  // _completeCurrentParticipantRealtime test
  test('_completeCurrentParticipantRealtime updates sequence assignment', async () => {
    const participantSession = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    const { participantId } = participantSession;

    let sequenceAssignments = await storageEngine.getAllSequenceAssignments(studyId);
    const sequenceAssignment = sequenceAssignments.find((a) => a.participantId === participantId);
    expect(sequenceAssignment!.completed).toBeNull();

    // @ts-expect-error using protected method for testing
    await storageEngine._completeCurrentParticipantRealtime();

    sequenceAssignments = await storageEngine.getAllSequenceAssignments(studyId);
    const updated = sequenceAssignments.find((a) => a.participantId === participantId);
    expect(updated!.completed).toBeDefined();
    expect(updated!.completed).toBeGreaterThanOrEqual(updated!.createdTime);
  });

  // getModes and setMode tests
  test('_getModes returns correct modes and _setMode updates correctly', async () => {
    const modes = await storageEngine.getModes(studyId);
    expect(modes).toBeDefined();
    expect(modes.dataSharingEnabled).toBe(true);
    expect(modes.dataCollectionEnabled).toBe(true);
    expect(modes.developmentModeEnabled).toBe(true);

    await storageEngine.setMode(studyId, 'dataCollectionEnabled', false);
    const updatedModes = await storageEngine.getModes(studyId);
    expect(updatedModes.dataSharingEnabled).toBe(true);
    expect(updatedModes.dataCollectionEnabled).toBe(false);
    expect(updatedModes.developmentModeEnabled).toBe(true);
  });

  test('setMode toggles each ReVISit mode independently', async () => {
    const initialModes = await storageEngine.getModes(studyId);
    expect(initialModes.dataCollectionEnabled).toBe(true);
    expect(initialModes.developmentModeEnabled).toBe(true);
    expect(initialModes.dataSharingEnabled).toBe(true);

    await storageEngine.setMode(studyId, 'dataCollectionEnabled', false);
    const after1 = await storageEngine.getModes(studyId);
    expect(after1.dataCollectionEnabled).toBe(false);
    expect(after1.developmentModeEnabled).toBe(true);
    expect(after1.dataSharingEnabled).toBe(true);

    await storageEngine.setMode(studyId, 'developmentModeEnabled', false);
    const after2 = await storageEngine.getModes(studyId);
    expect(after2.dataCollectionEnabled).toBe(false);
    expect(after2.developmentModeEnabled).toBe(false);
    expect(after2.dataSharingEnabled).toBe(true);

    await storageEngine.setMode(studyId, 'dataSharingEnabled', false);
    const after3 = await storageEngine.getModes(studyId);
    expect(after3.dataCollectionEnabled).toBe(false);
    expect(after3.developmentModeEnabled).toBe(false);
    expect(after3.dataSharingEnabled).toBe(false);
  });

  // cleanupModes test (pure logic, same as LocalStorage version)
  test('cleanupModes updates old modes to new modes', async () => {
    const oldModes = {
      studyNavigatorEnabled: true,
      analyticsInterfacePubliclyAccessible: true,
      dataCollectionEnabled: true,
    };
    const cleanedModes = {
      developmentModeEnabled: true,
      dataSharingEnabled: true,
      dataCollectionEnabled: true,
    };

    const sanitizedModes = cleanupModes(oldModes);
    expect(sanitizedModes).toBeDefined();
    expect(sanitizedModes).toEqual(cleanedModes);
    expect(sanitizedModes).not.toEqual(oldModes);

    const oldModesFalse = {
      studyNavigatorEnabled: false,
      analyticsInterfacePubliclyAccessible: false,
      dataCollectionEnabled: true,
    };
    const cleanedModesFalse = {
      developmentModeEnabled: false,
      dataSharingEnabled: false,
      dataCollectionEnabled: true,
    };
    const sanitizedModesFalse = cleanupModes(oldModesFalse);
    expect(sanitizedModesFalse).toEqual(cleanedModesFalse);
    expect(sanitizedModesFalse).not.toEqual(oldModesFalse);

    const alreadySanitized = cleanupModes(cleanedModes);
    expect(alreadySanitized).toEqual(cleanedModes);

    const emptySanitized = cleanupModes({});
    expect(emptySanitized).toEqual({});

    const extraModes = { testField1: true, testField2: false };
    const extraSanitized = cleanupModes({ ...extraModes, ...oldModes });
    expect(extraSanitized).not.toEqual(oldModes);
    expect(extraSanitized).not.toEqual(cleanedModes);
    expect(extraSanitized).toEqual({ ...extraModes, ...sanitizedModes });

    const mixedModes = { ...oldModes, ...cleanedModes };
    const mixedSanitized = cleanupModes(mixedModes);
    expect(mixedSanitized).toEqual(mixedModes);
  });

  // _getSnapshotData test
  test('_getSnapshotData is empty on initialization', async () => {
    // @ts-expect-error using protected value for testing
    const snapshotData = await storageEngine.getSnapshots(`${storageEngine.collectionPrefix}${studyId}`);
    expect(snapshotData).toBeDefined();
    expect(Object.keys(snapshotData).length).toBe(0);
  });

  // _directoryExists tests
  test('_directoryExists returns false for non-existent directory', async () => {
    // @ts-expect-error using protected method for testing
    const exists = await storageEngine._directoryExists('missing-study');
    expect(exists).toBe(false);
  });

  test('_directoryExists returns true for existing directory', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    // @ts-expect-error using protected method and value for testing
    const exists = await storageEngine._directoryExists(`${storageEngine.collectionPrefix}${studyId}`);
    expect(exists).toBe(true);
  });

  // _copyDirectory and _deleteDirectory test
  test('_copyDirectory copies directory and contents', async () => {
    // @ts-expect-error using protected value for testing
    const source = `${storageEngine.collectionPrefix}${studyId}`;
    // @ts-expect-error using protected value for testing
    const target = `${storageEngine.collectionPrefix}test-copy`;

    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    // @ts-expect-error using protected method for testing
    expect(await storageEngine._directoryExists(source)).toBe(true);

    // @ts-expect-error using protected method for testing
    await storageEngine._copyDirectory(source, target);
    // @ts-expect-error using protected method for testing
    expect(await storageEngine._directoryExists(target)).toBe(true);

    // @ts-expect-error using protected method for testing
    await storageEngine._deleteDirectory(target);
    // @ts-expect-error using protected method for testing
    expect(await storageEngine._directoryExists(target)).toBe(false);
  });

  // _copyRealtimeData and _deleteRealtimeData test
  test('_copyRealtimeData copies realtime data', async () => {
    const targetId = 'test-realtime-copy';
    // @ts-expect-error using protected value for testing
    const source = `${storageEngine.collectionPrefix}${studyId}`;
    // @ts-expect-error using protected value for testing
    const target = `${storageEngine.collectionPrefix}${targetId}`;

    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

    const sourceAssignments1 = await storageEngine.getAllSequenceAssignments(studyId);
    expect(sourceAssignments1.length).toEqual(1);

    let targetAssignments = await storageEngine.getAllSequenceAssignments(targetId);
    expect(targetAssignments.length).toBe(0);

    // @ts-expect-error using protected method for testing
    await storageEngine._copyRealtimeData(source, target);

    const sourceAssignments2 = await storageEngine.getAllSequenceAssignments(studyId);
    expect(sourceAssignments2.length).toEqual(1);

    targetAssignments = await storageEngine.getAllSequenceAssignments(targetId);
    expect(targetAssignments.length).toEqual(1);
    expect(targetAssignments[0].participantId).toBe(sourceAssignments2[0].participantId);

    // @ts-expect-error using protected method for testing
    await storageEngine._deleteRealtimeData(target);

    targetAssignments = await storageEngine.getAllSequenceAssignments(targetId);
    expect(targetAssignments.length).toBe(0);
  });

  // _addDirectoryNameToSnapshots, _removeDirectoryNameFromSnapshots, _changeDirectoryNameInSnapshots tests
  test('_addDirectoryNameToSnapshots, _removeDirectoryNameFromSnapshots, and _changeDirectoryNameInSnapshots work correctly', async () => {
    const directoryName = 'test-directory';

    // @ts-expect-error using protected method for testing
    const snap1 = await storageEngine.getSnapshots(`${storageEngine.collectionPrefix}${studyId}`);
    expect(snap1[directoryName]).not.toBeDefined();

    // @ts-expect-error using protected method for testing
    await storageEngine._addDirectoryNameToSnapshots(directoryName, studyId);

    const snap2 = await storageEngine.getSnapshots(studyId);
    expect(snap2[directoryName]).toBeDefined();
    expect(snap2[directoryName].name).toBe(directoryName);

    const newName = 'renamed-directory';
    // @ts-expect-error using protected method for testing
    await storageEngine._changeDirectoryNameInSnapshots(directoryName, newName, studyId);

    const snap3 = await storageEngine.getSnapshots(studyId);
    expect(snap3[directoryName]).toBeDefined();
    expect(snap3[directoryName].name).toBe(newName);
    expect(snap3[newName]).not.toBeDefined();

    // @ts-expect-error using protected method for testing
    await storageEngine._removeDirectoryNameFromSnapshots(directoryName, studyId);

    const snap4 = await storageEngine.getSnapshots(studyId);
    expect(snap4[directoryName]).not.toBeDefined();
  });
});
