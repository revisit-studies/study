import { useEffect } from 'react';
import { initializeTrrack, Registry } from '@trrack/core';
import { MantineProvider } from '@mantine/core';
import { Provider } from 'react-redux';
import {
  act, cleanup, fireEvent, render, screen, waitFor,
} from '@testing-library/react';
import {
  afterEach, beforeEach, expect, test, vi,
} from 'vitest';
import type { View } from 'react-vega';
import type { VegaComponent } from '../../parser/types';
import type { StoredAnswer, StoredProvenance } from '../../store/types';
import { VegaController } from '../VegaController';
import { ResponseBlock } from '../../components/response/ResponseBlock';
import { TrialProvenanceBoundary } from '../../store/hooks/useTrialProvenance';
import { WindowEventsContext } from '../../store/hooks/useWindowEvents';
import { studyStoreCreator, StudyStoreContext } from '../../store/store';
import { makeStudyConfig, makeStoredAnswer } from '../../tests/utils';

const mocks = vi.hoisted(() => ({
  getProvenance: vi.fn(),
  navigate: vi.fn(),
  saveAnswers: vi.fn(),
  saveProvenance: vi.fn(),
  signalListeners: {} as Record<string, (key: string, value: unknown) => void>,
}));
const storageEngine = {
  getProvenance: mocks.getProvenance, saveAnswers: mocks.saveAnswers, saveProvenance: mocks.saveProvenance,
};
vi.mock('../../storage/storageEngineHooks', () => ({ useStorageEngine: () => ({ storageEngine }) }));
vi.mock('../../store/hooks/useIsAnalysis', () => ({ useIsAnalysis: () => false }));
vi.mock('../../routes/utils', () => ({
  useCurrentIdentifier: () => 'trial_0', useCurrentComponent: () => 'trial', useCurrentStep: () => 0, useStudyId: () => 'test-study',
}));
vi.mock('react-router', () => ({ useParams: () => ({}), useNavigate: () => mocks.navigate, useSearchParams: () => [new URLSearchParams()] }));
vi.mock('react-vega', () => ({
  Vega: ({ onNewView, signalListeners }: { onNewView: (view: View) => void; signalListeners: typeof mocks.signalListeners }) => {
    mocks.signalListeners = signalListeners;
    useEffect(() => {
      onNewView({ signal: () => null, run: () => undefined } as unknown as View);
    }, [onNewView]);
    return <div>Chart ready</div>;
  },
}));
vi.mock('../../components/NextButton', () => ({ NextButton: ({ onNext }: { onNext: () => void }) => <button type="button" onClick={onNext}>Next</button> }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProvenance.mockResolvedValue(null);
  mocks.saveAnswers.mockResolvedValue(undefined);
  mocks.saveProvenance.mockResolvedValue(undefined);
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(cleanup);

const component: VegaComponent = {
  type: 'vega',
  config: { marks: [], config: { signals: [{ name: 'revisitAnswer' }, { name: 'hovered' }] } },
  response: [
    {
      id: 'selection', type: 'reactive', required: true, prompt: 'Selected',
    },
    {
      id: 'confidence', type: 'numerical', min: 0, max: 100, required: false, prompt: 'Confidence',
    },
  ],
};
const graph = (signals: Record<string, unknown>) => initializeTrrack({ registry: Registry.create(), initialState: { signals } }).graph.backend;

async function mount(answer: StoredAnswer['answer'] = { selection: 'recorded-choice' }, provenance?: Partial<StoredProvenance>) {
  mocks.getProvenance.mockResolvedValue(provenance ?? null);
  const status = makeStoredAnswer({
    identifier: 'trial_0', componentName: 'trial', startTime: 10, endTime: Object.keys(answer).length ? 20 : -1, answer,
  });
  const store = await studyStoreCreator(
    'test-study',
    makeStudyConfig({ components: { trial: component, review: { type: 'questionnaire', previousButton: true, response: [] } } }),
    {
      id: 'root', orderPath: 'root', order: 'fixed', components: ['trial', 'review'], skip: [],
    },
    {
      userAgent: 'test', resolution: { width: 1000, height: 800 }, language: 'en', ip: null,
    },
    { trial_0: status },
    { dataCollectionEnabled: true, developmentModeEnabled: false, dataSharingEnabled: false },
    'participant',
    false,
    false,
  );
  store.store.dispatch(store.actions.setClickedPrevious(true));
  render(
    <Provider store={store.store}>
      <StudyStoreContext.Provider value={store}>
        <MantineProvider>
          <WindowEventsContext.Provider value={{ current: [] }}>
            <TrialProvenanceBoundary>
              <VegaController currentConfig={component} />
              <ResponseBlock config={component} status={status} location="belowStimulus" />
            </TrialProvenanceBoundary>
          </WindowEventsContext.Provider>
        </MantineProvider>
      </StudyStoreContext.Provider>
    </Provider>,
  );
  await screen.findByText('Chart ready');
  await waitFor(() => expect(store.store.getState().trialValidation.trial_0.assetStatus).toBe('ready'));
  return store;
}

test('a saved Vega answer continues without a graph or synthetic interactions', async () => {
  const store = await mount();
  expect(screen.getByText('recorded-choice')).toBeTruthy();
  const stimulus = store.store.getState().trialValidation.trial_0.provenanceGraph.stimulus!;
  expect(Object.keys(stimulus.nodes)).toHaveLength(1);
  expect(stimulus.traversalEvents ?? []).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(mocks.navigate).toHaveBeenCalledTimes(1);
  expect(mocks.saveAnswers.mock.calls[0][0].trial_0.answer.selection).toBe('recorded-choice');
});

test.each(['missing', 'answerless'] as const)('saved-answer fallback with a %s graph survives signals and later answer edits', async (kind) => {
  const store = await mount(undefined, kind === 'answerless' ? { stimulus: graph({}) } : undefined);
  await act(async () => { mocks.signalListeners.hovered('hovered', 'bar-a'); });
  expect(store.store.getState().trialValidation.trial_0.stimulus).toMatchObject({ valid: true, values: { selection: 'recorded-choice' } });
  await act(async () => { mocks.signalListeners.revisitAnswer('revisitAnswer', { responseId: 'selection', response: 'new-choice' }); });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(mocks.navigate).toHaveBeenCalledTimes(1);
  expect(mocks.saveAnswers.mock.calls[0][0].trial_0.answer.selection).toBe('new-choice');
});

test('new trials still require a participant answer', async () => {
  await mount({});
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(mocks.navigate).not.toHaveBeenCalled();
  await act(async () => { mocks.signalListeners.revisitAnswer('revisitAnswer', { responseId: 'selection', response: 'first-choice' }); });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(mocks.navigate).toHaveBeenCalledTimes(1);
});

test('retained graph answers take precedence over older saved answers', async () => {
  const stimulus = graph({ revisitAnswer: { responseId: 'selection', response: 'graph-choice' } });
  const store = await mount(undefined, { stimulus });
  expect(store.store.getState().trialValidation.trial_0.stimulus.values).toEqual({ selection: 'graph-choice' });
  expect(store.store.getState().trialValidation.trial_0.provenanceGraph.stimulus).toEqual(stimulus);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(mocks.saveAnswers.mock.calls[0][0].trial_0.answer.selection).toBe('graph-choice');
});

test('saved host form values do not satisfy the required Vega answer', async () => {
  await mount({ confidence: 40 });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(mocks.navigate).not.toHaveBeenCalled();
});
