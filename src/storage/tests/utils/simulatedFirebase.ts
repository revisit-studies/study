/**
 * A simulated Firebase backend for load-performance tests.
 *
 * Each Firestore and Cloud Storage call waits a virtual delay before it
 * resolves, priced after what the real SDK does on the wire, so a scenario's
 * virtual duration is its critical path: calls made in sequence add up, calls
 * made together overlap. Everything else resolves in microtasks, so results do
 * not depend on the machine or on real time.
 *
 * Data semantics (merges, queries, optimistic transactions) follow the
 * in-memory mock in highLevelFirebase.spec.ts.
 */
import { createHash } from 'node:crypto';
import { vi } from 'vitest';

type DocData = Record<string, unknown>;

type Ref = { _path: string; id?: string; _longPolling: boolean; _constraints?: QueryConstraint[] };

type QueryConstraint = {
  type: 'where' | 'limit' | 'orderBy';
  field?: string;
  operator?: string;
  value?: unknown;
  count?: number;
  direction?: 'asc' | 'desc';
};

export type NetworkCall = {
  kind: string;
  target: string;
  start: number;
  end: number;
  bytes: number;
};

/** One network round trip, in virtual milliseconds. */
export const ROUND_TRIP_MS = 100;

/** Download and upload bandwidth: 10 Mbit/s. */
const BYTES_PER_MS = 1250;

const SERVER_TIMESTAMP = { __sentinel: 'serverTimestamp' };
const DELETE_FIELD = { __sentinel: 'deleteField' };

export const simulation = {
  firestoreData: {} as Record<string, DocData>,
  storageObjects: {} as Record<string, string>,
  // Bytes sent over the network for objects stored gzipped; others send their text.
  storageWireBytes: {} as Record<string, number>,
  // Each simulated browser has its own local storage.
  browserStores: {} as Record<string, Record<string, unknown>>,
  currentBrowser: 'browser-0',
  calls: [] as NetworkCall[],
  pendingRealWork: 0,
};

export const transactionStats = {
  retries: 0,
  aborted: 0,
  maxAttempts: 0,
};

// A seeded Park-Miller generator for transaction backoff jitter, reset with
// the simulation so every run draws the same delays.
let jitterState = 1;
function nextJitter() {
  jitterState = (jitterState * 48271) % 2147483647;
  return jitterState / 2147483647 - 0.5;
}

export function resetSimulation() {
  simulation.firestoreData = {};
  simulation.storageObjects = {};
  simulation.storageWireBytes = {};
  simulation.browserStores = {};
  simulation.currentBrowser = 'browser-0';
  simulation.calls = [];
  simulation.pendingRealWork = 0;
  transactionStats.retries = 0;
  transactionStats.aborted = 0;
  transactionStats.maxAttempts = 0;
  jitterState = 1;
}

/** Engines constructed after this call use the named browser's local storage. */
export function switchBrowser(name: string) {
  simulation.currentBrowser = name;
}

async function network(kind: string, target: string, roundTrips: number, bytes = 0) {
  const start = Date.now();
  const duration = roundTrips * ROUND_TRIP_MS + Math.ceil(bytes / BYTES_PER_MS);
  await new Promise<void>((resolve) => { setTimeout(resolve, duration); });
  simulation.calls.push({
    kind, target, start, end: Date.now(), bytes,
  });
}

// Work that resolves in real time, such as reading a Blob. The runner waits for
// it before advancing virtual time, so it cannot be mistaken for network time.
function trackRealWork<T>(work: Promise<T>) {
  simulation.pendingRealWork += 1;
  return work.finally(() => { simulation.pendingRealWork -= 1; });
}

