import type { ReactNode } from 'react';
import { MantineProvider } from '@mantine/core';
import { Provider } from 'react-redux';
import {
  act, cleanup, fireEvent, render, screen, waitFor,
} from '@testing-library/react';
import {
  afterEach, expect, test, vi,
} from 'vitest';
import { ResponseBlock } from '../ResponseBlock';
import { StudyStoreContext, studyStoreCreator } from '../../../store/store';
import { createGlobalStoreSubmission } from '../../../store/globalStoreProvenance';
import { WindowEventsContext } from '../../../store/hooks/useWindowEvents';
import { makeStoredAnswer, makeStudyConfig } from '../../../tests/utils';
import type { IndividualComponent } from '../../../parser/types';
import { generateInitFields } from '../utils';
import { evaluateGlobalStoreUpdates } from '../../../utils/globalStore';

const { saveAnswers } = vi.hoisted(() => ({ saveAnswers: vi.fn(async (_answers: unknown) => {}) }));
vi.mock('../../../storage/storageEngineHooks', () => ({ useStorageEngine: () => ({ storageEngine: { saveAnswers } }) }));
vi.mock('../../../routes/utils', () => ({
  useCurrentIdentifier: () => 'purchase_0', useCurrentComponent: () => 'purchase', useCurrentStep: () => 0, useStudyId: () => 'study',
}));
vi.mock('react-router', () => ({ useParams: () => ({}), useNavigate: () => vi.fn(), useSearchParams: () => [new URLSearchParams()] }));
vi.mock('../../../store/hooks/useIsAnalysis', () => ({ useIsAnalysis: () => false }));
vi.mock('../../NextButton', () => ({ NextButton: ({ checkAnswer }: { checkAnswer: ReactNode }) => checkAnswer }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  saveAnswers.mockClear();
});

test('captured numerical fields and untouched sliders submit their numeric store actions', () => {
  const original = window.location.href;
  window.history.replaceState({}, '', '?cost=5');
  try {
    const responses: IndividualComponent['response'] = [
      {
        id: 'captured', type: 'numerical', prompt: '', paramCapture: 'cost', onSubmit: [{ variable: 'budget', operation: 'subtract' }],
      },
      {
        id: 'slider', type: 'slider', prompt: '', options: [{ value: 0, label: '0' }, { value: 100, label: '100' }], startingValue: 10, onSubmit: [{ variable: 'budget', operation: 'subtract' }],
      },
    ];
    const values = generateInitFields(responses, {});
    expect(values).toMatchObject({ captured: '5', slider: '10' });
    expect(evaluateGlobalStoreUpdates({ budget: 100 }, { budget: 100 }, responses, values, {}).values.budget).toBe(85);
  } finally {
    window.history.replaceState({}, '', original);
  }
});

test.each(['unsubmitted', 'accepted'])('Check Answer persists grading progress for a %s global trial', async (status) => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  const component: IndividualComponent = {
    type: 'questionnaire',
    provideFeedback: true,
    trainingAttempts: 3,
    response: [{
      id: 'cost', type: 'numerical', prompt: 'Cost', onSubmit: [{ variable: 'budget', operation: 'subtract' }],
    }],
    correctAnswer: [{ id: 'cost', answer: 42 }],
  };
  const definitions = { budget: { initialValue: 100 } };
  const accepted = makeStoredAnswer({
    identifier: 'purchase_0',
    componentName: 'purchase',
    trialOrder: '0',
    answer: {},
    timedOut: status === 'accepted',
    endTime: status === 'accepted' ? 100 : -1,
    checkAnswer: { attemptsUsed: 1, correct: false, responses: { cost: false } },
  });
  const graph = status === 'accepted' ? createGlobalStoreSubmission(undefined, definitions, accepted, { budget: 100 }, [], {}).graph : undefined;
  const store = await studyStoreCreator('study', makeStudyConfig({ globalVariables: definitions, components: { purchase: component } }), {
    order: 'fixed', orderPath: 'root', components: ['purchase'], skip: [],
  }, {
    userAgent: '', resolution: {}, language: '', ip: null,
  }, { purchase_0: accepted }, {
    dataCollectionEnabled: true, developmentModeEnabled: true, dataSharingEnabled: false,
  }, 'participant', false, false, false, undefined, graph, graph ? 1 : 0);
  render(
    <Provider store={store.store}>
      <StudyStoreContext.Provider value={store}>
        <MantineProvider>
          <WindowEventsContext.Provider value={{ current: [] }}>
            <ResponseBlock config={component} location="belowStimulus" status={accepted} />
          </WindowEventsContext.Provider>
        </MantineProvider>
      </StudyStoreContext.Provider>
    </Provider>,
  );
  const button = screen.getByRole('button', { name: 'Check Answer' }) as HTMLButtonElement;
  expect(button.disabled).toBe(false);
  fireEvent.change(screen.getByRole('textbox', { name: /Cost/ }), { target: { value: '20' } });
  await act(async () => fireEvent.click(button));
  await waitFor(() => expect(store.store.getState().checkAnswer.purchase_0.attemptsUsed).toBe(2));
  const expectedAnswer = status === 'accepted' ? {} : { cost: 20 };
  expect(store.store.getState().answers.purchase_0.answer).toEqual(expectedAnswer);
  expect(store.store.getState().globalStoreGraph?.current).toBe(graph?.current);
  expect(store.store.getState().globalVariables).toEqual({ budget: 100 });
  expect(saveAnswers.mock.lastCall?.[0]).toMatchObject({ purchase_0: { answer: expectedAnswer, checkAnswer: { checkedAnswers: { cost: 20 } } } });
});
