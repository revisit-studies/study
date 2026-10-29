import { act, renderHook } from '@testing-library/react';
import {
  beforeEach, expect, test, vi,
} from 'vitest';
import type { JumpFunctionParameters, StoreState } from '../../store/types';
import { createGlobalStoreSubmission, getActiveGlobalStoreSubmissions, getGlobalStoreNodeState } from '../../store/globalStoreProvenance';
import { makeStoredAnswer, makeStudyConfig } from '../../tests/utils';
import { useCurrentComponent } from '../utils';

const mocks = vi.hoisted(() => ({
  state: {} as StoreState,
  params: { studyId: 'study', index: '1', funcIndex: '0' },
  navigate: vi.fn(),
  dispatch: vi.fn(),
  generate: vi.fn(({ store }: JumpFunctionParameters<unknown>) => ({ component: Number(store.budget) > 70 ? 'purchase' : null })),
}));
vi.mock('react-router', () => ({
  useParams: () => mocks.params, useNavigate: () => mocks.navigate, useSearchParams: () => [new URLSearchParams()],
}));
vi.mock('../../store/store', () => ({
  useFlatSequence: () => ['intro', 'block', 'refund', 'later', 'end'],
  useStoreSelector: (select: (state: StoreState) => unknown) => select(mocks.state),
  useStoreActions: () => ({ pushToFuncSequence: (payload: unknown) => payload }),
  useStoreDispatch: () => mocks.dispatch,
}));
vi.mock('../../store/hooks/useStudyConfig', () => ({ useStudyConfig: () => mocks.state.config }));
vi.mock('../../store/hooks/useIsAnalysis', () => ({ useIsAnalysis: () => false }));
vi.mock('../../utils/encryptDecryptIndex', () => ({ encryptIndex: String, decryptIndex: Number }));
vi.mock('../../public/test-global-store/assets/dynamic', () => ({ default: mocks.generate }));
vi.mock('../../public/libraries/drawing/assets/DrawingEditor', () => ({ default: () => null }));

const definitions = { budget: { initialValue: 100 } };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.params.funcIndex = '0';
  const config = makeStudyConfig({
    globalVariables: definitions,
    components: {
      intro: { type: 'questionnaire', response: [] },
      purchase: { type: 'questionnaire', response: [] },
      refund: { type: 'questionnaire', response: [] },
      later: { type: 'questionnaire', response: [] },
    },
    sequence: {
      order: 'fixed', components: ['intro', { id: 'block', order: 'dynamic', functionPath: 'test-global-store/assets/dynamic.tsx' }, 'refund', 'later'],
    },
  });
  mocks.state = {
    config,
    sequence: { ...config.sequence, orderPath: 'root', skip: [] },
    answers: {},
    globalVariables: { budget: 100 },
    globalStoreRevision: 0,
    globalStoreSubmitting: false,
  } as unknown as StoreState;
});

test('destination generation waits for the pending local save and then sees its accepted result', () => {
  mocks.state.globalStoreSubmitting = true;
  mocks.state.globalStorePendingIdentifier = 'intro_0';
  mocks.state.globalStorePendingRevision = 0;
  const hook = renderHook(useCurrentComponent);
  expect(mocks.generate).not.toHaveBeenCalled();
  expect(mocks.navigate).not.toHaveBeenCalled();
  const accepted = createGlobalStoreSubmission(undefined, definitions, makeStoredAnswer({ identifier: 'intro_0', trialOrder: '0', endTime: 10 }), { budget: 70 }, [], {});
  act(() => {
    mocks.state.globalStoreGraph = accepted.graph;
    mocks.state.globalVariables = { budget: 70 };
    mocks.state.globalStoreRevision = 1;
    hook.rerender();
  });
  expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({ store: { budget: 70 } }));
  expect(mocks.navigate).toHaveBeenCalledWith('/study/2');
});

test('unchanged dynamic revisits exclude a later refund from the generator store and answers', () => {
  const intro = makeStoredAnswer({
    identifier: 'intro_0', componentName: 'intro', trialOrder: '0', endTime: 10,
  });
  const purchase = makeStoredAnswer({
    identifier: 'block_1_purchase_0', componentName: 'purchase', trialOrder: '1_0', answer: { cost: 30 }, endTime: 20,
  });
  const refund = makeStoredAnswer({
    identifier: 'refund_2', componentName: 'refund', trialOrder: '2', answer: { refund: 20 }, endTime: 30,
  });
  const first = createGlobalStoreSubmission(undefined, definitions, intro, { budget: 100 }, [], {});
  const spent = createGlobalStoreSubmission(first.graph, definitions, purchase, { budget: 70 }, [], {});
  const refunded = createGlobalStoreSubmission(spent.graph, definitions, refund, { budget: 90 }, [], {});
  const unchanged = createGlobalStoreSubmission(refunded.graph, definitions, purchase, { budget: 70 }, [], {});
  mocks.params.funcIndex = '1';
  mocks.state.globalStoreGraph = unchanged.graph;
  mocks.state.globalVariables = getGlobalStoreNodeState(unchanged.graph).values;
  mocks.state.answers = Object.fromEntries(getActiveGlobalStoreSubmissions(unchanged.graph).map(({ submission }) => [submission.answer.identifier, submission.answer]));
  renderHook(useCurrentComponent);
  expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({
    store: { budget: 70 }, answers: { intro_0: intro, block_1_purchase_0: purchase },
  }));
  expect(mocks.navigate).toHaveBeenCalledWith('/study/2');
  expect(mocks.dispatch).not.toHaveBeenCalled();
  expect(mocks.state.globalVariables.budget).toBe(90);
});
