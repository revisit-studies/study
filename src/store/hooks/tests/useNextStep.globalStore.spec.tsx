import type { ReactNode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  afterEach, beforeEach, expect, test, vi,
} from 'vitest';
import { StudyStoreContext, studyStoreCreator, type StudyStore } from '../../store';
import type { EventType, StoreState } from '../../types';
import { makeStoredAnswer, makeStudyConfig } from '../../../tests/utils';
import type { GlobalStoreValues } from '../../../parser/types';
import { createGlobalStoreSubmission } from '../../globalStoreProvenance';
import { useNextStep } from '../useNextStep';
import { useTrialAssetIdentifier } from '../useTrialAssetIdentifier';
import { RecordingContext } from '../useRecording';

const mocks = vi.hoisted(() => ({
  context: undefined as unknown as StudyStore,
  navigate: vi.fn(),
  save: vi.fn(),
  saveAnswers: vi.fn(),
  confirm: undefined as undefined | (() => void),
  captureRevision: 0,
  captureActive: true,
  windowEvents: [] as unknown[],
  checkpointPending: undefined as Promise<void> | undefined,
  submissionPending: false,
  submissionFinalizing: false,
  submissionDeferredEvents: [] as EventType[],
  pendingDisplayStatus: undefined as Promise<void> | undefined,
}));
vi.mock('../../store', async (original) => ({
  ...await original<Record<string, unknown>>(),
  useStoreSelector: (select: (state: StoreState) => unknown) => select(mocks.context.store.getState()),
  useStoreActions: () => mocks.context.actions,
  useStoreDispatch: () => mocks.context.store.dispatch,
  useFlatSequence: () => ['purchase', 'later', 'end'],
}));
vi.mock('../../../routes/utils', () => ({ useCurrentIdentifier: () => 'purchase_0', useCurrentStep: () => 0, useStudyId: () => 'study' }));
vi.mock('../../../storage/storageEngineHooks', () => ({ useStorageEngine: () => ({ storageEngine: { saveGlobalStoreSubmission: mocks.save, saveAnswers: mocks.saveAnswers } }) }));
vi.mock('../useStudyConfig', () => ({ useStudyConfig: () => mocks.context.store.getState().config }));
vi.mock('../useStoredAnswer', () => ({ useStoredAnswer: () => mocks.context.store.getState().answers.purchase_0 }));
vi.mock('../useWindowEvents', () => ({
  useWindowEvents: () => ({
    current: mocks.windowEvents as never,
    get checkpointPending() { return mocks.checkpointPending; },
    set submissionPending(value: boolean | undefined) { mocks.submissionPending = !!value; },
    get submissionFinalizing() { return mocks.submissionFinalizing; },
    set submissionFinalizing(value: boolean | undefined) { mocks.submissionFinalizing = !!value; },
    get submissionDeferredEvents() { return mocks.submissionDeferredEvents; },
    set submissionDeferredEvents(value: EventType[] | undefined) { mocks.submissionDeferredEvents = value ?? []; },
    get pendingDisplayStatus() { return mocks.pendingDisplayStatus; },
  }),
}));
vi.mock('../useIsAnalysis', () => ({ useIsAnalysis: () => false }));
vi.mock('../../../components/response/customResponseModules', () => ({ getCustomResponseModule: () => null, getCustomResponseModuleLoadError: () => null }));
vi.mock('react-router', () => ({ useNavigate: () => mocks.navigate, useParams: () => ({}) }));
vi.mock('@mantine/modals', () => ({ openConfirmModal: (options: { onConfirm: () => void }) => { mocks.confirm = options.onConfirm; } }));