// The engine gzips some uploads with the platform's streams, which resolve in
// real time. Count each stream as real work until it finishes, so the runner
// does not advance virtual time (and expire leases) while one is compressing.
function trackRealWorkStream<T extends CompressionStream | DecompressionStream>(Stream: new (format: CompressionFormat) => T) {
  return class TrackedStream {
    readonly readable: ReadableStream<Uint8Array>;

    readonly writable: WritableStream<BufferSource>;

    constructor(format: CompressionFormat) {
      const inner = new Stream(format);
      simulation.pendingRealWork += 1;
      let finished = false;
      const finish = () => {
        if (!finished) { finished = true; simulation.pendingRealWork -= 1; }
      };
      this.writable = inner.writable;
      this.readable = inner.readable.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({ flush: finish }));
    }
  };
}
globalThis.CompressionStream = trackRealWorkStream(CompressionStream) as unknown as typeof CompressionStream;
globalThis.DecompressionStream = trackRealWorkStream(DecompressionStream) as unknown as typeof DecompressionStream;

function sizeOf(value: unknown) {
  return value === undefined ? 0 : JSON.stringify(value).length;
}

// With forced long-polling, a read adds a listen target and then waits for the
// result on a new backchannel request; a write is sent and then acknowledged on
// a new backchannel request. A streaming backchannel delivers both in one trip.
function channelRoundTrips(ref: Ref) {
  return ref._longPolling ? 2 : 1;
}

/* Firestore ------------------------------------------------------------- */

class SimulatedTimestamp {
  constructor(public seconds: number, public nanoseconds: number) { }

  toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); }

  static fromMillis(milliseconds: number) {
    return new SimulatedTimestamp(Math.floor(milliseconds / 1000), (milliseconds % 1000) * 1e6);
  }
}

function resolveSentinels(data: DocData): DocData {
  const now = Date.now();
  const result: DocData = {};
  Object.entries(data).forEach(([key, value]) => {
    result[key] = value === SERVER_TIMESTAMP ? (key === 'readAt' ? SimulatedTimestamp.fromMillis(now) : now) : value;
  });
  return result;
}

function applySet(ref: Ref, data: DocData, options?: { merge?: boolean; mergeFields?: string[] }) {
  const { firestoreData } = simulation;
  const resolved = resolveSentinels(data);
  if (options?.merge || options?.mergeFields) {
    const merged = { ...(firestoreData[ref._path] ?? {}), ...resolved };
    Object.entries(merged).forEach(([key, value]) => {
      if (value === DELETE_FIELD) delete merged[key];
    });
    firestoreData[ref._path] = merged;
  } else {
    firestoreData[ref._path] = resolved;
  }
}

function applyUpdate(ref: Ref, fields: DocData) {
  const existing = simulation.firestoreData[ref._path];
  if (!existing) throw new Error(`No document to update: ${ref._path}`);
  const now = Date.now();
  const updated = { ...existing };
  Object.entries(fields).forEach(([key, value]) => {
    const segments = key.split('.');
    let target = updated;
    segments.slice(0, -1).forEach((segment) => {
      target[segment] = { ...(target[segment] as DocData | undefined) };
      target = target[segment] as DocData;
    });
    const field = segments[segments.length - 1];
    if (value === DELETE_FIELD) delete target[field];
    else if (value === SERVER_TIMESTAMP) target[field] = now;
    else target[field] = value;
  });
  simulation.firestoreData[ref._path] = updated;
}

function snapshotOf(ref: Ref) {
  const data = simulation.firestoreData[ref._path];
  const copy = data ? { ...data } : undefined;
  return {
    exists: () => copy !== undefined,
    data: () => (copy ? { ...copy } : undefined),
    id: ref.id ?? ref._path.split('/').pop(),
  };
}

function comparable(value: unknown) {
  return value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function'
    ? value.toMillis() as number
    : Number(value);
}

