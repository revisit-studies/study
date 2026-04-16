import {
  expect, test, beforeEach, describe, afterEach, vi,
} from 'vitest';
import { ParticipantMetadata, StudyConfig } from '../../parser/types';
import testConfigSimple from './testConfigSimple.json';
import { generateSequenceArray } from '../../utils/handleRandomSequences';
import { SupabaseStorageEngine } from '../engines/SupabaseStorageEngine';
import { StorageEngine, cleanupModes } from '../engines/types';
import { hash } from '../engines/utils/storageEngineHelpers';

type RowData = Record<string, string | number | boolean | null | object>;

const revisitRows: RowData[] = [];
const storageFiles: Record<string, string> = {};
const localStore: Record<string, string | number | object | null> = {};

// ── mocks ─────────────────────────────────────────────────────────────────────
vi.mock('@supabase/supabase-js', () => {
  function matchLike(value: string, pattern: string): boolean {
    const regexStr = `^${pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/%/g, '.*')
      .replace(/_/g, '.')}$`;
    return new RegExp(regexStr).test(value);
  }

  function getFieldValue(obj: RowData, col: string): string | number | boolean | null | object | undefined {
    if (col.includes('->')) {
      const arrowIdx = col.indexOf('->');
      const parent = col.slice(0, arrowIdx);
      const child = col.slice(arrowIdx + 2);
      const parentVal = obj[parent];
      return parentVal && typeof parentVal === 'object'
        ? (parentVal as RowData)[child]
        : undefined;
    }
    return obj[col];
  }

  function applyFilters(
    rows: Array<RowData>,
    filters: Array<{ col: string; val: string | number | boolean | null; type: 'eq' | 'like' }>,
  ): Array<RowData> {
    return rows.filter((row) => filters.every(({ col, val, type }) => {
      const colVal = getFieldValue(row, col);
      if (type === 'eq') return colVal === val;
      return typeof colVal === 'string' && matchLike(colVal, String(val));
    }));
  }

  function makeQueryBuilder(getRows: () => Array<RowData>) {
    let op: 'select' | 'upsert' | 'update' | 'delete' | null = null;
    let payload: RowData | RowData[] | Partial<RowData> | null = null;
    const filters: Array<{ col: string; val: string | number | boolean | null; type: 'eq' | 'like' }> = [];
    let isSingle = false;

    const qb = {
      select(_fields?: string) { op = 'select'; return qb; },
      upsert(row: RowData | RowData[]) { op = 'upsert'; payload = row; return qb; },
      update(obj: Partial<RowData>) { op = 'update'; payload = obj; return qb; },
      delete() { op = 'delete'; return qb; },
      eq(col: string, val: string | number | boolean | null) { filters.push({ col, val, type: 'eq' }); return qb; },
      like(col: string, val: string) { filters.push({ col, val, type: 'like' }); return qb; },
      single() { isSingle = true; return qb; },
      then(
        resolve: (val: { data: RowData | RowData[] | null; error: { message: string; code?: string } | null }) => void,
        reject?: (err: Error) => void,
      ) {
        Promise.resolve().then(() => {
          const rows = getRows();
          if (op === 'select') {
            const matched = applyFilters(rows, filters);
            // Return deep copies so later mutations to revisitRows don't alias into returned data
            if (isSingle) {
              if (matched.length === 0) {
                resolve({ data: null, error: { message: 'No rows', code: 'PGRST116' } });
              } else {
                resolve({ data: JSON.parse(JSON.stringify(matched[0])), error: null });
              }
            } else {
              resolve({ data: JSON.parse(JSON.stringify(matched)), error: null });
            }
          } else if (op === 'upsert') {
            const toUpsert = (Array.isArray(payload)
              ? payload
              : [payload]) as Array<RowData>;
            toUpsert.forEach((row) => {
              const idx = rows.findIndex(
                (r) => r.studyId === row.studyId && r.docId === row.docId,
              );
              if (idx >= 0) {
                rows[idx] = {
                  ...row,
                  createdAt: (row.createdAt as string | undefined) ?? rows[idx].createdAt,
                };
              } else {
                rows.push({
                  ...row,
                  createdAt: (row.createdAt as string | undefined) ?? new Date().toISOString(),
                });
              }
            });
            resolve({ data: toUpsert, error: null });
          } else if (op === 'update') {
            const matched = applyFilters(rows, filters);
            matched.forEach((row) => Object.assign(row, payload as RowData));
            resolve({ data: matched, error: null });
          } else if (op === 'delete') {
            const matched = applyFilters(rows, filters);
            matched.forEach((row) => {
              const idx = rows.indexOf(row);
              if (idx >= 0) rows.splice(idx, 1);
            });
            resolve({ data: matched, error: null });
          } else {
            resolve({ data: null, error: null });
          }
        }).catch(reject);
      },
    };
    return qb;
  }

  return {
    AuthError: class AuthError extends Error { },
    createClient: () => ({
      from: (_table: string) => makeQueryBuilder(() => revisitRows),
      schema: (schemaName: string) => ({
        from: (_table: string) => makeQueryBuilder(() => {
          if (schemaName === 'storage') {
            return Object.keys(storageFiles).map((name) => ({ name, bucket_id: 'revisit' }));
          }
          return revisitRows;
        }),
      }),
      storage: {
        from: (_bucket: string) => ({
          download: async (path: string) => {
            if (path in storageFiles) {
              return { data: storageFiles[path], error: null };
            }
            return { data: null, error: { message: 'Object not found' } };
          },
          upload: async (path: string, data: Blob | Buffer | string | object, _opts?: object) => {
            let text: string;
            if (data instanceof Blob) {
              text = await data.text();
            } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
              text = (data as Buffer).toString();
            } else if (typeof data === 'string') {
              // Already a string (e.g. re-upload from _cacheStorageObject) — store as-is
              text = data;
            } else {
              text = JSON.stringify(data);
            }
            storageFiles[path] = text;
            return { data: { path }, error: null };
          },
          remove: async (paths: string[]) => {
            paths.forEach((p) => {
              delete storageFiles[p];
              // Also cascade-delete files under directory prefix
              const prefix = `${p}/`;
              Object.keys(storageFiles)
                .filter((k) => k.startsWith(prefix))
                .forEach((k) => { delete storageFiles[k]; });
            });
            return { data: paths, error: null };
          },
          list: async (path: string, _opts?: object) => {
            const prefix = path.endsWith('/') ? path : `${path}/`;
            const keys = Object.keys(storageFiles).filter((k) => k.startsWith(prefix));
            const names = new Set(keys.map((k) => k.slice(prefix.length).split('/')[0]));
            return { data: [...names].map((name) => ({ name })), error: null };
          },
          updateMetadata: async (_path: string, _metadata: object) => ({ data: {}, error: null }),
        }),
      },
      auth: {
        getSession: async () => ({
          data: { session: { user: { id: 'mock-uid', email: null } } },
          error: null,
        }),
        signInAnonymously: async () => ({ data: { user: { id: 'mock-uid' } }, error: null }),
        onAuthStateChange: (callback: (event: string, session: object | null) => void) => {
          callback('SIGNED_IN', { user: { id: 'mock-uid', email: null } });
          return { data: { subscription: { unsubscribe: () => { } } } };
        },
        signOut: async () => ({ error: null }),
        signInWithOAuth: async () => ({ error: null }),
      },
    }),
  };
});