beforeEach(async () => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  mocks.confirm = undefined;
  mocks.captureRevision = 0;
  mocks.captureActive = true;
  mocks.windowEvents.length = 0;
  mocks.checkpointPending = undefined;
  mocks.submissionPending = false;
  mocks.submissionFinalizing = false;
  mocks.submissionDeferredEvents.length = 0;
  mocks.pendingDisplayStatus = undefined;
  mocks.save.mockResolvedValue(undefined);
  mocks.saveAnswers.mockResolvedValue(undefined);
  window.history.replaceState({}, '', '/study/purchase');
  const config = makeStudyConfig({
    globalVariables: { budget: { initialValue: 100 } },
    components: {
      purchase: {
        type: 'questionnaire',
        response: [{
          id: 'cost', type: 'numerical', prompt: 'Cost', onSubmit: [{ variable: 'budget', operation: 'subtract' }],
        }],
      },
    },
  });
  mocks.context = await studyStoreCreator('study', config, {
    order: 'fixed', orderPath: 'root', components: ['purchase', 'later', 'end'], skip: [],
  }, {
    userAgent: '', resolution: {}, language: '', ip: null,
  }, {
    purchase_0: makeStoredAnswer({
      identifier: 'purchase_0', componentName: 'purchase', trialOrder: '0', endTime: -1,
    }),
  }, { dataCollectionEnabled: true, developmentModeEnabled: true, dataSharingEnabled: false }, 'participant', false, false);
  const { store, actions } = mocks.context;
  (['aboveStimulus', 'belowStimulus', 'sidebar', 'stimulus'] as const).forEach((location) => {
    store.dispatch(actions.updateResponseBlockValidation({
      identifier: 'purchase_0', location, status: true, values: location === 'belowStimulus' ? { cost: 10 } : {},
    }));
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function mount() {
  return renderHook(
    () => useNextStep(),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <StudyStoreContext.Provider value={mocks.context}>
          <RecordingContext.Provider value={{
            hasActiveVerifiedScreenCapture: () => mocks.captureActive,
            getScreenCaptureRevision: () => mocks.captureRevision,
          } as never}
          >
            {children}
          </RecordingContext.Provider>
        </StudyStoreContext.Provider>
      ),
    },
  );
}

test('publishes a durable save after browser navigation and suppresses only the old navigation', async () => {
  let finish!: () => void;
  mocks.save.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  const hook = mount();
  let pending!: Promise<void>;
  act(() => { pending = hook.result.current.goToNextStep(); });
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  window.history.pushState({}, '', '/study/previous');
  await act(async () => { finish(); await pending; });
  expect(mocks.context.store.getState()).toMatchObject({ globalStoreRevision: 1, globalVariables: { budget: 90 }, globalStoreSubmitting: false });
  expect(mocks.navigate).not.toHaveBeenCalled();
});

test.each(['updater', 'answers', 'revision', 'participant', 'completed', 'asset'] as const)('rejects a prepared earlier edit when %s changes during confirmation', async (change) => {
  const { store, actions } = mocks.context;
  const original = makeStoredAnswer({
    identifier: 'purchase_0', componentName: 'purchase', trialOrder: '0', answer: { cost: 30 },
  });
  const later = makeStoredAnswer({
    identifier: 'later_1', componentName: 'later', trialOrder: '1', answer: { cost: 20 },
  });
  const definitions = { budget: { initialValue: 100 } };
  const first = createGlobalStoreSubmission(undefined, definitions, original, { budget: 70 }, [], {});
  const second = createGlobalStoreSubmission(first.graph, definitions, later, { budget: 50 }, [], {});
  store.dispatch(actions.acceptGlobalStoreSubmission({ graph: second.graph, answers: { purchase_0: original, later_1: later }, revision: 2 }));
  mocks.context.globalStoreUpdaters.set('purchase_0', () => ({}));
  const hook = mount();
  let pending!: Promise<void>;
  act(() => { pending = hook.result.current.goToNextStep(); });
  await vi.waitFor(() => expect(mocks.confirm).toBeTypeOf('function'));
  if (change === 'updater') mocks.context.globalStoreUpdaters.delete('purchase_0');
  if (change === 'answers') {
    store.dispatch(actions.updateResponseBlockValidation({
      identifier: 'purchase_0', location: 'belowStimulus', status: true, values: { cost: 15 },
    }));
  }
  if (change === 'revision') store.dispatch(actions.acceptGlobalStoreSubmission({ graph: second.graph, answers: { purchase_0: original, later_1: later }, revision: 3 }));
  if (change === 'completed') store.dispatch(actions.setParticipantCompleted(true));
  if (change === 'participant') vi.spyOn(store, 'getState').mockReturnValue({ ...store.getState(), participantId: 'other' });
  if (change === 'asset') store.dispatch(actions.setAssetStatus({ identifier: 'purchase_0', status: 'loading' }));
  await act(async () => { mocks.confirm!(); await pending; });
  expect(mocks.save).not.toHaveBeenCalled();
  expect(mocks.navigate).not.toHaveBeenCalled();
});

test('rejects a global-store submission when screen sharing ends during confirmation', async () => {
  const { store, actions } = mocks.context;
  const original = makeStoredAnswer({
    identifier: 'purchase_0', componentName: 'purchase', trialOrder: '0', answer: { cost: 30 },
  });
  const later = makeStoredAnswer({
    identifier: 'later_1', componentName: 'later', trialOrder: '1', answer: { cost: 20 },
  });
  const definitions = { budget: { initialValue: 100 } };
  const first = createGlobalStoreSubmission(undefined, definitions, original, { budget: 70 }, [], {});
  const second = createGlobalStoreSubmission(first.graph, definitions, later, { budget: 50 }, [], {});
  store.dispatch(actions.acceptGlobalStoreSubmission({ graph: second.graph, answers: { purchase_0: original, later_1: later }, revision: 2 }));
  mocks.context.globalStoreUpdaters.set('purchase_0', () => ({}));
  const { config: currentConfig, ...stateWithoutConfig } = store.getState();
  vi.spyOn(store, 'getState').mockReturnValue({
    ...stateWithoutConfig,
    config: {
      ...currentConfig,
      uiConfig: {
        ...currentConfig.uiConfig,
        requireEntireScreen: true,
        recordScreen: true,
      },
      components: {
        ...currentConfig.components,
        purchase: {
          ...currentConfig.components.purchase,
          recordScreen: true,
        },
      },
    },
  });
  const hook = mount();
  let pending!: Promise<void>;
  act(() => { pending = hook.result.current.goToNextStep(); });
  await vi.waitFor(() => expect(mocks.confirm).toBeTypeOf('function'));
  mocks.captureRevision += 1;
  await act(async () => { mocks.confirm!(); await pending; });
  expect(mocks.save).not.toHaveBeenCalled();
  expect(mocks.navigate).not.toHaveBeenCalled();
});

test.each(['audio', 'webcam'] as const)('rejects an async %s-only submission when required monitor sharing stops', async (modality) => {
  const { store } = mocks.context;
  const getState = store.getState.bind(store);
  const currentConfig = getState().config;
  const recordingConfig = {
    ...currentConfig,
    uiConfig: {
      ...currentConfig.uiConfig,
      requireEntireScreen: true,
      recordScreen: false,
      recordAudio: false,
      recordWebcam: false,
    },
    components: {
      ...currentConfig.components,
      purchase: {
        ...currentConfig.components.purchase,
        recordScreen: false,
        recordAudio: modality === 'audio',
        recordWebcam: modality === 'webcam',
      },
    },
  };
  vi.spyOn(store, 'getState').mockImplementation(() => ({ ...getState(), config: recordingConfig }));
  let finishUpdater!: (patch: GlobalStoreValues) => void;
  mocks.context.globalStoreUpdaters.set('purchase_0', () => new Promise<GlobalStoreValues>((resolve) => { finishUpdater = resolve; }));

  const hook = mount();
  let pending!: Promise<void>;
  act(() => { pending = hook.result.current.goToNextStep(); });
  await vi.waitFor(() => expect(finishUpdater).toBeTypeOf('function'));

  mocks.captureActive = false;
  mocks.captureRevision += 1;
  await act(async () => { finishUpdater({}); await pending; });

  expect(mocks.save).not.toHaveBeenCalled();
  expect(mocks.navigate).not.toHaveBeenCalled();
});

test('does not add recording timing after a failed global-store save when recording is disabled', async () => {
  const { store } = mocks.context;
  const { config: currentConfig, ...stateWithoutConfig } = store.getState();
  vi.spyOn(store, 'getState').mockReturnValue({
    ...stateWithoutConfig,
    config: {
      ...currentConfig,
      uiConfig: { ...currentConfig.uiConfig, requireEntireScreen: true },
      components: {
        ...currentConfig.components,
        purchase: {
          ...currentConfig.components.purchase,
          recordScreen: false,
          recordAudio: false,
          recordWebcam: false,
        },
      },
    },
  });
  mocks.save.mockRejectedValueOnce(new Error('storage unavailable'));
  const hook = mount();

  await act(async () => { await hook.result.current.goToNextStep(); });

  const saved = store.getState().answers.purchase_0;
  expect(mocks.save).toHaveBeenCalledOnce();
  expect(saved).not.toHaveProperty('recordingEndTime');
});

test('does not accept a global-store submission when capture ends while storage is pending', async () => {
  const { store } = mocks.context;
  const { config: currentConfig, ...stateWithoutConfig } = store.getState();
  vi.spyOn(store, 'getState').mockReturnValue({
    ...stateWithoutConfig,
    config: {
      ...currentConfig,
      uiConfig: { ...currentConfig.uiConfig, requireEntireScreen: true, recordScreen: true },
      components: {
        ...currentConfig.components,
        purchase: { ...currentConfig.components.purchase, recordScreen: true },
      },
    },
  });
  mocks.save.mockImplementation(async (...args) => {
    const canCommit = args[5] as () => boolean;
    mocks.captureRevision += 1;
    return canCommit();
  });

  const hook = mount();
  await act(async () => { await hook.result.current.goToNextStep(); });

  expect(store.getState().globalStoreRevision).toBe(0);
  expect(store.getState().answers.purchase_0.endTime).toBe(-1);
  expect(mocks.navigate).not.toHaveBeenCalled();
});

test('normal advancement keeps the lock until the destination trial mounts', async () => {
  const hook = mount();
  await act(async () => { await hook.result.current.goToNextStep(); });
  expect(mocks.context.store.getState().globalStoreRevision).toBe(1);
  expect(mocks.navigate).toHaveBeenCalledTimes(1);
  expect(mocks.context.store.getState().globalStoreSubmitting).toBe(true);
});

test.each([10, 30])('a revisit of cost %s saves the current recording and visit times', async (originalCost) => {
  const { store, actions } = mocks.context;
  const original = makeStoredAnswer({
    identifier: 'purchase_0',
    componentName: 'purchase',
    trialOrder: '0',
    answer: { cost: originalCost },
    assetIdentifier: 'purchase_0__global_0',
    startTime: 1000,
    endTime: 2000,
    windowEvents: [[1500, 'focus', 'INPUT']],
  });
  const first = createGlobalStoreSubmission(undefined, { budget: { initialValue: 100 } }, original, { budget: 100 - originalCost }, [], {});
  store.dispatch(actions.acceptGlobalStoreSubmission({ graph: first.graph, answers: { purchase_0: original }, revision: 1 }));
  const now = vi.spyOn(Date, 'now').mockReturnValue(61000);
  const hook = mount();
  now.mockReturnValue(62000);
  await act(async () => { await hook.result.current.goToNextStep(); });
  const saved = mocks.save.mock.calls[0][0].purchase_0;
  expect(saved.answer).toEqual({ cost: 10 });
  expect(saved.assetIdentifier).toMatch(/^purchase_0__global_/);
  expect(saved.assetIdentifier).not.toBe(original.assetIdentifier);
  expect(saved.startTime).toBe(61000);
  expect(saved.endTime).toBe(62000);
  expect(saved.windowEvents).toEqual([]);
  expect(mocks.context.store.getState().answers.purchase_0).toEqual(saved);
});

test('full-screen global-store submissions keep checkpointed events from an unfinished prior visit', async () => {
  const { store, actions } = mocks.context;
  const answer = makeStoredAnswer({
    identifier: 'purchase_0',
    componentName: 'purchase',
    trialOrder: '0',
    answer: { cost: 10 },
    assetIdentifier: 'purchase_old_segment',
    startTime: 1000,
    endTime: -1,
    windowEvents: [
      [1000, 'displaystatus', 'single'],
      [6100, 'displaystatus', 'multiple'],
    ],
  });
  store.dispatch(actions.saveTrialAnswer(answer));
  mocks.windowEvents.push([6200, 'focus', 'INPUT']);
  const { config: currentConfig, ...stateWithoutConfig } = store.getState();
  vi.spyOn(store, 'getState').mockReturnValue({
    ...stateWithoutConfig,
    config: {
      ...currentConfig,
      uiConfig: { ...currentConfig.uiConfig, requireEntireScreen: true, recordScreen: true },
      components: {
        ...currentConfig.components,
        purchase: { ...currentConfig.components.purchase, recordScreen: true },
      },
    },
  });
  vi.spyOn(Date, 'now').mockReturnValue(6000);

  const hook = mount();
  await act(async () => { await hook.result.current.goToNextStep(); });

  expect(mocks.save.mock.calls[0][0].purchase_0.windowEvents).toEqual([
    [1000, 'displaystatus', 'single'],
    [6100, 'displaystatus', 'multiple'],
    [6200, 'focus', 'INPUT'],
  ]);
});

test('keeps display events deferred during a successful Next save off the destination task', async () => {
  const { store } = mocks.context;
  const { config: currentConfig, ...stateWithoutConfig } = store.getState();
  vi.spyOn(store, 'getState').mockReturnValue({
    ...stateWithoutConfig,
    config: {
      ...currentConfig,
      uiConfig: { ...currentConfig.uiConfig, requireEntireScreen: true, recordScreen: true },
      components: {
        ...currentConfig.components,
        purchase: { ...currentConfig.components.purchase, recordScreen: true },
      },
    },
  });
  let finishStorage!: () => void;
  mocks.save.mockImplementationOnce(() => new Promise<void>((resolve) => { finishStorage = resolve; }));
  const resolvedStatus: EventType = [2200, 'displaystatus', 'multiple'];

  const hook = mount();
  let submission!: Promise<void>;
  act(() => { submission = hook.result.current.goToNextStep(); });
  await vi.waitFor(() => expect(mocks.submissionFinalizing).toBe(true));
  await vi.waitFor(() => expect(finishStorage).toBeTypeOf('function'));
  mocks.submissionDeferredEvents.push(resolvedStatus);
  await act(async () => { finishStorage(); await submission; });

  expect(mocks.save.mock.calls[0][0].purchase_0.windowEvents).not.toContainEqual(resolvedStatus);
  expect(mocks.navigate).toHaveBeenCalledOnce();
  expect(mocks.windowEvents).not.toContain(resolvedStatus);
  expect(mocks.submissionDeferredEvents).toEqual([]);
});

test('does not wait for optional display detection before successful Next navigation', async () => {
  const { store } = mocks.context;
  const { config: currentConfig, ...stateWithoutConfig } = store.getState();
  vi.spyOn(store, 'getState').mockReturnValue({
    ...stateWithoutConfig,
    config: {
      ...currentConfig,
      uiConfig: { ...currentConfig.uiConfig, requireEntireScreen: true, recordScreen: true },
      components: {
        ...currentConfig.components,
        purchase: { ...currentConfig.components.purchase, recordScreen: true },
      },
    },
  });
  mocks.pendingDisplayStatus = new Promise<void>(() => {});
  const hook = mount();
  await act(async () => { await hook.result.current.goToNextStep(); });

  expect(mocks.save).toHaveBeenCalledOnce();
  expect(mocks.navigate).toHaveBeenCalledOnce();
});

test('resubmitting an accepted full-screen global-store answer retains events from earlier segments', async () => {
  const { store, actions } = mocks.context;
  const answer = makeStoredAnswer({
    identifier: 'purchase_0',
    componentName: 'purchase',
    trialOrder: '0',
    answer: { cost: 10 },
    assetIdentifier: 'accepted-segment',
    recordingSegments: ['accepted-segment', 'revisit-segment'],
    recordingSegmentRanges: [
      { assetIdentifier: 'accepted-segment', startTime: 1000, endTime: 2000 },
      { assetIdentifier: 'revisit-segment', startTime: 6000, endTime: 7000 },
    ],
    startTime: 1000,
    endTime: 2000,
    windowEvents: [
      [1500, 'displaystatus', 'single'],
      [6500, 'studyactivity', 'focus-lost'],
    ],
  });
  store.dispatch(actions.saveTrialAnswer(answer));
  const { config: currentConfig, ...stateWithoutConfig } = store.getState();
  vi.spyOn(store, 'getState').mockReturnValue({
    ...stateWithoutConfig,
    config: {
      ...currentConfig,
      uiConfig: { ...currentConfig.uiConfig, requireEntireScreen: true, recordScreen: true },
      components: {
        ...currentConfig.components,
        purchase: { ...currentConfig.components.purchase, recordScreen: true },
      },
    },
  });
  mocks.windowEvents.push([6600, 'focus', 'INPUT']);

  const hook = mount();
  await act(async () => { await hook.result.current.goToNextStep(); });

  expect(mocks.save.mock.calls[0][0].purchase_0.windowEvents).toEqual([
    [1500, 'displaystatus', 'single'],
    [6500, 'studyactivity', 'focus-lost'],
    [6600, 'focus', 'INPUT'],
  ]);
});

test('merges a completed checkpoint into a pending global-store submission and removes only submitted events', async () => {
  const { store, actions } = mocks.context;
  const getState = store.getState.bind(store);
  const currentConfig = getState().config;
  const recordingConfig = {
    ...currentConfig,
    uiConfig: { ...currentConfig.uiConfig, requireEntireScreen: true, recordScreen: true },
    components: {
      ...currentConfig.components,
      purchase: { ...currentConfig.components.purchase, recordScreen: true },
    },
  };
  vi.spyOn(store, 'getState').mockImplementation(() => ({ ...getState(), config: recordingConfig }));
  const initialEvent: EventType = [1000, 'studyactivity', 'focus-lost'];
  const checkpointEvent: EventType = [1500, 'visibility', 'hidden'];
  const duringSubmissionEvent: EventType = [2000, 'visibility', 'visible'];
  const afterSnapshotEvent: EventType = [3000, 'studyactivity', 'pointer-left'];
  mocks.windowEvents.push(initialEvent);
  mocks.windowEvents.push(duringSubmissionEvent);

  let resolveCheckpoint!: () => void;
  mocks.checkpointPending = new Promise<void>((resolve) => { resolveCheckpoint = resolve; });
  let finishUpdater!: () => void;
  mocks.context.globalStoreUpdaters.set('purchase_0', () => new Promise((resolve) => { finishUpdater = () => resolve({}); }));
  let finishStorage!: () => void;
  mocks.save.mockImplementationOnce(() => new Promise<void>((resolve) => { finishStorage = resolve; }));

  const hook = mount();
  let pending!: Promise<void>;
  act(() => { pending = hook.result.current.goToNextStep(); });
  await vi.waitFor(() => expect(mocks.submissionPending).toBe(true));
  expect(finishUpdater).toBeUndefined();

  const taskAsset = mocks.context.trialAssetEntry?.key;
  const checkpointedAnswer = {
    ...store.getState().answers.purchase_0,
    recordingSegments: ['previous-segment', ...(taskAsset ? [taskAsset] : [])],
    recordingSegmentRanges: [{ assetIdentifier: taskAsset!, startTime: 1000, endTime: 1500 }],
    recordingChunkKeys: { [taskAsset!]: ['chunk-0'] },
    recordingEndTime: 1500,
    windowEvents: [initialEvent, checkpointEvent],
  };
  store.dispatch(actions.saveTrialAnswer(checkpointedAnswer));
  mocks.windowEvents.splice(0, 1);
  resolveCheckpoint();
  await vi.waitFor(() => expect(finishUpdater).toBeTypeOf('function'));
  finishUpdater();
  await vi.waitFor(() => expect(finishStorage).toBeTypeOf('function'));

  const savedAnswer = mocks.save.mock.calls[0][0].purchase_0;
  expect(savedAnswer.windowEvents).toEqual([initialEvent, checkpointEvent, duringSubmissionEvent]);
  expect(savedAnswer.recordingSegmentRanges).toEqual([expect.objectContaining({ assetIdentifier: taskAsset })]);
  expect(savedAnswer.recordingChunkKeys[taskAsset!]).toContain('chunk-0');

  if (mocks.submissionFinalizing) mocks.submissionDeferredEvents.push(afterSnapshotEvent);
  else mocks.windowEvents.push(afterSnapshotEvent);
  await act(async () => { finishStorage(); await pending; });
  expect(mocks.windowEvents).toEqual([]);
  expect(mocks.submissionDeferredEvents).toEqual([]);
  expect(mocks.submissionFinalizing).toBe(false);
});

test('does not add recording metadata to a global-store submission when the task disables recording', async () => {
  const { store } = mocks.context;
  const getState = store.getState.bind(store);
  const currentConfig = getState().config;
  const noRecordingConfig = {
    ...currentConfig,
    uiConfig: {
      ...currentConfig.uiConfig,
      requireEntireScreen: true,
      recordScreen: true,
      recordAudio: true,
      recordWebcam: true,
    },
    components: {
      ...currentConfig.components,
      purchase: {
        ...currentConfig.components.purchase,
        recordScreen: false,
        recordAudio: false,
        recordWebcam: false,
      },
    },
  };
  vi.spyOn(store, 'getState').mockImplementation(() => ({ ...getState(), config: noRecordingConfig }));

  const hook = mount();
  await act(async () => { await hook.result.current.goToNextStep(); });

  const savedAnswer = mocks.save.mock.calls[0][0].purchase_0;
  expect(savedAnswer.recordingSegments).toBeUndefined();
  expect(savedAnswer.recordingSegmentRanges).toBeUndefined();
  expect(savedAnswer.recordingChunkKeys).toBeUndefined();
  expect(savedAnswer.recordingEndTime).toBeUndefined();
});

test('retains audio-only recording metadata in a global-store submission without screen ranges', async () => {
  const { store } = mocks.context;
  const getState = store.getState.bind(store);
  const currentConfig = getState().config;
  const audioOnlyConfig = {
    ...currentConfig,
    uiConfig: {
      ...currentConfig.uiConfig,
      requireEntireScreen: true,
      recordScreen: true,
      recordAudio: false,
      recordWebcam: false,
    },
    components: {
      ...currentConfig.components,
      purchase: {
        ...currentConfig.components.purchase,
        recordScreen: false,
        recordAudio: true,
        recordWebcam: false,
      },
    },
  };
  vi.spyOn(store, 'getState').mockImplementation(() => ({ ...getState(), config: audioOnlyConfig }));

  const hook = mount();
  await act(async () => { await hook.result.current.goToNextStep(); });

  const taskAsset = mocks.context.trialAssetEntry?.key;
  expect(mocks.save.mock.calls[0][0].purchase_0).toMatchObject({
    recordingSegments: expect.arrayContaining([taskAsset]),
    recordingSegmentRanges: [],
  });
});

test('restores observations collected during a failed full-screen save to the live event buffer', async () => {
  const { store } = mocks.context;
  const { config: currentConfig, ...stateWithoutConfig } = store.getState();
  vi.spyOn(store, 'getState').mockReturnValue({
    ...stateWithoutConfig,
    config: { ...currentConfig, uiConfig: { ...currentConfig.uiConfig, requireEntireScreen: true, recordScreen: true } },
  });
  let failStorage!: (error: Error) => void;
  mocks.save.mockImplementationOnce(() => new Promise<void>((_, reject) => { failStorage = reject; }));
  const hook = mount();
  let pending!: Promise<void>;
  act(() => { pending = hook.result.current.goToNextStep(); });
  await vi.waitFor(() => expect(failStorage).toBeTypeOf('function'));
  const lateObservation: EventType = [2500, 'captureinterrupted', 'screen'];
  expect(mocks.submissionFinalizing).toBe(true);
  mocks.submissionDeferredEvents.push(lateObservation);

  await act(async () => { failStorage(new Error('save failed')); await pending; });

  expect(mocks.windowEvents).toContain(lateObservation);
  expect(mocks.submissionDeferredEvents).toEqual([]);
  expect(mocks.submissionFinalizing).toBe(false);
  expect(mocks.navigate).not.toHaveBeenCalled();
  expect(mocks.saveAnswers.mock.calls[0][0].purchase_0).toMatchObject({
    endTime: -1,
    windowEvents: expect.arrayContaining([lateObservation]),
  });
});

test('the accepted answer uses the same unique visit key as the recorder', async () => {
  const hook = renderHook(() => ({ recorderKey: useTrialAssetIdentifier(), next: useNextStep() }), {
    wrapper: ({ children }: { children: ReactNode }) => <StudyStoreContext.Provider value={mocks.context}>{children}</StudyStoreContext.Provider>,
  });
  const key = hook.result.current.recorderKey;
  await act(async () => { await hook.result.current.next.goToNextStep(); });
  expect(mocks.save.mock.calls[0][0].purchase_0.assetIdentifier).toBe(key);
  expect(mocks.context.store.getState().answers.purchase_0.assetIdentifier).toBe(key);
});

test.each(['ready', 'missing'] as const)('release regression: saves and advances with a %s video asset', async (status) => {
  const { store, actions } = mocks.context;
  store.dispatch(actions.setAssetStatus({ identifier: 'purchase_0', status }));
  const hook = mount();
  expect(hook.result.current.isNextDisabled).toBe(false);
  await act(async () => { await hook.result.current.goToNextStep(); });
  expect(mocks.save).toHaveBeenCalledTimes(1);
  expect(mocks.navigate).toHaveBeenCalledTimes(1);
});