function runQuery(ref: Ref) {
  const prefix = `${ref._path}/`;
  let docs = Object.entries(simulation.firestoreData)
    .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
    .map(([path, data]) => {
      const copy = { ...data };
      return { id: path.slice(prefix.length), data: () => ({ ...copy }) };
    });
  (ref._constraints ?? []).forEach((constraint) => {
    if (constraint.type === 'where') {
      docs = docs.filter((document) => {
        const fieldValue = document.data()[constraint.field!];
        if (constraint.operator === '==') return fieldValue === constraint.value;
        if (constraint.operator === '<' || constraint.operator === '>=') {
          if (typeof fieldValue !== typeof constraint.value) return false;
          return constraint.operator === '<'
            ? comparable(fieldValue) < comparable(constraint.value)
            : comparable(fieldValue) >= comparable(constraint.value);
        }
        if (constraint.operator === '>') {
          return fieldValue !== undefined && fieldValue !== null && String(fieldValue) > String(constraint.value);
        }
        return true;
      });
    } else if (constraint.type === 'orderBy') {
      docs = [...docs].sort((a, b) => (comparable(a.data()[constraint.field!]) - comparable(b.data()[constraint.field!]))
        * (constraint.direction === 'desc' ? -1 : 1));
    } else if (constraint.type === 'limit') {
      docs = docs.slice(0, constraint.count);
    }
  });
  return docs;
}

async function getDocs(ref: Ref) {
  const docs = runQuery(ref);
  await network('firestore.query', ref._path, channelRoundTrips(ref), docs.reduce((total, document) => total + sizeOf(document.data()), 0));
  const fresh = runQuery(ref);
  return { docs: fresh, forEach: (callback: (document: typeof fresh[number]) => void) => fresh.forEach(callback) };
}

type TransactionHandle = {
  get: (ref: Ref) => Promise<ReturnType<typeof snapshotOf>>;
  set: (ref: Ref, data: DocData, options?: { merge?: boolean; mergeFields?: string[] }) => void;
  update: (ref: Ref, data: DocData) => void;
  delete: (ref: Ref) => void;
};

// The web SDK's transaction retry policy (TransactionRunner in
// @firebase/firestore): 5 attempts in all, the first immediately, then after an
// exponential backoff whose base starts at 1s and grows 1.5x per retry. Time
// already spent in the previous attempt counts toward the delay. The SDK adds
// +/-50% jitter, which the simulation draws from a seeded generator so runs
// stay deterministic.
export const TRANSACTION_MAX_ATTEMPTS = 5;
const TRANSACTION_BACKOFF_INITIAL_MS = 1000;
const TRANSACTION_BACKOFF_FACTOR = 1.5;

export class SimulatedTransactionAbortedError extends Error {
  name = 'FirebaseError';

  code = 'aborted';

  constructor(path: string) {
    super(`Transaction on ${path} still conflicted after ${TRANSACTION_MAX_ATTEMPTS} attempts`);
  }
}

export async function simulatedRunTransaction<T>(_firestore: unknown, updateFunction: (transaction: TransactionHandle) => Promise<T>): Promise<T> {
  // Optimistic concurrency: each read is a lookup, the commit is one more round
  // trip, and a conflicting commit retries the whole function.
  let backoffMs = 0;
  let lastAttemptAt = Date.now();
  let firstPath = '';
  for (let attempt = 1; attempt <= TRANSACTION_MAX_ATTEMPTS; attempt += 1) {
    const delay = Math.max(0, Math.floor(backoffMs + nextJitter() * backoffMs) - (Date.now() - lastAttemptAt));
    if (delay > 0) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise<void>((resolve) => { setTimeout(resolve, delay); });
    }
    lastAttemptAt = Date.now();
    backoffMs = Math.max(TRANSACTION_BACKOFF_INITIAL_MS, backoffMs * TRANSACTION_BACKOFF_FACTOR);
    transactionStats.maxAttempts = Math.max(transactionStats.maxAttempts, attempt);
    if (attempt > 1) transactionStats.retries += 1;

    const reads = new Map<string, string | undefined>();
    const writes: Array<() => void> = [];
    const transaction: TransactionHandle = {
      get: async (ref) => {
        if (writes.length) throw new Error('Transactions must read before writing');
        reads.set(ref._path, JSON.stringify(simulation.firestoreData[ref._path]));
        await network('transaction.get', ref._path, 1, sizeOf(simulation.firestoreData[ref._path]));
        return snapshotOf(ref);
      },
      set: (ref, data, options) => { writes.push(() => applySet(ref, data, options)); },
      update: (ref, data) => { writes.push(() => applyUpdate(ref, data)); },
      delete: (ref) => { writes.push(() => { delete simulation.firestoreData[ref._path]; }); },
    };
    // eslint-disable-next-line no-await-in-loop
    const result = await updateFunction(transaction);
    firstPath = [...reads.keys()][0] ?? '';
    // eslint-disable-next-line no-await-in-loop
    await network('transaction.commit', firstPath, 1);
    const conflict = [...reads].some(([path, snapshot]) => JSON.stringify(simulation.firestoreData[path]) !== snapshot);
    if (!conflict) {
      const before = structuredClone(simulation.firestoreData);
      try {
        writes.forEach((write) => write());
      } catch (error) {
        simulation.firestoreData = before;
        throw error;
      }
      return result;
    }
  }
  transactionStats.aborted += 1;
  throw new SimulatedTransactionAbortedError(firstPath);
}

