import { expect, test, vi } from 'vitest';
import { initializeTrrack, Registry } from '@trrack/core';
import { makeSequenceAssignment, makeStudyConfig } from '../../tests/utils';
import { LocalStorageEngine } from '../engines/LocalStorageEngine';
import type { ParticipantData } from '../types';
import type { StoredAnswer } from '../../store/types';
import { createEmptyProvenance } from '../../store/provenance';
import { createGlobalStoreSubmission, GLOBAL_STORE_TASK } from '../../store/globalStoreProvenance';

const answer: StoredAnswer = {
  identifier: 'purchase_0',
  componentName: 'purchase',
  trialOrder: '0',
  answer: { cost: 30 },
  startTime: 1,
  endTime: 10,
  incorrectAnswers: {},
  windowEvents: [],
  timedOut: false,
  helpButtonClickedCount: 0,
  parameters: {},
  correctAnswer: [],
  optionOrders: {},
  questionOrders: {},
};
const participant: ParticipantData = {
  participantId: 'participant',
  participantConfigHash: 'config',
  participantIndex: 1,
  sequence: {
    components: ['purchase'], order: 'fixed', orderPath: 'root', skip: [],
  },
  answers: {},
  searchParams: {},
  metadata: {
    userAgent: '', resolution: {}, language: '', ip: null,
  },
  rejected: false,
  participantTags: [],
  stage: 'DEFAULT',
};

class SubmissionStorage extends LocalStorageEngine {
  local = new Map<string, unknown>();

  failSnapshot = false;

  collectionEnabled = false;

  remoteWrite = vi.fn(async (_prefix: string, _type: string, _object: unknown) => undefined);

  constructor(local = new Map<string, unknown>()) {
    super(true);
    this.local = local;
    this.studyId = 'study';
    this.currentParticipantId = 'participant';
    this.participantData = structuredClone(participant);
    this.participantStore = {
      setItem: async (key: string, value: unknown) => {
        if (key.endsWith('/localParticipantData') && this.failSnapshot) throw new Error('Local storage full');
        this.local.set(key, structuredClone(value));
        return value;
      },
      getItem: async (key: string) => this.local.get(key) ?? null,
      removeItem: async (key: string) => { this.local.delete(key); },
    } as typeof this.participantStore;
  }

  async getModes() {
    return { dataCollectionEnabled: this.collectionEnabled, dataSharingEnabled: false, developmentModeEnabled: true };
  }

  switchParticipant() {
    this.currentParticipantId = 'next-participant';
    this.participantData = { ...structuredClone(participant), participantId: 'next-participant' };
  }

