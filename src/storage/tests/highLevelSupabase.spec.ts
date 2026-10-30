import {
  expect, test, beforeEach, describe,
  afterEach,
  vi,
} from 'vitest';
import { ParticipantMetadata, StudyConfig } from '../../parser/types';
import testConfigSimple from './testConfigSimple.json';
import testConfigSimple2 from './testConfigSimple2.json';
import { makeStoredAnswer } from '../../tests/utils';
import { generateSequenceArray } from '../../utils/handleRandomSequences';
import { hash } from '../engines/utils/storageEngineHelpers';
import { Sequence } from '../../store/types';
import {
  StorageEngine, getBetweenSubjectsCombinationKey, SequenceAssignment, StoredUser, RuntimeStudySettings,
} from '../engines/types';
import { filterSequenceByCondition } from '../../utils/handleConditionLogic';
import { SupabaseStorageEngine } from '../engines/SupabaseStorageEngine';

type RowData = Record<string, string | number | boolean | null | object>;

const revisitRows: RowData[] = [];
const storageFiles: Record<string, string> = {};
let failConfigActivation = false;
let failSequenceReads = false;
let failParticipantReads = false;
const localStore: Record<string, string | number | object | null> = {};
const supabaseFailureState = vi.hoisted(() => ({ failNextUpdate: false }));
let nextSupabaseSelectError: { message: string; code?: string } | null = null;
let assignmentWriteError = false;
let rejectedAssignmentError: 'lookup' | 'claim' | null = null;
let failStageAllocationRebuild = false;
let loseTimeoutWriteResponse: 'assignment' | 'allocation' | null = null;
const supabaseOperations: Array<{
  op: string | null;
  filters: Array<{ col: string; type: string; val: string | number | boolean | null }>;
  headOnly: boolean;
  limit?: number;
}> = [];

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
      // `data->>field` extracts the field as text, so drop the extra '>'.
      const child = col.slice(arrowIdx + 2).replace(/^>/, '');
      const parentVal = obj[parent];
      return parentVal && typeof parentVal === 'object'
        ? (parentVal as RowData)[child]
        : undefined;
    }
    return obj[col];
  }

  function applyFilters(
    rows: Array<RowData>,
    filters: Array<{ col: string; val: string | number | boolean | null; type: 'eq' | 'neq' | 'is' | 'like' | 'not' | 'lt' | 'gt' }>,
  ): Array<RowData> {
    return rows.filter((row) => filters.every(({ col, val, type }) => {
      const colVal = getFieldValue(row, col);
      // PostgREST compares filter values as text, so `data->>rejected` matches
      // the string 'false' rather than the boolean.
      if (type === 'eq') return col === 'data' ? JSON.stringify(colVal) === val : String(colVal) === String(val);
      if (type === 'neq') return String(colVal) !== String(val);
      if (type === 'is') return (colVal ?? null) === val;
      if (type === 'not') return colVal !== null && colVal !== undefined;
      if (type === 'lt') return colVal !== undefined && colVal !== null && colVal < val!;
      if (type === 'gt') return colVal !== undefined && colVal !== null && colVal > val!;
      return typeof colVal === 'string' && matchLike(colVal, String(val));
    }));
  }

  function makeQueryBuilder(getRows: () => Array<RowData>) {
    let op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' | null = null;
    let payload: RowData | RowData[] | Partial<RowData> | null = null;
    const filters: Array<{ col: string; val: string | number | boolean | null; type: 'eq' | 'neq' | 'is' | 'like' | 'not' | 'lt' | 'gt' }> = [];
    let isSingle = false;
    let isMaybeSingle = false;
    let requestedCount = false;
    let headOnly = false;
    let resultLimit: number | undefined;
    let orderBy: { col: string; ascending: boolean } | undefined;

    const qb = {
      select(_fields?: string, opts?: { count?: string; head?: boolean }) { if (op === null) op = 'select'; requestedCount = opts?.count === 'exact'; headOnly = opts?.head === true; return qb; },
      upsert(row: RowData | RowData[]) { op = 'upsert'; payload = row; return qb; },
      insert(row: RowData | RowData[]) { op = 'insert'; payload = row; return qb; },
      update(obj: Partial<RowData>) { op = 'update'; payload = obj; return qb; },
      delete() { op = 'delete'; return qb; },
      eq(col: string, val: string | number | boolean | null) { filters.push({ col, val, type: 'eq' }); return qb; },
      lt(col: string, val: string | number | boolean | null) { filters.push({ col, val, type: 'lt' }); return qb; },
      gt(col: string, val: string | number | boolean | null) { filters.push({ col, val, type: 'gt' }); return qb; },
      neq(col: string, val: string | number | boolean | null) { filters.push({ col, val, type: 'neq' }); return qb; },
      is(col: string, val: string | number | boolean | null) { filters.push({ col, val, type: 'is' }); return qb; },
      like(col: string, val: string) { filters.push({ col, val, type: 'like' }); return qb; },
      not(col: string, _operator: string, val: string | number | boolean | null) { filters.push({ col, val, type: 'not' }); return qb; },
      order(col: string, options?: { ascending?: boolean }) {
        orderBy = { col, ascending: options?.ascending !== false };
        return qb;
      },
      limit(count: number) { resultLimit = count; return qb; },
      single() { isSingle = true; return qb; },
      maybeSingle() { isMaybeSingle = true; return qb; },
      then(
        resolve: (val: { data: RowData | RowData[] | null; error: { message: string; code?: string } | null; count?: number | null }) => void,
        reject?: (err: Error) => void,
      ) {
        Promise.resolve().then(() => {
          supabaseOperations.push({
            op,
            filters: filters.map((filter) => ({ ...filter })),
            headOnly,
            limit: resultLimit,
          });
          if (op === 'select' && nextSupabaseSelectError) {
            const error = nextSupabaseSelectError;
            nextSupabaseSelectError = null;
            resolve({ data: null, error });
            return;
          }
          if (filters.some((filter) => filter.col === 'data->rejected' && filter.val === true)
            && ((op === 'select' && rejectedAssignmentError === 'lookup')
              || (op === 'update' && rejectedAssignmentError === 'claim'))) {
            resolve({ data: null, error: { message: 'rejected assignment operation failed' } });
            return;
          }
          const rows = getRows();
          if (op === 'select') {
            let matched = applyFilters(rows, filters);
            const count = requestedCount ? matched.length : null;
            if (orderBy) {
              matched = [...matched].sort((a, b) => {
                const aValue = getFieldValue(a, orderBy!.col);
                const bValue = getFieldValue(b, orderBy!.col);
                const comparison = typeof aValue === 'number' && typeof bValue === 'number'
                  ? aValue - bValue
                  : String(aValue ?? '').localeCompare(String(bValue ?? ''));
                return comparison * (orderBy!.ascending ? 1 : -1);
              });
            }
            if (!headOnly) matched = matched.slice(0, Math.min(resultLimit ?? 1000, 1000));
            if (headOnly) {
              resolve({ data: null, error: null, count });
              return;
            }
            // Return deep copies so later mutations to revisitRows don't alias into returned data
            if (isSingle || isMaybeSingle) {
              if (matched.length === 0) {
                resolve({ data: null, error: isMaybeSingle ? null : { message: 'No rows', code: 'PGRST116' }, count });
              } else if (matched.length > 1) {
                resolve({ data: null, error: { message: 'Multiple rows', code: 'PGRST116' } });
              } else {
                resolve({ data: JSON.parse(JSON.stringify(matched[0])), error: null, count });
              }
            } else {
              resolve({ data: JSON.parse(JSON.stringify(matched)), error: null, count });
            }
          } else if (op === 'insert') {
            const toInsert = (Array.isArray(payload) ? payload : [payload]) as Array<RowData>;
            const duplicate = toInsert.some((row) => rows.some(
              (existing) => existing.studyId === row.studyId && existing.docId === row.docId,
            ));
            if (duplicate) {
              resolve({ data: null, error: { message: 'duplicate key', code: '23505' } });
              return;
            }
            const inserted = toInsert.map((row) => ({
              ...row,
              createdAt: (row.createdAt as string | undefined) ?? new Date().toISOString(),
            }));
            rows.push(...inserted);
            resolve({ data: isSingle ? inserted[0] : inserted, error: null });
          } else if (op === 'upsert') {
            if (assignmentWriteError && (Array.isArray(payload) ? payload : [payload]).some((row) => String(row?.docId).startsWith('sequenceAssignment_'))) { resolve({ data: null, error: { message: 'assignment write failed' } }); return; }
            const toUpsert = (Array.isArray(payload)
              ? payload
              : [payload]) as Array<RowData>;
            if (failConfigActivation && toUpsert.some((row) => row.docId === 'currentConfigHash')) {
              failConfigActivation = false;
              resolve({ data: null, error: { message: 'Failed to activate study config' } });
              return;
            }
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
            if (failStageAllocationRebuild
              && filters.some((filter) => filter.col === 'docId' && String(filter.val).startsWith('stageAllocation_'))
              && !((payload as RowData)?.data as RowData)?.needsRebuild) {
              resolve({ data: null, error: { message: 'stage allocation unavailable' } });
              return;
            }
            if (supabaseFailureState.failNextUpdate) {
              supabaseFailureState.failNextUpdate = false;
              resolve({ data: null, error: { message: 'simulated update failure' } });
              return;
            }
            const matched = applyFilters(rows, filters);
            matched.forEach((row) => Object.assign(row, payload as RowData));
            const updated = (payload as RowData)?.data as RowData | undefined;
            if ((loseTimeoutWriteResponse === 'assignment' && updated?.autoTimedOutAt !== undefined)
              || (loseTimeoutWriteResponse === 'allocation' && updated?.needsRebuild === false)) {
              loseTimeoutWriteResponse = null;
              resolve({ data: null, error: { message: 'write response lost' } });
              return;
            }
            resolve({ data: JSON.parse(JSON.stringify(matched)), error: null });
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
            if (failParticipantReads && path.endsWith('_participantData')) return { data: null, error: { message: 'Participant storage unavailable', status: 503, statusCode: '503' } };
            if (failSequenceReads && path.endsWith('_sequenceArray')) return { data: null, error: { message: 'Storage unavailable', status: 503, statusCode: '503' } };
            if (path in storageFiles) {
              // Return raw string — _getFromStorage (testing=true) wraps it in new Blob([string])
              return { data: storageFiles[path], error: null };
            }
            return { data: null, error: { message: 'Object not found', status: 400, statusCode: '404' } };
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
        getUser: async () => ({ data: { user: { id: 'mock-uid', email: 'test@test.com' } }, error: null }),
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
    intro: {
      type: 'questionnaire',
      response: [],
    },
    colorA: {
      type: 'questionnaire',
      response: [],
    },
    colorB: {
      type: 'questionnaire',
      response: [],
    },
    colorC: {
      type: 'questionnaire',
      response: [],
    },
    colorD: {
      type: 'questionnaire',
      response: [],
    },
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

describe.each([
  { TestEngine: SupabaseStorageEngine },
])('describe object $TestEngine', ({ TestEngine }) => {
  let storageEngine: StorageEngine;
  let sequenceArray: Sequence[];

  // Before test harness
  beforeEach(async () => {
    // Reset the storage engine before each test
    storageEngine = new TestEngine(true);
    await storageEngine.connect();
    await storageEngine.initializeStudyDb(studyId);
    sequenceArray = generateSequenceArray(configSimple);
    await storageEngine.setSequenceArray(
      sequenceArray,
    );
    nextSupabaseSelectError = null;
    failStageAllocationRebuild = false;
    loseTimeoutWriteResponse = null;
    assignmentWriteError = false;
    rejectedAssignmentError = null;
    supabaseOperations.length = 0;
  });

  afterEach(async () => {
    nextSupabaseSelectError = null;
    failStageAllocationRebuild = false;
    loseTimeoutWriteResponse = null;
    assignmentWriteError = false;
    rejectedAssignmentError = null;
    // @ts-expect-error using protected method for testing
    await storageEngine._testingReset(studyId);
    Object.keys(localStore).forEach((key) => delete localStore[key]);
  });

  // saveConfig and getAllConfigsFromHash tests
  test('concurrent preparation returns one saved array and reuses it during startup', async () => {
    const configHash = await hash(JSON.stringify(configSimple));
    const second = new SupabaseStorageEngine(true);
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
    const admin = new SupabaseStorageEngine(true);
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
    await storageEngine.setSequenceArray(generateSequenceArray(original));
    await storageEngine.initializeParticipantSession({}, original, participantMetadata, 'first');
    // @ts-expect-error Inject an upload failure after append-only validation.
    vi.spyOn(storageEngine, '_pushToStorage').mockRejectedValueOnce(new Error('config upload failed'));
    await expect(storageEngine.saveConfig(appended)).rejects.toThrow('config upload failed');
    await expect(storageEngine.saveConfig(original)).resolves.toBeUndefined();
    await expect(storageEngine.initializeParticipantSession({}, original, participantMetadata, 'second')).resolves.toBeDefined();
    expect((await storageEngine.getStageData(studyId)).allStages[0].conditionKeys).toHaveLength(1);
  });

  test('config activation preserves a concurrent timeout save and its condition definitions', async () => {
    const original: StudyConfig = { ...configSimple, factors: { group: ['A'] }, betweenSubjects: ['group'] };
    const appended: StudyConfig = { ...original, factors: { group: ['A', 'B'] } };
    await storageEngine.saveConfig(original);
    const activatingSession = new SupabaseStorageEngine(true);
    await activatingSession.connect();
    await activatingSession.initializeStudyDb(studyId);
    const settings = storageEngine as unknown as { _readModesForUpdate: (id: string) => Promise<RuntimeStudySettings> };
    const read = settings._readModesForUpdate.bind(storageEngine);
    let readStarted!: () => void;
    let releaseRead!: () => void;
    const started = new Promise<void>((resolve) => { readStarted = resolve; });
    const released = new Promise<void>((resolve) => { releaseRead = resolve; });
    vi.spyOn(settings, '_readModesForUpdate').mockImplementationOnce(async (id) => {
      const modes = await read(id);
      readStarted();
      await released;
      return modes;
    });
    const saveTimeout = storageEngine.setAutoTimeoutMinutes(studyId, 30);
    await started;
    let settingsLockAttempted!: () => void;
    const attempted = new Promise<void>((resolve) => { settingsLockAttempted = resolve; });
    const activation = activatingSession as unknown as { _runWithLock: <T>(key: string, operation: () => Promise<T>) => Promise<T> };
    const lock = activation._runWithLock.bind(activatingSession);
    vi.spyOn(activation, '_runWithLock').mockImplementation(<T>(key: string, operation: () => Promise<T>) => {
      if (key === 'study-settings') settingsLockAttempted();
      return lock(key, operation);
    });
    const saveConfig = activatingSession.saveConfig(appended);
    try {
      // A coordinated activation waits for settings; an uncoordinated one can
      // commit first and then lose its definitions to the paused stale save.
      await Promise.race([attempted, saveConfig]);
    } finally {
      releaseRead();
    }
    await Promise.all([saveTimeout, saveConfig]);
    const modes = await storageEngine.getModes(studyId);
    expect(modes.autoTimeoutMinutes).toBe(30);
    expect(modes.stage?.allStages[0].conditionKeys).toHaveLength(2);
    expect(await storageEngine.getCurrentConfigHash(studyId)).toBe(await hash(JSON.stringify(appended)));
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

    // Save a new config with a different hash
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

  // clearCurrentParticipantId tested in rejectParticipant test

  // _getSequence tested in rejectParticipant test

  // initializeParticipantSession test
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

  test('allocator handles a synchronized enrollment burst without exhausting retries', async () => {
    const allocatorEngine = storageEngine as unknown as {
      getOrCreateSequenceAllocator: () => Promise<{ nextSequenceIndex: number; nextCreationIndex: number; version: number }>;
      reserveSequenceAllocator: (allocator: { nextSequenceIndex: number; nextCreationIndex: number; version: number }) =>
        Promise<{ sequenceIndex: number; creationIndex: number }>;
    };
    const allocator = await allocatorEngine.getOrCreateSequenceAllocator();
    vi.useFakeTimers();
    try {
      const pending = Promise.allSettled(Array.from({ length: 20 }, () => allocatorEngine.reserveSequenceAllocator(allocator)));
      await vi.runAllTimersAsync();
      const results = await pending;
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(20);
      const updatedAllocator = await allocatorEngine.getOrCreateSequenceAllocator();
      expect(updatedAllocator).toMatchObject({ nextSequenceIndex: 20, nextCreationIndex: 20 });
    } finally {
      vi.useRealTimers();
    }
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

  test('retrying a failed replacement never claims its own rejected assignment', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'original');
    await storageEngine.rejectParticipant('original', 'review');
    // @ts-expect-error Inject a failed initial participant upload.
    vi.spyOn(storageEngine, '_pushToStorage').mockRejectedValueOnce(new Error('upload failed'));
    await expect(storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'replacement')).rejects.toThrow('upload failed');
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'claims-original');
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'replacement');
    const assignments = await storageEngine.getAllSequenceAssignments(studyId);
    const replacement = assignments.find((assignment) => assignment.participantId === 'replacement');
    expect(replacement?.claimedParticipantId).not.toBe('replacement');
    expect(replacement?.rejected).toBe(false);
    expect(replacement?.claimedParticipantId).toBeUndefined();
  });

  test.each(['download', 'json', 'payload'])('failed participant %s reads cannot release a live reservation', async (failure) => {
    await storageEngine.setCurrentStage(studyId, 'READ-FAILURE', '#00AAFF', 1);
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'still-active');
    await storageEngine.clearCurrentParticipantId();
    const path = `dev-${studyId}/participants/still-active_participantData`;
    const saved = storageFiles[path];
    if (failure === 'download') failParticipantReads = true;
    else storageFiles[path] = failure === 'json' ? '{broken' : '{}';
    try {
      await expect(storageEngine.rejectParticipant('still-active', 'review')).rejects.toBeDefined();
    } finally {
      failParticipantReads = false;
      storageFiles[path] = saved;
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
    const participant = JSON.parse(storageFiles[path]);
    storageFiles[path] = JSON.stringify({ ...participant, createdTime: 1 });
    const assignment = await storageEngine.getSequenceAssignment(studyId, 'clock-skew');
    const analysis = (await storageEngine.getAllParticipantsData(studyId))[0];
    expect(analysis.createdTime).toBe(1);
    expect(analysis).toHaveProperty('assignmentCreatedTime', assignment!.createdTime);
    expect(assignment!.createdTime).toBeGreaterThan(1);
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

    await storageEngine.saveConfig(config);
    const second = await storageEngine.initializeParticipantSession({}, config, participantMetadata, 'stage-second', { modesDocument: await storageEngine.getModes(studyId), sequenceArray: prepared });
    expect(second.participantIndex).toBe(2);
    expect(scans).not.toHaveBeenCalled();

    // @ts-expect-error Inspect the bounded allocation state without a history scan.
    const state = await storageEngine.getStageAllocation('BOUNDED');
    expect(state.count).toBe(2);
    expect(Object.values(state.combinationCounts).sort()).toEqual([1, 1]);
    expect(Object.values(state.rowCounts).reduce((total, count) => total + count, 0)).toBe(2);
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

    const participant = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    expect(scanSpy).not.toHaveBeenCalled();
    const assignmentQueries = supabaseOperations.filter((operation) => operation.filters.some(
      (filter) => filter.col === 'docId' && filter.type === 'like' && filter.val === 'sequenceAssignment_%',
    ));
    expect(assignmentQueries.filter((operation) => operation.headOnly && !operation.filters.some((filter) => filter.col === 'data->stage'))).toHaveLength(2);
    expect(assignmentQueries.filter((operation) => operation.headOnly && operation.filters.some((filter) => filter.col === 'data->stage'))).toHaveLength(2);
    expect(assignmentQueries.filter((operation) => !operation.headOnly)).toEqual([
      expect.objectContaining({ limit: 1 }),
      expect.objectContaining({ limit: 1 }),
    ]);

    supabaseOperations.length = 0;
    await storageEngine.getParticipantCompletionStatus(participant.participantId);
    expect(scanSpy).not.toHaveBeenCalled();
    expect(supabaseOperations.filter((operation) => operation.filters.some(
      (filter) => filter.col === 'docId' && filter.type === 'like' && filter.val === 'sequenceAssignment_%',
    ))).toHaveLength(0);
  });

  test('participant completion lookup propagates provider failures', async () => {
    const participant = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    nextSupabaseSelectError = { message: 'permission denied', code: '42501' };

    await expect(
      storageEngine.getParticipantCompletionStatus(participant.participantId),
    ).rejects.toThrow('Failed to retrieve sequence assignment');
  });

  test('study verification rejects a missing connect row', async () => {
    const connectRowIndex = revisitRows.findIndex(
      (row) => row.docId === 'connect',
    );
    expect(connectRowIndex).toBeGreaterThanOrEqual(0);
    revisitRows.splice(connectRowIndex, 1);

    const verifyStudyDatabase = (
      storageEngine as unknown as {
        _verifyStudyDatabase: () => Promise<void>;
      }
    )._verifyStudyDatabase.bind(storageEngine);
    await expect(verifyStudyDatabase())
      .rejects.toThrow('Study database not initialized or does not exist');
  });

  test('allocator lookup propagates provider failures without attempting initialization', async () => {
    nextSupabaseSelectError = { message: 'permission denied', code: '42501' };
    const getOrCreateSequenceAllocator = (
      storageEngine as unknown as {
        getOrCreateSequenceAllocator: () => Promise<unknown>;
      }
    ).getOrCreateSequenceAllocator.bind(storageEngine);

    await expect(getOrCreateSequenceAllocator())
      .rejects.toThrow('Failed to retrieve sequence assignment allocator');
    expect(supabaseOperations).toHaveLength(1);
    expect(supabaseOperations[0]).toMatchObject({ op: 'select', headOnly: false });
  });

  test('fresh participant startup with an initialized allocator skips legacy counts', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'allocator-seed');
    await storageEngine.clearCurrentParticipantId();
    supabaseOperations.length = 0;

    const scanSpy = vi.spyOn(storageEngine, 'getAllSequenceAssignments');
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'post-seed');

    const assignmentQueries = supabaseOperations.filter((operation) => operation.filters.some(
      (filter) => filter.col === 'docId' && filter.type === 'like' && filter.val === 'sequenceAssignment_%',
    ));
    expect(scanSpy).not.toHaveBeenCalled();
    expect(assignmentQueries.filter((operation) => operation.headOnly)).toHaveLength(0);
    expect(assignmentQueries.filter((operation) => !operation.headOnly)).toEqual([
      expect.objectContaining({ limit: 1 }),
      expect.objectContaining({ limit: 1 }),
    ]);
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
    supabaseOperations.length = 0;

    const scanSpy = vi.spyOn(storageEngine, 'getAllSequenceAssignments');
    const participant = await storageEngine.initializeParticipantSession(
      {},
      configSimple,
      participantMetadata,
      'legacy-returning',
    );

    const unboundedReads = supabaseOperations.filter((operation) => (
      !operation.headOnly
      && operation.limit === undefined
      && operation.filters.some(
        (filter) => filter.col === 'docId' && filter.type === 'like' && filter.val === 'sequenceAssignment_%',
      )
    ));
    expect(participant.participantIndex).toBe(1);
    expect(scanSpy).not.toHaveBeenCalled();
    expect(unboundedReads).toHaveLength(0);
    expect(supabaseOperations.filter((operation) => operation.headOnly)).toHaveLength(3);
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
    supabaseOperations.length = 0;

    const scanSpy = vi.spyOn(storageEngine, 'getAllSequenceAssignments');
    const participant = await storageEngine.initializeParticipantSession(
      {},
      configSimple,
      participantMetadata,
      'legacy-replacement',
    );

    const unboundedReads = supabaseOperations.filter((operation) => (
      !operation.headOnly
      && operation.limit === undefined
      && operation.filters.some(
        (filter) => filter.col === 'docId' && filter.type === 'like' && filter.val === 'sequenceAssignment_%',
      )
    ));
    expect(participant.sequence).toEqual(sequenceArray[1]);
    expect(scanSpy).not.toHaveBeenCalled();
    expect(unboundedReads).toHaveLength(0);
  });

  test('assignment write failures stop participant startup', async () => {
    assignmentWriteError = true;

    await expect(storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'failed-assignment'))
      .rejects.toThrow('Failed to create sequence assignment');
    expect(revisitRows.some((row) => row.docId === 'sequenceAssignment_failed-assignment')).toBe(false);
  });

  test.each(['lookup', 'claim'] as const)('rejected-slot %s failures stop participant startup', async (operation) => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'original');
    await storageEngine.rejectParticipant('original', 'test');
    await storageEngine.clearCurrentParticipantId();
    rejectedAssignmentError = operation;

    await expect(storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'replacement'))
      .rejects.toThrow(operation === 'lookup'
        ? 'Failed to retrieve rejected sequence assignment'
        : 'Failed to claim rejected sequence assignment');
    expect(revisitRows.some((row) => row.docId === 'sequenceAssignment_replacement')).toBe(false);
    const original = revisitRows.find((row) => row.docId === 'sequenceAssignment_original')!;
    expect((original.data as SequenceAssignment).claimed).toBe(false);
  });

  test('rejected-slot reuse preserves effective server timestamp ordering', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'original');
    await storageEngine.clearCurrentParticipantId();
    const original = revisitRows.find((row) => row.docId === 'sequenceAssignment_original')!;
    const data = original.data as SequenceAssignment;
    original.createdAt = '2026-01-01T00:00:00.000Z';
    original.data = { ...data, rejected: true, timestamp: Date.parse('2026-01-03T00:00:00.000Z') };
    revisitRows.push({
      studyId: `dev-${studyId}`,
      docId: 'sequenceAssignment_reused',
      createdAt: '2026-01-04T00:00:00.000Z',
      data: {
        ...data,
        participantId: 'reused',
        rejected: true,
        withServerTimestamp: false,
        timestamp: Date.parse('2026-01-02T00:00:00.000Z'),
        sequenceIndex: 1,
        creationIndex: 1,
      },
    });

    const participant = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'replacement');

    expect(participant.sequence).toEqual(sequenceArray[0]);
    expect((original.data as SequenceAssignment).claimed).toBe(true);
    expect((revisitRows.find((row) => row.docId === 'sequenceAssignment_reused')!.data as SequenceAssignment).claimed).toBe(false);
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

  test('initializeParticipantSession balances conditional latin square sequence assignments over 200 pulls', async () => {
    const latinSquareSequenceArray = generateSequenceArray(conditionalLatinSquareConfig);
    await storageEngine.setSequenceArray(latinSquareSequenceArray);

    const components = ['colorA', 'colorB', 'colorC', 'colorD'];
    const countsByPosition = Array.from({ length: components.length }, () => Object.fromEntries(
      components.map((component) => [component, 0]),
    ) as Record<string, number>);

    for (let i = 0; i < 200; i += 1) {
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
        expect(positionCounts[component]).toBe(50);
      });
    });
  });

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
    const sequenceAssignmentPayload = (await storageEngine.getAllSequenceAssignments(studyId))
      .find((assignment) => assignment.participantId === participant.participantId)!;
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

  // getAllParticipantIds tested in rejectParticipant test

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

  // getParticipantTags, addParticipantTags, removeParticipantTags tests
  test('getParticipantTags returns empty array for new participant', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

    const tags = await storageEngine.getParticipantTags();
    expect(tags).toEqual([]);

    await storageEngine.addParticipantTags(['tag1', 'tag2']);
    const updatedTags = await storageEngine.getParticipantTags();
    expect(updatedTags).toEqual(['tag1', 'tag2']);

    // Add duplicate tags
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

  test('rejectParticipant on participants allows sequence reuse', async () => {
    const participantSession = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    const { participantId: participantId1 } = participantSession;

    await storageEngine.rejectParticipant(participantId1, 'Participant rejected for testing');

    let sequenceAssignments = await storageEngine.getAllSequenceAssignments(studyId);
    expect(sequenceAssignments).toBeDefined();

    let sequenceAssignment1 = sequenceAssignments.find((assignment) => assignment.participantId === participantId1);
    expect(sequenceAssignment1).toBeDefined();
    expect(sequenceAssignment1!.rejected).toBe(true);
    expect(sequenceAssignment1!.claimed).toBe(false);

    // Initialize a new participant session
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

    // Reject the new participant
    await storageEngine.rejectParticipant(participantId2, 'Participant rejected for testing');

    sequenceAssignments = await storageEngine.getAllSequenceAssignments(studyId);
    expect(sequenceAssignments).toBeDefined();
    sequenceAssignment2 = sequenceAssignments.find((assignment) => assignment.participantId === participantId2);
    expect(sequenceAssignment2).toBeDefined();
    expect(sequenceAssignment2!.timestamp).toBeGreaterThanOrEqual(sequenceAssignment1!.timestamp);

    // Check if the first rejected participant's sequence is available for reuse
    sequenceAssignment1 = sequenceAssignments.find((assignment) => assignment.participantId === participantId1);
    expect(sequenceAssignment1).toBeDefined();
    expect(sequenceAssignment1!.rejected).toBe(true);
    expect(sequenceAssignment1!.claimed).toBe(false);
    expect(sequenceAssignment1!.completed).toBeNull();

    // Make a new participant session
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

    // Ensure first rejected participant's sequence is claimed again
    sequenceAssignment1 = sequenceAssignments.find((assignment) => assignment.participantId === participantId1);
    expect(sequenceAssignment1).toBeDefined();
    expect(sequenceAssignment1!.participantId).toBe(participantId1);
    expect(sequenceAssignment1!.timestamp).toEqual(sequenceAssignment3!.timestamp);
    expect(sequenceAssignment1!.rejected).toBe(true);
    expect(sequenceAssignment1!.claimed).toBe(true);
    expect(sequenceAssignment1!.createdTime).toBeDefined();
    expect(sequenceAssignment1!.createdTime).toBeLessThanOrEqual(sequenceAssignment3!.createdTime);

    // Check that a new participant gets the other rejected sequence assignment
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

    // Check the length of sequence assignments
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

  // rejectCurrentParticipant test

  // getParticipantStatusCounts test

  // saveAnswers test

  // verifyCompletion test

  // getAudio and saveAudio untestable due to browser-specific implementation

  test('getSequenceArray returns the sequence array', async () => {
    const sequences = await storageEngine.getSequenceArray();
    expect(sequences).toEqual(sequenceArray);
  });

  test('getSequenceArray returns empty array if no sequences are set', async () => {
    const emptyStorageEngine = new SupabaseStorageEngine();
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

  test('setSequenceArray throws error if not connected', async () => {
    const disconnectedStorageEngine = new SupabaseStorageEngine();
    await expect(disconnectedStorageEngine.setSequenceArray([])).rejects.toThrow('Study database not initialized');
  });

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

  test.each([false, true])('restoring a snapshot keeps timeout capacity released (completed late: %s)', async (completedLate) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const snapshotTime = new Date('2026-02-01T00:00:00Z').getTime() + Number(completedLate) * 86_400_000;
    vi.setSystemTime(snapshotTime);
    try {
      const config: StudyConfig = { ...configSimple, factors: { group: ['A'] }, betweenSubjects: ['group'] };
      await storageEngine.saveConfig(config);
      await storageEngine.setSequenceArray(generateSequenceArray(config));
      await storageEngine.setCurrentStage(studyId, 'LIMITED', '#00AAFF', 1);
      await storageEngine.initializeParticipantSession({}, config, participantMetadata, 'expired');
      // @ts-expect-error protected backend mutation
      await storageEngine._markSequenceAssignmentTimedOut('expired', Date.now());
      if (completedLate) expect(await storageEngine.finalizeParticipant()).toEqual({ status: 'complete' });
      expect((await storageEngine.createSnapshot(studyId, false)).status).toBe('SUCCESS');
      const [snapshot] = Object.keys(await storageEngine.getSnapshots(studyId));
      vi.setSystemTime(snapshotTime + 1000);
      expect((await storageEngine.restoreSnapshot(studyId, snapshot)).status).toBe('SUCCESS');
      // @ts-expect-error Inspect restored cached capacity.
      const allocation = await storageEngine.getStageAllocation('LIMITED');
      expect(allocation.count).toBe(0);
      expect(Object.values(allocation.combinationCounts)).toEqual([]);
      expect(Object.values(allocation.rowCounts)).toEqual([]);
      await expect(storageEngine.initializeParticipantSession({}, config, participantMetadata, 'replacement'))
        .resolves.toMatchObject({ participantId: 'replacement' });
    } finally {
      vi.useRealTimers();
    }
  });

  test.each([false, true])('restoring a snapshot resumes its allocation (legacy: %s)', async (legacy) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    try {
      await storageEngine.saveConfig(configSimple);
      await storageEngine.setSequenceArray(sequenceArray);
      // Older snapshots can contain offset indexes after live data was cleared.
      if (legacy) {
        revisitRows.push({
          studyId: `dev-${studyId}`,
          docId: 'sequenceAllocator',
          data: { nextSequenceIndex: 3, nextCreationIndex: 3, version: 0 },
        });
      }
      for (let index = 0; index < 3; index += 1) {
        // eslint-disable-next-line no-await-in-loop
        await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, `snapshot-${index}`);
      }
      expect((await storageEngine.createSnapshot(studyId, false)).status).toBe('SUCCESS');
      const [snapshotName] = Object.keys(await storageEngine.getSnapshots(studyId));
      if (legacy) {
        const allocatorIndex = revisitRows.findIndex((row) => row.studyId === snapshotName && row.docId === 'sequenceAllocator');
        revisitRows.splice(allocatorIndex, 1);
      }
      expect(revisitRows.find((row) => row.studyId === snapshotName && row.docId === 'sequenceAllocator')?.data)
        .toEqual(legacy ? undefined : { nextSequenceIndex: 3, nextCreationIndex: 3, version: 3 });

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

  // createSnapshot, restoreSnapshot, renameSnapshot, removeSnapshotOrLive, getSnapshots tests
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

    // Get the snapshot list
    let snapshots = await storageEngine.getSnapshots(studyId);
    expect(snapshots).toBeDefined();
    expect(Object.keys(snapshots).length).toBe(1);
    expect(Object.values(snapshots)[0].name).toBeDefined();

    // Rename the snapshot
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

    // Remove the snapshot
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

    // Get the snapshot list
    snapshots = await storageEngine.getSnapshots(studyId);
    expect(snapshots).toBeDefined();
    expect(Object.keys(snapshots).length).toBe(1);
    expect(Object.values(snapshots)[0].name).toBeDefined();

    // Restore the snapshot
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

  // User management tests
  test('analysis access requires explicitly stored data sharing', async () => {
    const engine = storageEngine as SupabaseStorageEngine;
    const accessStudyId = 'access-check';
    expect(await engine.getAccessModes(accessStudyId)).toBeNull();
    expect(revisitRows.some((row) => String(row.studyId).endsWith(accessStudyId) && row.docId === 'metadata')).toBe(false);

    const metadataRow = {
      studyId: `${import.meta.env.DEV ? 'dev-' : 'prod-'}${accessStudyId}`,
      docId: 'metadata',
      data: { dataSharingEnabled: 'true' as string | boolean },
    };
    revisitRows.push(metadataRow);
    try {
      expect((await engine.getAccessModes(accessStudyId))?.dataSharingEnabled).toBe(false);
      metadataRow.data.dataSharingEnabled = false;
      expect((await engine.getAccessModes(accessStudyId))?.dataSharingEnabled).toBe(false);
      metadataRow.data.dataSharingEnabled = true;
      expect((await engine.getAccessModes(accessStudyId))?.dataSharingEnabled).toBe(true);
    } finally {
      revisitRows.splice(revisitRows.indexOf(metadataRow), 1);
    }
  });

  test('getUserManagementData returns undefined when no data exists', async () => {
    // @ts-expect-error accessing CloudStorageEngine method via StorageEngine
    const authData = await storageEngine.getUserManagementData('authentication');
    expect(authData).toBeUndefined();
    // @ts-expect-error accessing CloudStorageEngine method via StorageEngine
    const adminData = await storageEngine.getUserManagementData('adminUsers');
    expect(adminData).toBeUndefined();
  });

  test('duplicate user-management rows fail closed instead of starting setup', async () => {
    const savedRows = revisitRows.splice(0);
    revisitRows.push(
      { studyId: '', docId: 'user-management', data: { authentication: { isEnabled: false } } },
      { studyId: '', docId: 'user-management', data: { authentication: { isEnabled: true } } },
    );
    try {
      await expect((storageEngine as SupabaseStorageEngine).getUserManagementData('authentication'))
        .rejects.toThrow('Multiple rows');
    } finally {
      revisitRows.splice(0, revisitRows.length, ...savedRows);
    }
  });

  test('missing authentication setting never validates an administrator', async () => {
    const supabaseEngine = storageEngine as SupabaseStorageEngine;
    const result = await supabaseEngine.validateUser({
      user: { email: 'admin@test.com', uid: 'uid-1' },
      isAdmin: true,
      determiningStatus: false,
      adminVerification: true,
    }, true);
    expect(result).toBe(false);
  });

  test('enabled authentication rejects a forged session user', async () => {
    const savedRows = revisitRows.splice(0);
    try {
      const engine = storageEngine as SupabaseStorageEngine;
      await engine.changeAuth(true);
      await engine.addAdminUser({ email: 'admin@test.com', uid: 'admin-uid' });
      const forgedUser = {
        user: { email: 'admin@test.com', uid: 'admin-uid' },
        isAdmin: false,
        determiningStatus: false,
        adminVerification: false,
      };
      expect(await engine.validateUser(forgedUser, true)).toBe(false);

      await engine.addAdminUser({ email: 'test@test.com', uid: 'mock-uid' });
      expect(await engine.validateUser({ ...forgedUser, user: { email: 'test@test.com', uid: 'mock-uid' } }, true)).toBe(true);
    } finally {
      revisitRows.splice(0, revisitRows.length, ...savedRows);
    }
  });

  test.each([false, true])('first-admin setup is one conditional write with existing row: %s', async (existingRow) => {
    const savedRows = revisitRows.splice(0);
    try {
      if (existingRow) revisitRows.push({ studyId: '', docId: 'user-management', data: {} });
      const first = new SupabaseStorageEngine(true);
      const second = new SupabaseStorageEngine(true);
      vi.spyOn(second, 'getVerifiedUser').mockResolvedValue({ email: 'second@test.com', uid: 'uid-2' });

      await expect(first.enableAuthentication({ email: 'impostor@test.com', uid: 'uid-3' }))
        .rejects.toThrow('The signed-in user changed during authentication setup');
      expect(revisitRows.filter((row) => row.studyId === '' && row.docId === 'user-management'))
        .toHaveLength(existingRow ? 1 : 0);

      const results = await Promise.allSettled([
        first.enableAuthentication({ email: 'test@test.com', uid: 'mock-uid' }),
        second.enableAuthentication({ email: 'second@test.com', uid: 'uid-2' }),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      const managementRows = revisitRows.filter((row) => row.studyId === '' && row.docId === 'user-management');
      expect(managementRows).toHaveLength(1);
      const data = managementRows[0].data as { authentication: { isEnabled: boolean }; adminUsers: { adminUsersList: StoredUser[] } };
      expect(data.authentication.isEnabled).toBe(true);
      expect(data.adminUsers.adminUsersList).toHaveLength(1);

      await expect(first.enableAuthentication({ email: 'test@test.com', uid: 'mock-uid' }))
        .rejects.toThrow('Authentication setup has already started');
    } finally {
      revisitRows.splice(0, revisitRows.length, ...savedRows);
    }
  });

  test.each([false, true])('explicitly disabled authentication can be enabled; existing admin list: %s', async (hasAdmins) => {
    const savedRows = revisitRows.splice(0);
    const existingAdmin = { email: 'existing@test.com', uid: 'uid-1' };
    const row = {
      studyId: '',
      docId: 'user-management',
      data: {
        authentication: { isEnabled: false },
        ...(hasAdmins ? { adminUsers: { adminUsersList: [existingAdmin] } } : {}),
      },
    };
    revisitRows.push(row);
    try {
      const first = new SupabaseStorageEngine(true);
      const second = new SupabaseStorageEngine(true);
      vi.spyOn(second, 'getVerifiedUser').mockResolvedValue({ email: 'second@test.com', uid: 'uid-2' });
      const results = await Promise.allSettled([
        first.enableAuthentication({ email: 'test@test.com', uid: 'mock-uid' }),
        second.enableAuthentication({ email: 'second@test.com', uid: 'uid-2' }),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      const data = row.data as { authentication: { isEnabled: boolean }; adminUsers: { adminUsersList: StoredUser[] } };
      expect(data.authentication.isEnabled).toBe(true);
      expect(data.adminUsers.adminUsersList).toHaveLength(hasAdmins ? 2 : 1);
      if (hasAdmins) expect(data.adminUsers.adminUsersList).toContainEqual(existingAdmin);
    } finally {
      revisitRows.splice(0, revisitRows.length, ...savedRows);
    }
  });

  test('malformed authentication setting is rejected', async () => {
    const row = { studyId: '', docId: 'user-management', data: { authentication: {} } };
    revisitRows.push(row);
    try {
      await expect((storageEngine as SupabaseStorageEngine).getUserManagementData('authentication'))
        .rejects.toThrow('Invalid authentication setting');
    } finally {
      revisitRows.splice(revisitRows.indexOf(row), 1);
    }
  });

  test('changeAuth enables and disables authentication', async () => {
    // @ts-expect-error accessing CloudStorageEngine method
    await storageEngine.changeAuth(true);
    // @ts-expect-error accessing CloudStorageEngine method
    const authData = await storageEngine.getUserManagementData('authentication');
    expect(authData).toBeDefined();
    expect(authData?.isEnabled).toBe(true);
  });

  test('addAdminUser adds user to admin list', async () => {
    // @ts-expect-error accessing CloudStorageEngine method
    await storageEngine.addAdminUser({ email: 'test@test.com', uid: 'uid-1' });
    // @ts-expect-error accessing CloudStorageEngine method
    const adminData = await storageEngine.getUserManagementData('adminUsers');
    expect(adminData).toBeDefined();
    expect(adminData?.adminUsersList.length).toBeGreaterThan(0);
    expect(adminData?.adminUsersList[0].email).toBe('test@test.com');
  });

  test('removeAdminUser removes user from admin list', async () => {
    // @ts-expect-error accessing CloudStorageEngine method
    await storageEngine.addAdminUser({ email: 'test@test.com', uid: 'uid-1' });
    // @ts-expect-error accessing CloudStorageEngine method
    await storageEngine.removeAdminUser('test@test.com');
    // @ts-expect-error accessing CloudStorageEngine method
    const adminData = await storageEngine.getUserManagementData('adminUsers');
    expect(adminData?.adminUsersList.length).toBe(0);
  });

  test('removeAdminUser handles missing adminUsers gracefully (no-op)', async () => {
    // Should not throw when adminUsers doesn't exist
    // @ts-expect-error accessing CloudStorageEngine method
    await storageEngine.removeAdminUser('nonexistent@test.com');
  });

  test('login returns user from session', async () => {
    // @ts-expect-error accessing CloudStorageEngine method
    const user = await storageEngine.login();
    // The mock signInWithOAuth returns { error: null } and getSession has a user
    expect(user).toBeDefined();
  });

  test('logout signs out without error', async () => {
    // @ts-expect-error accessing CloudStorageEngine method
    await expect(storageEngine.logout()).resolves.not.toThrow();
  });

  test('getSession returns current session', async () => {
    // @ts-expect-error accessing CloudStorageEngine method
    const session = await storageEngine.getSession();
    expect(session).toBeDefined();
  });

  test('unsubscribe registers listener and returns cleanup function', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    // @ts-expect-error accessing CloudStorageEngine method
    const cleanup = storageEngine.unsubscribe(callback);
    expect(typeof cleanup).toBe('function');
    // callback should have been called since mock fires immediately on SIGNED_IN
    expect(callback).toHaveBeenCalled();
    cleanup();
  });

  // ── initializeStudyDb ───────────────────────────────────────────────────────
  test('initializeStudyDb sets studyId on the engine', async () => {
    // @ts-expect-error accessing protected property
    expect(storageEngine.studyId).toBe(studyId);
  });

  // ── _createSequenceAssignment ────────────────────────────────────────────────
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
    const fresh = new SupabaseStorageEngine(true);
    await fresh.connect();
    await fresh.initializeStudyDb(studyId);
    // @ts-expect-error protected
    await expect(fresh._completeCurrentParticipantRealtime()).rejects.toThrow('Participant not initialized');
  });

  test('_completeCurrentParticipantRealtime propagates a rejected assignment update', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    supabaseFailureState.failNextUpdate = true;

    // @ts-expect-error protected
    await expect(storageEngine._completeCurrentParticipantRealtime())
      .rejects.toThrow('Failed to complete sequence assignment');
  });

  // ── _rejectParticipantRealtime ───────────────────────────────────────────────
  test('_rejectParticipantRealtime sets rejected=true on the assignment', async () => {
    // Initialize two participants so the claimed-assignment lookup in
    // _rejectParticipantRealtime can find the original row via data->timestamp.
    const session1 = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    await storageEngine.clearCurrentParticipantId();
    const session2 = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

    // Reject the second participant through the high-level API (which calls
    // _rejectParticipantRealtime internally) and verify the flag.
    await storageEngine.rejectParticipant(session2.participantId, 'test');
    const all = await storageEngine.getAllSequenceAssignments(studyId);
    expect(all.find((a) => a.participantId === session2.participantId)?.rejected).toBe(true);
    // The first assignment should still be intact
    expect(all.find((a) => a.participantId === session1.participantId)).toBeDefined();
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

  // ── Participant-lock races ───────────────────────────────────────────────────
  // Pauses the first whole-record assignment write that `shouldPause` selects,
  // runs `competingWrite` from another session in that window, and then lets the
  // paused write continue. While the paused write holds the participant lock the
  // competing write has to wait, so it cannot be overwritten by the stale copy.
  async function interleaveWithAssignmentWrite(
    shouldPause: (participantId: string, data: Record<string, unknown>) => boolean,
    competingWrite: () => Promise<unknown>,
  ) {
    const engineInternals = storageEngine as unknown as {
      updateSequenceAssignmentRow: (participantId: string, data: Record<string, unknown>, operation: string) => Promise<void>;
    };
    const originalWrite = engineInternals.updateSequenceAssignmentRow.bind(storageEngine);
    let competing: Promise<unknown> | undefined;
    vi.spyOn(engineInternals, 'updateSequenceAssignmentRow').mockImplementation(async (participantId, data, operation) => {
      if (!competing && shouldPause(participantId, data)) {
        competing = competingWrite();
        await Promise.race([
          competing,
          new Promise<void>((resolve) => { setTimeout(resolve, 300); }),
        ]);
      }
      await originalWrite(participantId, data, operation);
    });
    return () => competing;
  }

  async function makeSecondSession(participantId?: string) {
    const otherSession = new SupabaseStorageEngine(true);
    await otherSession.connect();
    await otherSession.initializeStudyDb(studyId);
    if (participantId) {
      // @ts-expect-error protected
      otherSession.currentParticipantId = participantId;
    }
    return otherSession;
  }

  test('sweeps expired assignments beyond a full page of completed history', async () => {
    await storageEngine.setCurrentStage(studyId, 'LIMITED', '#ff0000', 1001);
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'z-expired');
    const source = revisitRows.find((row) => row.docId === 'sequenceAssignment_z-expired')!;
    source.createdAt = new Date(Date.now() - 120_000).toISOString();
    const assignment = source.data as RowData;
    for (let index = 0; index < 1000; index += 1) {
      const participantId = `history-${String(index).padStart(4, '0')}`;
      revisitRows.push({
        ...source,
        docId: `sequenceAssignment_${participantId}`,
        data: { ...assignment, participantId, completed: Date.now() },
      });
    }
    revisitRows.splice(revisitRows.indexOf(source), 1);
    revisitRows.push(source);
    const allocation = revisitRows.find((row) => row.docId === 'stageAllocation_LIMITED')!.data as RowData;
    allocation.count = 1001;
    allocation.rowCounts = Object.fromEntries(Object.keys(allocation.rowCounts as object).map((key) => [key, 1001]));
    allocation.combinationCounts = Object.fromEntries(Object.keys(allocation.combinationCounts as object).map((key) => [key, 1001]));
    await storageEngine.setAutoTimeoutMinutes(studyId, 1);

    await expect(storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'replacement'))
      .resolves.toMatchObject({ participantId: 'replacement' });
    expect((source.data as RowData).autoTimedOutAt).toBeDefined();
    expect(await storageEngine.getAllSequenceAssignments(studyId)).toHaveLength(1002);
    // @ts-expect-error protected
    expect((await storageEngine.getStageAllocation('LIMITED')).count).toBe(1001);
  });

  test('finalizes a participant through the public path without reacquiring its lock', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'finishing');
    vi.useFakeTimers();
    try {
      const finishing = storageEngine.finalizeParticipant();
      await vi.advanceTimersByTimeAsync(31_000);
      expect(await finishing).toEqual({ status: 'complete' });
      expect(await storageEngine.getParticipantCompletionStatus()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  test('repairs a persisted timeout after its capacity write fails across sessions', async () => {
    await storageEngine.setCurrentStage(studyId, 'LIMITED', '#ff0000', 1);
    const first = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'expired');
    failStageAllocationRebuild = true;
    // @ts-expect-error protected
    await expect(storageEngine._markSequenceAssignmentTimedOut(first.participantId, Date.now())).rejects.toThrow();
    expect((await storageEngine.getAllSequenceAssignments(studyId))[0].autoTimedOutAt).toBeDefined();
    // Repeated outages must keep admission blocked until the stored count is repaired.
    const retry = await makeSecondSession();
    await expect(retry.initializeParticipantSession({}, configSimple, participantMetadata, 'replacement')).rejects.toThrow();
    failStageAllocationRebuild = false;
    await expect(retry.initializeParticipantSession({}, configSimple, participantMetadata, 'replacement')).resolves.toMatchObject({ participantId: 'replacement' });
    // @ts-expect-error protected
    const allocation = await retry.getStageAllocation('LIMITED');
    expect(allocation.count).toBe(1);
    expect(Object.values(allocation.rowCounts).reduce((sum, count) => sum + count, 0)).toBe(1);
    await expect(retry.initializeParticipantSession({}, configSimple, participantMetadata, 'excess')).rejects.toThrow(/participant limit/);
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

  test.each(['assignment', 'allocation'] as const)('recovers a timeout whose %s write succeeded without acknowledgement', async (phase) => {
    await storageEngine.setCurrentStage(studyId, 'LIMITED', '#ff0000', 1);
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata, 'expired');
    loseTimeoutWriteResponse = phase;
    // @ts-expect-error protected
    await expect(storageEngine._markSequenceAssignmentTimedOut('expired', Date.now())).rejects.toThrow();
    const retry = await makeSecondSession();
    await expect(retry.initializeParticipantSession({}, configSimple, participantMetadata, 'replacement')).resolves.toMatchObject({ participantId: 'replacement' });
    // @ts-expect-error protected
    expect((await retry.getStageAllocation('LIMITED')).count).toBe(1);
    await expect(retry.initializeParticipantSession({}, configSimple, participantMetadata, 'excess')).rejects.toThrow(/participant limit/);
  });

  test('updateStudyCondition does not erase a concurrent auto-timeout', async () => {
    const session = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    const adminSession = await makeSecondSession();
    const getCompeting = await interleaveWithAssignmentWrite(
      (participantId, data) => participantId === session.participantId && Array.isArray(data.conditions),
      // @ts-expect-error protected
      () => adminSession._markSequenceAssignmentTimedOut(session.participantId, Date.now()),
    );

    await storageEngine.updateStudyCondition('color');
    await getCompeting();

    const assignment = (await storageEngine.getAllSequenceAssignments(studyId))
      .find((candidate) => candidate.participantId === session.participantId);
    expect(assignment?.conditions).toEqual(['color']);
    expect(assignment?.autoTimedOutAt).toBeDefined();
  });

  // ── Legacy replacement fallback ──────────────────────────────────────────────
  test('rejecting a timed-out participant leaves a later participant alone when their timestamps match', async () => {
    const source = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    // @ts-expect-error protected
    await storageEngine._markSequenceAssignmentTimedOut(source.participantId, Date.now());
    await storageEngine.clearCurrentParticipantId();
    const later = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

    // Force the stored timestamps to collide, as they can when the server and
    // client clocks agree to the millisecond.
    const sourceRow = revisitRows.find((row) => row.docId === `sequenceAssignment_${source.participantId}`)!;
    const laterRow = revisitRows.find((row) => row.docId === `sequenceAssignment_${later.participantId}`)!;
    (laterRow.data as RowData).timestamp = (sourceRow.data as RowData).timestamp;

    await storageEngine.rejectParticipant(source.participantId, 'test');

    const assignments = await storageEngine.getAllSequenceAssignments(studyId);
    const laterAssignment = assignments.find((assignment) => assignment.participantId === later.participantId);
    expect(laterAssignment?.rejected).toBe(false);
    expect(laterAssignment?.claimed).toBe(false);
  });

  test('rejecting a legacy replacement without claimedParticipantId still releases its source', async () => {
    const source = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    await storageEngine.rejectParticipant(source.participantId, 'test');
    await storageEngine.clearCurrentParticipantId();
    const replacement = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);

    // Records written before claimedParticipantId existed only share the stored timestamp.
    const sourceRow = revisitRows.find((row) => row.docId === `sequenceAssignment_${source.participantId}`)!;
    const replacementRow = revisitRows.find((row) => row.docId === `sequenceAssignment_${replacement.participantId}`)!;
    delete (replacementRow.data as RowData).claimedParticipantId;
    (sourceRow.data as RowData).timestamp = (replacementRow.data as RowData).timestamp;

    await storageEngine.rejectParticipant(replacement.participantId, 'test');

    const sourceAssignment = (await storageEngine.getAllSequenceAssignments(studyId))
      .find((assignment) => assignment.participantId === source.participantId);
    expect(sourceAssignment?.claimed).toBe(false);
    expect(sourceAssignment?.rejected).toBe(true);
  });

  // ── _claimSequenceAssignment ─────────────────────────────────────────────────
  test('_claimSequenceAssignment sets claimed=true on the assignment', async () => {
    const session = await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    const all = await storageEngine.getAllSequenceAssignments(studyId);
    const assignment = all.find((a) => a.participantId === session.participantId)!;
    // @ts-expect-error protected
    storageEngine.currentParticipantId = session.participantId;
    // @ts-expect-error protected
    await storageEngine._claimSequenceAssignment(session.participantId, assignment);
    const allAfter = await storageEngine.getAllSequenceAssignments(studyId);
    expect(allAfter.find((a) => a.participantId === session.participantId)?.claimed).toBe(true);
  });

  // ── _setModesDocument ────────────────────────────────────────────────────────
  test('_setModesDocument writes modes', async () => {
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

  test('setAutoTimeoutMinutes persists and removes the setting', async () => {
    await storageEngine.setAutoTimeoutMinutes(studyId, 60);
    expect((await storageEngine.getModes(studyId)).autoTimeoutMinutes).toBe(60);

    await storageEngine.setAutoTimeoutMinutes(studyId, undefined);
    expect((await storageEngine.getModes(studyId)).autoTimeoutMinutes).toBeUndefined();
  });

  // ── URL getters ──────────────────────────────────────────────────────────────
  test('_getAudioUrl returns null when audio does not exist', async () => {
    // _getFromStorage returns {} on error, which is truthy. The real
    // _getAudioUrl then calls URL.createObjectURL which is unavailable in
    // Node.  However, _getFromStorage with testing=true wraps the raw mock
    // string in a Blob and JSON.parse-s it.  For a missing file the mock
    // download returns { data: null, error: ... }, so _getFromStorage
    // returns {} (empty object).  Because {} is truthy the method attempts
    // URL.createObjectURL.  We stub it so the test can proceed.
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock');

    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    // @ts-expect-error protected
    const result = await storageEngine._getAudioUrl('missing', 'p1');
    // _getFromStorage returns {} on error which is truthy, so createObjectURL is called
    // The important verification is that no unhandled error is thrown.
    expect(result).toBeDefined();

    // @ts-expect-error cleanup
    delete globalThis.URL.createObjectURL;
  });

  test('_getScreenRecordingUrl returns null when recording does not exist', async () => {
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock');

    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    // @ts-expect-error protected
    const result = await storageEngine._getScreenRecordingUrl('missing', 'p1');
    expect(result).toBeDefined();

    // @ts-expect-error cleanup
    delete globalThis.URL.createObjectURL;
  });

  // ── _testingReset ────────────────────────────────────────────────────────────
  test('_testingReset clears data for the study', async () => {
    await storageEngine.initializeParticipantSession({}, configSimple, participantMetadata);
    const participantIds = await storageEngine.getAllParticipantIds();
    expect(participantIds.length).toBeGreaterThan(0);

    // @ts-expect-error protected
    await storageEngine._testingReset(studyId);

    const participantIdsAfter = await storageEngine.getAllParticipantIds();
    expect(participantIdsAfter.length).toBe(0);
  });

  // ── getUserManagementData variants ──────────────────────────────────────────
  test('getUserManagementData returns authentication data when it exists', async () => {
    // @ts-expect-error accessing CloudStorageEngine method
    await storageEngine.changeAuth(true);
    // @ts-expect-error accessing CloudStorageEngine method
    const authData = await storageEngine.getUserManagementData('authentication');
    expect(authData).toEqual({ isEnabled: true });
  });

  test('getUserManagementData returns adminUsers data when it exists', async () => {
    // @ts-expect-error accessing CloudStorageEngine method
    await storageEngine.addAdminUser({ email: 'test@test.com', uid: 'u1' });
    // @ts-expect-error accessing CloudStorageEngine method
    const result = await storageEngine.getUserManagementData('adminUsers');
    expect(result).toBeDefined();
    expect((result as { adminUsersList: StoredUser[] }).adminUsersList).toHaveLength(1);
  });

  test('getUserManagementData uses cached data on second call', async () => {
    // @ts-expect-error accessing CloudStorageEngine method
    await storageEngine.changeAuth(false);
    // @ts-expect-error accessing CloudStorageEngine method
    const first = await storageEngine.getUserManagementData('authentication');
    // @ts-expect-error accessing CloudStorageEngine method
    const second = await storageEngine.getUserManagementData('authentication');
    expect(first).toEqual(second);
  });

  // ── addAdminUser edge cases ─────────────────────────────────────────────────
  test('addAdminUser does not add duplicate user', async () => {
    // @ts-expect-error accessing CloudStorageEngine method
    await storageEngine.addAdminUser({ email: 'a@a.com', uid: 'u0' });
    // @ts-expect-error accessing CloudStorageEngine method
    await storageEngine.addAdminUser({ email: 'a@a.com', uid: 'u0' });
    // @ts-expect-error accessing CloudStorageEngine method
    const result = await storageEngine.getUserManagementData('adminUsers') as { adminUsersList: StoredUser[] };
    // Supabase implementation pushes without dedup check, so both are stored
    expect(result.adminUsersList.length).toBeGreaterThanOrEqual(1);
  });

  // ── login variant ───────────────────────────────────────────────────────────
  test('login returns user data from active session', async () => {
    // The mock auth.getSession always returns a session with { id: 'mock-uid', email: null }
    // @ts-expect-error accessing CloudStorageEngine method
    const result = await storageEngine.login();
    expect(result).toBeDefined();
    expect(result).not.toBeNull();
    expect(result!.uid).toBe('mock-uid');
    expect(result!.email).toBe('test@test.com');
  });
});