export function createFirestoreMock() {
  function collection(parent: { _path?: string; _longPolling: boolean }, path: string): Ref {
    return { _path: parent._path ? `${parent._path}/${path}` : path, _longPolling: parent._longPolling };
  }
  function doc(...args: [Ref, string] | [{ _longPolling: boolean }, string, string]): Ref {
    if (args.length === 2) {
      const [parent, id] = args;
      return { _path: `${parent._path}/${id}`, id, _longPolling: parent._longPolling };
    }
    const [firestore, collectionPath, id] = args;
    return { _path: `${collectionPath}/${id}`, id, _longPolling: firestore._longPolling };
  }

  return {
    initializeFirestore: vi.fn((_app: unknown, settings?: { experimentalForceLongPolling?: boolean }) => ({
      _longPolling: !!settings?.experimentalForceLongPolling,
    })),
    enableNetwork: vi.fn(() => Promise.resolve()),
    collection: vi.fn(collection),
    doc: vi.fn(doc),
    query: vi.fn((parent: Ref, ...constraints: QueryConstraint[]) => ({ ...parent, _constraints: constraints })),
    where: vi.fn((field: string, operator: string, value: unknown) => ({
      type: 'where', field, operator, value,
    })),
    orderBy: vi.fn((field: string, direction?: 'asc' | 'desc') => ({ type: 'orderBy', field, direction })),
    limit: vi.fn((count: number) => ({ type: 'limit', count })),
    getDoc: vi.fn(async (ref: Ref) => {
      await network('firestore.getDoc', ref._path, channelRoundTrips(ref), sizeOf(simulation.firestoreData[ref._path]));
      return snapshotOf(ref);
    }),
    getDocs: vi.fn(getDocs),
    getDocsFromServer: vi.fn(getDocs),
    getCountFromServer: vi.fn(async (ref: Ref) => {
      // Aggregations are a single request outside the channel.
      await network('firestore.count', ref._path, 1);
      return { data: () => ({ count: runQuery(ref).length }) };
    }),
    setDoc: vi.fn(async (ref: Ref, data: DocData, options?: { merge?: boolean; mergeFields?: string[] }) => {
      await network('firestore.write', ref._path, channelRoundTrips(ref), sizeOf(data));
      applySet(ref, data, options);
    }),
    updateDoc: vi.fn(async (ref: Ref, data: DocData) => {
      await network('firestore.write', ref._path, channelRoundTrips(ref), sizeOf(data));
      applyUpdate(ref, data);
    }),
    writeBatch: vi.fn(() => {
      const operations: Array<() => void> = [];
      let longPolling = false;
      return {
        set: (ref: Ref, data: DocData) => { longPolling = ref._longPolling; operations.push(() => applySet(ref, data)); },
        delete: (ref: Ref) => { longPolling = ref._longPolling; operations.push(() => { delete simulation.firestoreData[ref._path]; }); },
        commit: async () => {
          await network('firestore.write', 'batch', longPolling ? 2 : 1);
          operations.forEach((operation) => operation());
        },
      };
    }),
    runTransaction: vi.fn(simulatedRunTransaction),
    // Live listeners serve the analysis views, not participant loads.
    onSnapshot: vi.fn(() => vi.fn()),
    deleteField: vi.fn(() => DELETE_FIELD),
    serverTimestamp: vi.fn(() => SERVER_TIMESTAMP),
    Timestamp: SimulatedTimestamp,
    FieldPath: class { constructor(public key: string) {} },
  };
}

