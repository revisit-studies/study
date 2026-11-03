import {
  cleanup, render, screen, waitFor,
} from '@testing-library/react';
import {
  afterEach, expect, test, vi,
} from 'vitest';
import { MantineProvider } from '@mantine/core';
import { ReactComponentController } from '../ReactComponentController';
import { TrialProvenanceBoundary } from '../../store/hooks/useTrialProvenance';
import { useStudyState } from '../../store/hooks/useStudyState';
import { makeStoredAnswer, makeStudyConfig } from '../../tests/utils';
import type { StoreState } from '../../store/types';

const mocks = vi.hoisted(() => ({
  state: {} as StoreState,
  flat: ['dyn'],
  funcIndex: '0',
  analysis: false,
  navigate: vi.fn(),
  dispatch: vi.fn(),
  actions: {
    pushToFuncSequence: vi.fn(), updateProvenance: vi.fn(), updateResponseBlockValidation: vi.fn(), setReactiveAnswers: vi.fn(),
  },
}));
vi.mock('../../store/hooks/useGlobalStore', () => ({ useGlobalStore: () => ({}), useGlobalStoreUpdaterRegistration: () => vi.fn() }));
vi.mock('react-router', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => ({ studyId: 'test', index: '0', funcIndex: mocks.funcIndex }),
  useSearchParams: () => [new URLSearchParams(mocks.analysis ? 'participantId=p' : '')],
}));
vi.mock('../../utils/encryptDecryptIndex', () => ({ decryptIndex: Number, encryptIndex: String }));
vi.mock('../../store/store', () => ({
  useStoreSelector: (selector: (state: StoreState) => unknown) => selector(mocks.state),
  useFlatSequence: () => mocks.flat,
  useStoreDispatch: () => mocks.dispatch,
  useStoreActions: () => mocks.actions,
}));
vi.mock('../../store/hooks/useAssetStatus', () => ({
  useAssetStatus: () => {},
  useAssetLoadStatus: () => ({ status: 'ready', onReady: () => {}, onError: () => {} }),
}));
vi.mock('../../public/demo-react-trrack/assets/DemoReactTrrack', () => ({
  default: function AnswerOnlyStimulus() {
    const [value] = useStudyState({ responseId: 'value', initialState: 'default' });
    return <output>{value}</output>;
  },
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  mocks.funcIndex = '0';
  mocks.analysis = false;
});

test('restores saved answer-only state when a dynamic controller mounts', async () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  const config = { type: 'react-component' as const, path: 'demo-react-trrack/assets/DemoReactTrrack.tsx', response: [] };
  mocks.state = {
    participantId: 'p',
    answers: { dyn_0_trial_0: makeStoredAnswer({ componentName: 'trial', endTime: 20, answer: { value: 'saved' } }) },
    trialValidation: { dyn_0_trial_0: { stimulus: { valid: true, values: { value: 'saved' } } } },
    config: makeStudyConfig({ components: { trial: config } }),
    sequence: { order: 'fixed', components: [] },
  } as unknown as StoreState;
  render(<MantineProvider><ReactComponentController currentConfig={config} answers={mocks.state.answers} /></MantineProvider>);
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('saved'));
});

test('analysis switching dynamic iterations refreshes the answer-only snapshot', async () => {
  mocks.dispatch.mockClear();
  mocks.analysis = true;
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  const config = { type: 'react-component' as const, path: 'demo-react-trrack/assets/DemoReactTrrack.tsx', response: [] };
  mocks.state = {
    participantId: 'p',
    answers: { dyn_0_trial_0: makeStoredAnswer({ componentName: 'trial', endTime: 20, answer: { value: 'first' } }), dyn_0_trial_1: makeStoredAnswer({ componentName: 'trial', endTime: 30, answer: { value: 'second' } }) },
    trialValidation: { dyn_0_trial_0: { stimulus: { valid: true, values: { value: 'first' } } } },
    config: makeStudyConfig({ components: { trial: config } }),
    sequence: { order: 'fixed', components: [] },
  } as unknown as StoreState;
  const draw = () => <MantineProvider><TrialProvenanceBoundary><ReactComponentController currentConfig={config} answers={mocks.state.answers} /></TrialProvenanceBoundary></MantineProvider>;
  const view = render(draw());
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('first'));
  mocks.funcIndex = '1';
  view.rerender(draw());
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('second'));
  expect(mocks.dispatch).not.toHaveBeenCalled();
});
