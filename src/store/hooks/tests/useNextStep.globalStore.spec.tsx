import type { ReactNode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  afterEach, beforeEach, expect, test, vi,
} from 'vitest';
import { StudyStoreContext, studyStoreCreator, type StudyStore } from '../../store';
import type { StoreState } from '../../types';
import { makeStoredAnswer, makeStudyConfig } from '../../../tests/utils';
import { createGlobalStoreSubmission } from '../../globalStoreProvenance';
import { useNextStep } from '../useNextStep';

const mocks = vi.hoisted(() => ({
  context: undefined as unknown as StudyStore,
  navigate: vi.fn(),
  save: vi.fn(),
  confirm: undefined as undefined | (() => void),
}));
vi.mock('../../store', async (original) => ({
  ...await original<Record<string, unknown>>(),
  useStoreSelector: (select: (state: StoreState) => unknown) => select(mocks.context.store.getState()),
  useStoreActions: () => mocks.context.actions,
  useStoreDispatch: () => mocks.context.store.dispatch,
  useFlatSequence: () => ['purchase', 'later', 'end'],
}));
vi.mock('../../../routes/utils', () => ({ useCurrentIdentifier: () => 'purchase_0', useCurrentStep: () => 0, useStudyId: () => 'study' }));
vi.mock('../../../storage/storageEngineHooks', () => ({ useStorageEngine: () => ({ storageEngine: { saveGlobalStoreSubmission: mocks.save } }) }));
vi.mock('../useStudyConfig', () => ({ useStudyConfig: () => mocks.context.store.getState().config }));
vi.mock('../useStoredAnswer', () => ({ useStoredAnswer: () => mocks.context.store.getState().answers.purchase_0 }));
vi.mock('../useWindowEvents', () => ({ useWindowEvents: () => ({ current: [] }) }));
vi.mock('../useIsAnalysis', () => ({ useIsAnalysis: () => false }));
vi.mock('../../../components/response/customResponseModules', () => ({ getCustomResponseModule: () => null, getCustomResponseModuleLoadError: () => null }));
vi.mock('react-router', () => ({ useNavigate: () => mocks.navigate, useParams: () => ({}) }));
vi.mock('@mantine/modals', () => ({ openConfirmModal: (options: { onConfirm: () => void }) => { mocks.confirm = options.onConfirm; } }));

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.confirm = undefined;
  mocks.save.mockResolvedValue(undefined);
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
  return renderHook(() => useNextStep(), { wrapper: ({ children }: { children: ReactNode }) => <StudyStoreContext.Provider value={mocks.context}>{children}</StudyStoreContext.Provider> });
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

test('normal advancement keeps the lock until the destination trial mounts', async () => {
  const hook = mount();
  await act(async () => { await hook.result.current.goToNextStep(); });
  expect(mocks.context.store.getState().globalStoreRevision).toBe(1);
  expect(mocks.navigate).toHaveBeenCalledTimes(1);
  expect(mocks.context.store.getState().globalStoreSubmitting).toBe(true);
});