/* Cloud Storage --------------------------------------------------------- */

function notFound() {
  return Object.assign(new Error('storage/object-not-found'), { code: 'storage/object-not-found' });
}

// Blob stand-in whose text resolves in a microtask rather than real time.
function storedBlob(text: string) {
  return {
    size: text.length,
    text: () => Promise.resolve(text),
    arrayBuffer: () => Promise.resolve(new TextEncoder().encode(text).buffer),
  };
}

// A browser sends an object's stored bytes and decompresses them itself when
// the object has a gzip Content-Encoding.
function wireBytes(path: string) {
  return simulation.storageWireBytes[path] ?? simulation.storageObjects[path]?.length ?? 0;
}

async function uploadedText(data: Blob | Uint8Array, metadata?: { contentEncoding?: string }) {
  if (data instanceof Uint8Array) {
    if (metadata?.contentEncoding !== 'gzip') return new TextDecoder().decode(data);
    return new Response(new Response(data.slice()).body!.pipeThrough(new DecompressionStream('gzip'))).text();
  }
  return data.text();
}

export function createStorageMock() {
  return {
    getStorage: vi.fn(() => ({})),
    ref: vi.fn((_storage: unknown, path: string) => ({ path, fullPath: path })),
    uploadBytes: vi.fn(async (ref: { path: string }, data: Blob | Uint8Array, metadata?: { contentEncoding?: string }) => {
      const text = trackRealWork(uploadedText(data, metadata));
      const size = data instanceof Uint8Array ? data.byteLength : data.size;
      await network('storage.upload', ref.path, 1, size);
      simulation.storageObjects[ref.path] = await text;
      if (metadata?.contentEncoding === 'gzip') simulation.storageWireBytes[ref.path] = size;
      else delete simulation.storageWireBytes[ref.path];
      return { ref };
    }),
    getBlob: vi.fn(async (ref: { path: string }) => {
      const data = simulation.storageObjects[ref.path];
      await network('storage.download', ref.path, 1, wireBytes(ref.path));
      if (data === undefined) throw notFound();
      return storedBlob(data);
    }),
    getMetadata: vi.fn(async (ref: { path: string }) => {
      await network('storage.metadata', ref.path, 1);
      const data = simulation.storageObjects[ref.path];
      if (data === undefined) throw notFound();
      return { size: wireBytes(ref.path) };
    }),
    getDownloadURL: vi.fn(async (ref: { path: string }) => {
      await network('storage.downloadUrl', ref.path, 1);
      if (simulation.storageObjects[ref.path] === undefined) throw notFound();
      return `simulated-storage://${ref.path}`;
    }),
    updateMetadata: vi.fn(async (ref: { path: string }) => {
      await network('storage.updateMetadata', ref.path, 1);
      return {};
    }),
    deleteObject: vi.fn(async (ref: { path: string }) => {
      await network('storage.delete', ref.path, 1);
      delete simulation.storageObjects[ref.path];
      delete simulation.storageWireBytes[ref.path];
    }),
    listAll: vi.fn(async (ref: { path: string }) => {
      await network('storage.list', ref.path, 1);
      const prefix = ref.path.endsWith('/') ? ref.path : `${ref.path}/`;
      return {
        items: Object.keys(simulation.storageObjects).filter((key) => key.startsWith(prefix)).map((key) => ({ path: key, fullPath: key })),
        prefixes: [],
      };
    }),
  };
}