  pauseNextWrite(suffix: string) {
    const original = this.participantStore.setItem.bind(this.participantStore);
    let entered!: () => void;
    let release!: () => void;
    const paused = new Promise<void>((resolve) => { entered = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    this.participantStore.setItem = async (key, value) => {
      if (key.endsWith(suffix)) {
        this.participantStore.setItem = original;
        entered();
        await gate;
      }
      return original(key, value);
    };
    return { paused, release };
  }

  protected async _pushToStorage(prefix: string, type: string, object: unknown) { await this.remoteWrite(prefix, type, object); }
}

const submission = () => createGlobalStoreSubmission(undefined, { budget: { initialValue: 100 } }, answer, { budget: 70 }, [], {});

test('local snapshot failure leaves accepted answers and values unchanged, while a retry accepts once', async () => {
  const storage = new SubmissionStorage();
  const { graph } = submission();
  storage.failSnapshot = true;
  await expect(storage.saveGlobalStoreSubmission({ purchase_0: answer }, graph, 1, 'purchase_0', createEmptyProvenance())).rejects.toThrow('Local storage full');
  expect(storage.getCurrentParticipantDataSnapshot()?.answers).toEqual({});
  expect(storage.getCurrentParticipantDataSnapshot()?.globalStoreRevision).toBeUndefined();
  storage.failSnapshot = false;
  await storage.saveGlobalStoreSubmission({ purchase_0: answer }, graph, 1, 'purchase_0', createEmptyProvenance());
  expect(storage.getCurrentParticipantDataSnapshot()).toMatchObject({ globalVariables: { budget: 70 }, globalStoreRevision: 1, globalStoreHead: graph.current });
  expect((await storage.getProvenance(GLOBAL_STORE_TASK))?.globalStore?.current).toBe(graph.current);
  expect(storage.remoteWrite).not.toHaveBeenCalled();
});

test('collection-disabled submissions remain local and finalization locks their saved session', async () => {
  const storage = new SubmissionStorage();
  const { graph } = submission();
  await storage.saveGlobalStoreSubmission({ purchase_0: answer }, graph, 1, 'purchase_0', createEmptyProvenance());
  expect(await storage.finalizeParticipant()).toEqual({ status: 'complete' });
  expect(storage.getCurrentParticipantDataSnapshot()?.finalized).toBe(true);
  expect(storage.remoteWrite).not.toHaveBeenCalled();
  await expect(storage.saveGlobalStoreSubmission({ purchase_0: answer }, graph, 2, 'purchase_0', createEmptyProvenance())).rejects.toThrow('closed');
});

test('a queued newer graph supersedes a failed older upload and retries reuse the accepted result', async () => {
  const storage = new SubmissionStorage();
  storage.collectionEnabled = true;
  const first = submission();
  const nextAnswer = {
    ...answer, identifier: 'purchase_1', trialOrder: '1', answer: { cost: 20 },
  };
  const next = createGlobalStoreSubmission(first.graph, { budget: { initialValue: 100 } }, nextAnswer, { budget: 50 }, [], {});
  let rejectFirst!: (error: Error) => void;
  storage.remoteWrite.mockImplementationOnce(() => new Promise((_, reject) => { rejectFirst = reject; }));
  const firstWrite = storage.saveProvenance({ ...createEmptyProvenance(), globalStore: first.graph }, GLOBAL_STORE_TASK);
  await vi.waitFor(() => expect(rejectFirst).toBeDefined());
  const nextWrite = storage.saveProvenance({ ...createEmptyProvenance(), globalStore: next.graph }, GLOBAL_STORE_TASK);
  const rejected = expect(firstWrite).rejects.toThrow('Disconnected');
  rejectFirst(new Error('Disconnected'));
  await rejected;
  await nextWrite;
  await expect(storage.retryFailedWrites()).resolves.toBeUndefined();
  expect(storage.remoteWrite.mock.calls.filter((call) => call[1] === GLOBAL_STORE_TASK).at(-1)?.[2]).toMatchObject({ globalStore: { current: next.graph.current } });
});

test('a rejected local revision never appears as an accepted submission in restored history', async () => {
  const storage = new SubmissionStorage();
  const first = submission();
  await storage.saveGlobalStoreSubmission({ purchase_0: answer }, first.graph, 1, 'purchase_0', createEmptyProvenance());
  const nextAnswer = {
    ...answer, identifier: 'purchase_1', trialOrder: '1', answer: { cost: 20 },
  };
  const next = createGlobalStoreSubmission(first.graph, { budget: { initialValue: 100 } }, nextAnswer, { budget: 50 }, [], {});
  storage.failSnapshot = true;
  await expect(storage.saveGlobalStoreSubmission({ purchase_0: answer, purchase_1: nextAnswer }, next.graph, 2, 'purchase_1', createEmptyProvenance())).rejects.toThrow();
  const restored = await storage.getProvenance(GLOBAL_STORE_TASK);
  expect(restored?.globalStore?.current).toBe(first.nodeId);
  expect(restored?.globalStore?.nodes[next.nodeId]).toBeUndefined();
  expect(storage.getCurrentParticipantDataSnapshot()?.globalVariables?.budget).toBe(70);
});

test('switching participants during submission preparation cannot accept the old result into the new session', async () => {
  const storage = new SubmissionStorage();
  let finishModes!: (modes: Awaited<ReturnType<SubmissionStorage['getModes']>>) => void;
  vi.spyOn(storage, 'getModes').mockImplementationOnce(() => new Promise((resolve) => { finishModes = resolve; }));
  const { graph } = submission();
  const pending = storage.saveGlobalStoreSubmission({ purchase_0: answer }, graph, 1, 'purchase_0', createEmptyProvenance());
  storage.switchParticipant();
  finishModes({ dataCollectionEnabled: false, dataSharingEnabled: false, developmentModeEnabled: true });
  await expect(pending).rejects.toThrow('session changed');
  expect(storage.getCurrentParticipantDataSnapshot()).toMatchObject({ participantId: 'next-participant', answers: {} });
  expect(storage.getCurrentParticipantDataSnapshot()?.globalStoreRevision).toBeUndefined();
  expect(storage.local.size).toBe(0);
});

class RecoveryStorage extends SubmissionStorage {
  completed = false;

  async connect() { this.connected = true; }

  async verifyStudyDatabase() { /* The test uses in-memory participant and asset stores. */ }

  async getCurrentParticipantId() { return this.currentParticipantId!; }

  protected async _getSequenceAssignment() { return makeSequenceAssignment({ completed: this.completed ? 1 : null }); }

  protected async _completeCurrentParticipantRealtime() { this.completed = true; }

  protected async _runWithLock<T>(_key: string, operation: () => Promise<T>) { return operation(); }
}

test.each([
  ['metadata', false], ['metadata', true], ['submission', false], ['submission', true],
] as const)('%s finishing last preserves metadata and accepted progress with collection=%s', async (delayed, collectionEnabled) => {
  const storage = new RecoveryStorage();
  storage.collectionEnabled = collectionEnabled;
  const { graph } = submission();
  const pause = storage.pauseNextWrite(delayed === 'metadata' ? '/localParticipantData' : '/localProvenance/purchase_0');
  const metadata = { ...participant.metadata, ip: '127.0.0.99' };
  const saveMetadata = () => storage.updateParticipantMetadata(metadata);
  const saveSubmission = () => storage.saveGlobalStoreSubmission({ purchase_0: answer }, graph, 1, 'purchase_0', createEmptyProvenance());
  const first = delayed === 'metadata' ? saveMetadata() : saveSubmission();
  await pause.paused;
  const second = delayed === 'metadata' ? saveSubmission() : saveMetadata();
  // Let the unblocked operation finish its in-memory writes before releasing the first.
  await new Promise((resolve) => { setTimeout(resolve, 0); });
  pause.release();
  await Promise.all([first, second]);
  const expected = {
    metadata, answers: { purchase_0: answer }, globalStoreRevision: 1, globalStoreHead: graph.current,
  };
  expect(storage.getCurrentParticipantDataSnapshot()).toMatchObject(expected);
  const cached = [...storage.local].find(([key]) => key.endsWith('/localParticipantData'))![1];
  expect(cached).toMatchObject(expected);
  if (collectionEnabled) {
    await storage.flushPendingParticipantData();
    expect(storage.remoteWrite.mock.calls.filter((call) => call[1] === 'participantData').at(-1)?.[2]).toMatchObject(expected);
  }
});

test.each(['draft', 'submission'])('a delayed %s write cannot replace accepted answers with Check Answer progress', async (delayed) => {
  const storage = new RecoveryStorage();
  storage.collectionEnabled = true;
  const { graph } = submission();
  const pause = storage.pauseNextWrite(delayed === 'draft' ? '/localParticipantData' : '/localProvenance/purchase_0');
  const draft = { ...answer, answer: { cost: 10 }, endTime: -1 };
  const saveDraft = () => storage.saveAnswers({ purchase_0: draft });
  const saveSubmission = () => storage.saveGlobalStoreSubmission({ purchase_0: answer }, graph, 1, 'purchase_0', createEmptyProvenance());
  const first = delayed === 'draft' ? saveDraft() : saveSubmission();
  await pause.paused;
  const second = delayed === 'draft' ? saveSubmission() : saveDraft();
  await new Promise((resolve) => { setTimeout(resolve, 0); });
  pause.release();
  await Promise.all([first, second]);
  const expected = { answers: { purchase_0: answer }, globalStoreRevision: 1 };
  expect(storage.getCurrentParticipantDataSnapshot()).toMatchObject(expected);
  expect([...storage.local].find(([key]) => key.endsWith('/localParticipantData'))![1]).toMatchObject(expected);
  await storage.flushPendingParticipantData();
  expect(storage.remoteWrite.mock.calls.filter((call) => call[1] === 'participantData').at(-1)?.[2]).toMatchObject(expected);
});

test.each(['tag', 'submission'])('a delayed %s write preserves automatic block tags and accepted progress', async (delayed) => {
  const storage = new RecoveryStorage();
  storage.collectionEnabled = true;
  const { graph } = submission();
  const pause = storage.pauseNextWrite(delayed === 'tag' ? '/localParticipantData' : '/localProvenance/purchase_0');
  const saveTags = () => storage.addParticipantTags(['block-id']);
  const saveSubmission = () => storage.saveGlobalStoreSubmission({ purchase_0: answer }, graph, 1, 'purchase_0', createEmptyProvenance());
  const first = delayed === 'tag' ? saveTags() : saveSubmission();
  await pause.paused;
  const second = delayed === 'tag' ? saveSubmission() : saveTags();
  await new Promise((resolve) => { setTimeout(resolve, 0); });
  pause.release();
  await Promise.all([first, second]);
  const expected = { participantTags: ['block-id'], answers: { purchase_0: answer }, globalStoreRevision: 1 };
  expect(storage.getCurrentParticipantDataSnapshot()).toMatchObject(expected);
  expect([...storage.local].find(([key]) => key.endsWith('/localParticipantData'))![1]).toMatchObject(expected);
  await storage.flushPendingParticipantData();
  expect(storage.remoteWrite.mock.calls.filter((call) => call[1] === 'participantData').at(-1)?.[2]).toMatchObject(expected);
});

test.each(['metadata', 'finalization'])('a delayed %s write preserves metadata and finalized progress', async (delayed) => {
  const storage = new RecoveryStorage();
  const { graph } = submission();
  await storage.saveGlobalStoreSubmission({ purchase_0: answer }, graph, 1, 'purchase_0', createEmptyProvenance());
  const pause = storage.pauseNextWrite('/localParticipantData');
  const metadata = { ...participant.metadata, ip: '127.0.0.99' };
  const saveMetadata = () => storage.updateParticipantMetadata(metadata);
  const finalize = () => storage.finalizeParticipant();
  const first = delayed === 'metadata' ? saveMetadata() : finalize();
  await pause.paused;
  const second = delayed === 'metadata' ? finalize() : saveMetadata();
  await new Promise((resolve) => { setTimeout(resolve, 0); });
  pause.release();
  await Promise.all([first, second]);
  const expected = {
    metadata, finalized: true, answers: { purchase_0: answer }, globalStoreRevision: 1,
  };
  expect(storage.getCurrentParticipantDataSnapshot()).toMatchObject(expected);
  expect([...storage.local].find(([key]) => key.endsWith('/localParticipantData'))![1]).toMatchObject(expected);
});

test('queued local updates cannot write into a replacement participant session', async () => {
  const storage = new RecoveryStorage();
  const { graph } = submission();
  const pause = storage.pauseNextWrite('/localProvenance/purchase_0');
  const submissionWrite = storage.saveGlobalStoreSubmission({ purchase_0: answer }, graph, 1, 'purchase_0', createEmptyProvenance());
  await pause.paused;
  const metadataWrite = storage.updateParticipantMetadata({ ...participant.metadata, ip: '127.0.0.99' });
  const results = Promise.allSettled([submissionWrite, metadataWrite]);
  await new Promise((resolve) => { setTimeout(resolve, 0); });
  storage.switchParticipant();
  pause.release();
  expect((await results).map((result) => result.status)).toEqual(['rejected', 'rejected']);
  expect(storage.getCurrentParticipantDataSnapshot()).toMatchObject({ participantId: 'next-participant', metadata: participant.metadata, answers: {} });
});

test('reload restores failed uploads for accepted history, including invalidated trials, before completion', async () => {
  const storage = new RecoveryStorage();
  storage.collectionEnabled = true;
  storage.remoteWrite.mockRejectedValue(new Error('Offline'));
  const retained = { ...createEmptyProvenance(), stimulus: initializeTrrack({ registry: Registry.create(), initialState: {} }).graph.backend };
  const definitions = { budget: { initialValue: 100 } };
  const first = createGlobalStoreSubmission(undefined, definitions, answer, { budget: 70 }, [], retained);
  await storage.saveGlobalStoreSubmission({ purchase_0: answer }, first.graph, 1, 'purchase_0', retained);
  const laterAnswer = {
    ...answer, identifier: 'purchase_1', trialOrder: '1', answer: { cost: 20 },
  };
  const later = createGlobalStoreSubmission(first.graph, definitions, laterAnswer, { budget: 50 }, [], retained);
  await storage.saveGlobalStoreSubmission({ purchase_0: answer, purchase_1: laterAnswer }, later.graph, 2, 'purchase_1', retained);
  const revisedAnswer = { ...answer, answer: { cost: 10 } };
  const revised = createGlobalStoreSubmission(later.graph, definitions, revisedAnswer, { budget: 90 }, [], retained);
  await storage.saveGlobalStoreSubmission({ purchase_0: revisedAnswer }, revised.graph, 3, 'purchase_0', retained);
  expect((await storage.finalizeParticipant()).status).toBe('error');

  const reloaded = new RecoveryStorage(storage.local);
  reloaded.collectionEnabled = true;
  reloaded.remoteWrite.mockRejectedValue(new Error('Still offline'));
  const restored = await reloaded.initializeParticipantSession({}, makeStudyConfig(), participant.metadata);
  expect(restored.globalStoreHead).toBe(revised.graph.current);
  expect((await reloaded.finalizeParticipant()).status).toBe('error');
  expect(reloaded.completed).toBe(false);
  reloaded.remoteWrite.mockResolvedValue(undefined);
  await reloaded.retryFailedWrites();
  expect(await reloaded.finalizeParticipant()).toEqual({ status: 'complete' });
  expect(reloaded.completed).toBe(true);
  const writes = reloaded.remoteWrite.mock.calls;
  expect(writes.filter((call) => call[1] === GLOBAL_STORE_TASK).at(-1)?.[2]).toMatchObject({ globalStore: { current: revised.graph.current } });
  expect(writes.some((call) => call[1] === 'purchase_0')).toBe(true);
  expect(writes.some((call) => call[1] === 'purchase_1')).toBe(true);
});

test('recovered local acceptance republishes participant data before normal finalization without a manual retry', async () => {
  const storage = new RecoveryStorage();
  storage.collectionEnabled = true;
  storage.remoteWrite.mockRejectedValue(new Error('Offline'));
  const retained = { ...createEmptyProvenance(), stimulus: initializeTrrack({ registry: Registry.create(), initialState: {} }).graph.backend };
  const { graph } = createGlobalStoreSubmission(undefined, { budget: { initialValue: 100 } }, answer, { budget: 70 }, [], retained);
  await storage.saveGlobalStoreSubmission({ purchase_0: answer }, graph, 1, 'purchase_0', retained);
  expect((await storage.finalizeParticipant()).status).toBe('error');
  const reloaded = new RecoveryStorage(storage.local);
  reloaded.collectionEnabled = true;
  await reloaded.initializeParticipantSession({}, makeStudyConfig(), participant.metadata);
  expect(await reloaded.finalizeParticipant()).toEqual({ status: 'complete' });
  expect(reloaded.remoteWrite.mock.calls.find((call) => call[1] === 'participantData')?.[2]).toMatchObject({
    globalStoreHead: graph.current, globalStoreRevision: 1, answers: { purchase_0: answer },
  });
});
