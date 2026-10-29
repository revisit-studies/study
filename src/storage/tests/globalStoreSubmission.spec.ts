import { expect, test, vi } from 'vitest';
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

  constructor() {
    super(true);
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