/** fetch() for the download URLs handed out by the storage mock. */
export async function simulatedFetch(url: string) {
  const path = url.slice('simulated-storage://'.length);
  const data = simulation.storageObjects[path];
  await network('storage.download', path, 1, wireBytes(path));
  return {
    ok: data !== undefined,
    status: data === undefined ? 404 : 200,
    blob: () => Promise.resolve(storedBlob(data ?? '')),
    text: () => Promise.resolve(data ?? ''),
    json: () => Promise.resolve(JSON.parse(data ?? 'null')),
  };
}

/* Local storage --------------------------------------------------------- */

export function createLocalforageMock() {
  return {
    default: {
      createInstance: vi.fn(({ name }: { name: string }) => {
        const key = `${simulation.currentBrowser}/${name}`;
        simulation.browserStores[key] ??= {};
        const store = () => simulation.browserStores[key];
        return {
          getItem: vi.fn((item: string) => Promise.resolve(store()[item] ?? null)),
          setItem: vi.fn((item: string, value: unknown) => { store()[item] = value; return Promise.resolve(value); }),
          removeItem: vi.fn((item: string) => { delete store()[item]; return Promise.resolve(); }),
          keys: vi.fn(() => Promise.resolve(Object.keys(store()))),
          clear: vi.fn(() => { simulation.browserStores[key] = {}; return Promise.resolve(); }),
        };
      }),
    },
  };
}

/* Runner ---------------------------------------------------------------- */

/** SHA-256 that resolves in a microtask, standing in for crypto.subtle.digest. */
export async function simulatedDigest(_algorithm: AlgorithmIdentifier, data: BufferSource) {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const digest = createHash('sha256').update(bytes).digest();
  return digest.buffer.slice(digest.byteOffset, digest.byteOffset + digest.byteLength) as ArrayBuffer;
}

async function settleRealWork() {
  // A real macrotask lets every pending microtask run, then wait out real work.
  for (let idle = 0; idle < 3;) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>((resolve) => { setImmediate(resolve); });
    idle = simulation.pendingRealWork > 0 ? 0 : idle + 1;
  }
}

export type SimulatedRun<T> = {
  result: T;
  startedAt: number;
  elapsedMs: number;
  calls: NetworkCall[];
};

/**
 * Runs an operation on the simulated network and reports its virtual duration
 * and the calls it made. Requires fake timers for setTimeout, setInterval,
 * Date and performance, with setImmediate left real.
 */
export async function runOnSimulatedNetwork<T>(operation: () => Promise<T>): Promise<SimulatedRun<T>> {
  const start = Date.now();
  const firstCall = simulation.calls.length;
  let outcome: { value: T } | { error: unknown } | undefined;
  operation().then((value) => { outcome = { value }; }, (error) => { outcome = { error }; });
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    await settleRealWork();
    if (outcome) break;
    if (vi.getTimerCount() === 0) throw new Error('The operation is waiting on something other than the simulated network');
    // eslint-disable-next-line no-await-in-loop
    await vi.advanceTimersToNextTimerAsync();
  }
  if ('error' in outcome) throw outcome.error;
  return {
    result: outcome.value, startedAt: start, elapsedMs: Date.now() - start, calls: simulation.calls.slice(firstCall),
  };
}

/** Lets background work (debounced saves, sweeps) finish outside any measurement. */
export async function drainBackgroundWork() {
  for (let index = 0; index < 50 && vi.getTimerCount() > 0; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    await vi.advanceTimersByTimeAsync(5_000);
    // eslint-disable-next-line no-await-in-loop
    await settleRealWork();
  }
}

/** A readable timeline of calls, for failure messages. */
export function formatCalls(calls: NetworkCall[], origin: number) {
  return calls
    .slice()
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .map((call) => `  +${String(call.start - origin).padStart(6)}ms ${String(call.end - call.start).padStart(5)}ms  ${call.kind.padEnd(22)} ${call.target}${call.bytes > 1024 ? `  (${Math.round(call.bytes / 1024)} KB)` : ''}`)
    .join('\n');
}