vi.mock('localforage', () => ({
  default: {
    createInstance: vi.fn(() => ({
      getItem: vi.fn((key: string) => Promise.resolve(localStore[key] ?? null)),
      setItem: vi.fn((key: string, value: string | number | object | null) => {
        localStore[key] = value;
        return Promise.resolve(value);
      }),
      removeItem: vi.fn((key: string) => {
        delete localStore[key];
        return Promise.resolve();
      }),
    })),
  },
}));

const studyId = 'test-study';
const configSimple = testConfigSimple as StudyConfig;
const participantMetadata: ParticipantMetadata = {
  userAgent: 'test-user-agent',
  resolution: { width: 1920, height: 1080 },
  language: 'en-US',
  ip: '122.122.122.122',
};

describe.each([
  { TestEngine: SupabaseStorageEngine },
])('describe object $TestEngine', ({ TestEngine }) => {
  let storageEngine: StorageEngine;

  beforeEach(async () => {
    storageEngine = new TestEngine(true);
    await storageEngine.connect();
    await storageEngine.initializeStudyDb(studyId);
    const sequenceArray = generateSequenceArray(configSimple);
    await storageEngine.setSequenceArray(
      sequenceArray,
    );
  });

  afterEach(async () => {
    // @ts-expect-error using protected method for testing
    await storageEngine._testingReset(studyId);
    // @ts-expect-error using protected method for testing
    await storageEngine._testingReset('test-realtime-copy');
  });

  test('_pushToStorage, _getFromStorage, and _removeFromStorage work correctly', async () => {
    const sequenceArray = generateSequenceArray(configSimple);
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
    expect(storedParticipantData!.participantId).toBe(participantData.participantId);

    // @ts-expect-error using protected method for testing
    await storageEngine._pushToStorage('testBlob', 'blob', randomBuffer);
    // @ts-expect-error using protected method for testing
    const storedBlob = await storageEngine._getFromStorage('testBlob', 'blob');
    expect(storedBlob).toBeDefined();
    expect(storedBlob).toBeInstanceOf(Object);
  });

  test('_verifyStudyDatabase throws error if not initialized', async () => {
    const uninitializedStorageEngine = new TestEngine();
    // @ts-expect-error using protected method for testing
    await expect(uninitializedStorageEngine.verifyStudyDatabase()).rejects.toThrow('Study database not initialized');
  });

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

  test('getAllSequenceAssignments returns sequence assignment for participant', async () => {
    const participantSession = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    const { participantId } = participantSession;

    const sequenceAssignments = await storageEngine.getAllSequenceAssignments(studyId);
    expect(sequenceAssignments).toBeDefined();

    const sequenceAssignment = sequenceAssignments.find((assignment) => assignment.participantId === participantId);
    expect(sequenceAssignment).toBeDefined();
    expect(sequenceAssignment!.participantId).toBe(participantId);
    expect(sequenceAssignment!.timestamp).toBeDefined();
    expect(sequenceAssignment!.rejected).toBe(false);
    expect(sequenceAssignment!.claimed).toBe(false);
    expect(sequenceAssignment!.completed).toBeNull();
    expect(sequenceAssignment!.createdTime).toBeDefined();
    expect(sequenceAssignment!.createdTime).equal(sequenceAssignment!.timestamp);
  });

  test('_completeCurrentParticipantRealtime updates sequence assignment', async () => {
    const participantSession = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    const { participantId } = participantSession;

    let sequenceAssignments = await storageEngine.getAllSequenceAssignments(studyId);
    expect(sequenceAssignments).toBeDefined();

    const sequenceAssignment = sequenceAssignments.find((assignment) => assignment.participantId === participantId);
    expect(sequenceAssignment).toBeDefined();
    expect(sequenceAssignment!.participantId).toBe(participantId);
    expect(sequenceAssignment!.completed).toBeNull();

    // @ts-expect-error using protected method for testing
    await storageEngine._completeCurrentParticipantRealtime();

    sequenceAssignments = await storageEngine.getAllSequenceAssignments(studyId);
    expect(sequenceAssignments).toBeDefined();

    const updatedSequenceAssignment = sequenceAssignments.find((assignment) => assignment.participantId === participantId);
    expect(updatedSequenceAssignment).toBeDefined();
    expect(updatedSequenceAssignment!.participantId).toBe(participantId);
    expect(updatedSequenceAssignment!.completed).toBeDefined();
    expect(updatedSequenceAssignment!.completed).toBeGreaterThanOrEqual(updatedSequenceAssignment!.createdTime);
  });

  test('_getModes returns correct modes and _setMode updates correctly', async () => {
    const modes = await storageEngine.getModes(studyId);
    expect(modes).toBeDefined();
    expect(modes.dataSharingEnabled).toBe(true);
    expect(modes.dataCollectionEnabled).toBe(true);
    expect(modes.developmentModeEnabled).toBe(true);

    await storageEngine.setMode(studyId, 'dataCollectionEnabled', false);
    const updatedModes = await storageEngine.getModes(studyId);
    expect(updatedModes).toBeDefined();
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
    const afterDataCollectionToggle = await storageEngine.getModes(studyId);
    expect(afterDataCollectionToggle.dataCollectionEnabled).toBe(false);
    expect(afterDataCollectionToggle.developmentModeEnabled).toBe(true);
    expect(afterDataCollectionToggle.dataSharingEnabled).toBe(true);

    await storageEngine.setMode(studyId, 'developmentModeEnabled', false);
    const afterDevelopmentToggle = await storageEngine.getModes(studyId);
    expect(afterDevelopmentToggle.dataCollectionEnabled).toBe(false);
    expect(afterDevelopmentToggle.developmentModeEnabled).toBe(false);
    expect(afterDevelopmentToggle.dataSharingEnabled).toBe(true);

    await storageEngine.setMode(studyId, 'dataSharingEnabled', false);
    const afterDataSharingToggle = await storageEngine.getModes(studyId);
    expect(afterDataSharingToggle.dataCollectionEnabled).toBe(false);
    expect(afterDataSharingToggle.developmentModeEnabled).toBe(false);
    expect(afterDataSharingToggle.dataSharingEnabled).toBe(false);
  });

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
    expect(sanitizedModesFalse).toBeDefined();
    expect(sanitizedModesFalse).toEqual(cleanedModesFalse);
    expect(sanitizedModesFalse).not.toEqual(oldModesFalse);

    const alreadySanitizedModes = cleanupModes(cleanedModes);
    expect(alreadySanitizedModes).toBeDefined();
    expect(alreadySanitizedModes).toEqual(cleanedModes);

    const emptySanitizedModes = cleanupModes({});
    expect(emptySanitizedModes).toBeDefined();
    expect(emptySanitizedModes).toEqual({});

    const extraModes = {
      testField1: true,
      testField2: false,
    };

    const extraSanitizedModes = cleanupModes({ ...extraModes, ...oldModes });

    expect(extraSanitizedModes).toBeDefined();
    expect(extraSanitizedModes).not.toEqual(oldModes);
    expect(extraSanitizedModes).not.toEqual(cleanedModes);
    expect(extraSanitizedModes).toEqual({ ...extraModes, ...sanitizedModes });

    const mixedModes = {
      ...oldModes,
      ...cleanedModes,
    };

    const mixedSanitizedModes = cleanupModes(mixedModes);
    expect(mixedSanitizedModes).toBeDefined();
    expect(mixedSanitizedModes).toEqual(mixedModes);
  });

  /* Snapshots ----------------------------------------------------------- */

  test('_getSnapshotData is empty on initialization', async () => {
    // @ts-expect-error using protected value for testing
    const snapshotData = await storageEngine.getSnapshots(`${storageEngine.collectionPrefix}${studyId}`);
    expect(snapshotData).toBeDefined();
    expect(Object.keys(snapshotData).length).toBe(0);
  });

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

  test('_copyDirectory copies directory and contents', async () => {
    // @ts-expect-error using protected value for testing
    const source = `${storageEngine.collectionPrefix}${studyId}`;
    // @ts-expect-error using protected value for testing
    const target = `${storageEngine.collectionPrefix}test-copy`;

    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    // @ts-expect-error using protected method for testing
    const sourceExists = await storageEngine._directoryExists(source);
    expect(sourceExists).toBe(true);

    // @ts-expect-error using protected method for testing
    await storageEngine._copyDirectory(source, target);

    // @ts-expect-error using protected method for testing
    const targetExists = await storageEngine._directoryExists(target);
    expect(targetExists).toBe(true);

    // @ts-expect-error using protected method for testing
    await storageEngine._deleteDirectory(target);

    // @ts-expect-error using protected method for testing
    const targetDeleted = await storageEngine._directoryExists(target);
    expect(targetDeleted).toBe(false);
  });

  test('_copyRealtimeData copies realtime data', async () => {
    const targetId = 'test-realtime-copy';
    // @ts-expect-error using protected value for testing
    const source = `${storageEngine.collectionPrefix}${studyId}`;
    // @ts-expect-error using protected value for testing
    const target = `${storageEngine.collectionPrefix}test-realtime-copy`;

    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

    const sourceSequenceAssignments1 = await storageEngine.getAllSequenceAssignments(studyId);
    expect(sourceSequenceAssignments1).toBeDefined();
    expect(sourceSequenceAssignments1.length).toEqual(1);

    let targetSequenceAssignments = await storageEngine.getAllSequenceAssignments(targetId);
    expect(targetSequenceAssignments).toBeDefined();
    expect(targetSequenceAssignments.length).toBe(0);

    // @ts-expect-error using protected method for testing
    await storageEngine._copyRealtimeData(source, target);

    const sourceSequenceAssignments2 = await storageEngine.getAllSequenceAssignments(studyId);
    expect(sourceSequenceAssignments2).toBeDefined();
    expect(sourceSequenceAssignments2.length).toEqual(1);

    targetSequenceAssignments = await storageEngine.getAllSequenceAssignments(targetId);
    expect(targetSequenceAssignments).toBeDefined();
    expect(targetSequenceAssignments.length).toEqual(1);
    expect(targetSequenceAssignments[0].participantId).toBe(sourceSequenceAssignments2[0].participantId);

    // @ts-expect-error using protected method for testing
    await storageEngine._deleteRealtimeData(target);

    targetSequenceAssignments = await storageEngine.getAllSequenceAssignments(targetId);
    expect(targetSequenceAssignments).toBeDefined();
    expect(targetSequenceAssignments.length).toBe(0);
  });

  test('_addDirectoryNameToSnapshots, _removeDirectoryNameFromSnapshots, and _changeDirectoryNameInSnapshots work correctly', async () => {
    const directoryName = 'test-directory';

    // @ts-expect-error using protected method for testing
    const snapshotData1 = await storageEngine.getSnapshots(`${storageEngine.collectionPrefix}${studyId}`);
    expect(snapshotData1).toBeDefined();
    expect(snapshotData1[directoryName]).not.toBeDefined();

    // @ts-expect-error using protected method for testing
    await storageEngine._addDirectoryNameToSnapshots(directoryName, studyId);

    const snapshotData2 = await storageEngine.getSnapshots(studyId);
    expect(snapshotData2).toBeDefined();
    expect(snapshotData2[directoryName]).toBeDefined();
    expect(snapshotData2[directoryName].name).toBe(directoryName);

    const newDirectoryName = 'renamed-directory';
    // @ts-expect-error using protected method for testing
    await storageEngine._changeDirectoryNameInSnapshots(directoryName, newDirectoryName, studyId);

    const updatedSnapshotData = await storageEngine.getSnapshots(studyId);
    expect(updatedSnapshotData).toBeDefined();
    expect(updatedSnapshotData[directoryName]).toBeDefined();
    expect(updatedSnapshotData[directoryName].name).toBe(newDirectoryName);
    expect(updatedSnapshotData[newDirectoryName]).not.toBeDefined();

    // @ts-expect-error using protected method for testing
    await storageEngine._removeDirectoryNameFromSnapshots(directoryName, studyId);

    const snapshotData3 = await storageEngine.getSnapshots(studyId);
    expect(snapshotData3).toBeDefined();
    expect(snapshotData3[directoryName]).not.toBeDefined();
  });
});
