import { initializeTrrack, Registry } from '@trrack/core';
import { MantineProvider } from '@mantine/core';
import { Provider } from 'react-redux';
import {
  act, cleanup, fireEvent, render, screen, waitFor,
} from '@testing-library/react';
import {
  afterEach, beforeEach, expect, test, vi,
} from 'vitest';
import { ResponseBlock } from '../ResponseBlock';
import { TrialProvenanceBoundary } from '../../../store/hooks/useTrialProvenance';
import { WindowEventsContext } from '../../../store/hooks/useWindowEvents';
import { studyStoreCreator, StudyStoreContext } from '../../../store/store';
import { makeStudyConfig, makeStoredAnswer } from '../../../tests/utils';
import { createEmptyProvenance } from '../../../store/provenance';
import type { IndividualComponent } from '../../../parser/types';
import type { Sequence, StoredAnswer, StoredProvenance } from '../../../store/types';

const { getProvenance, navigate } = vi.hoisted(() => ({ getProvenance: vi.fn(), navigate: vi.fn() }));
const storageEngine = { getProvenance, saveAnswers: vi.fn(() => Promise.resolve()) };
vi.mock('../../../storage/storageEngineHooks', () => ({ useStorageEngine: () => ({ storageEngine }) }));
vi.mock('../../../store/hooks/useIsAnalysis', () => ({ useIsAnalysis: () => false }));
vi.mock('../../../routes/utils', () => ({
  useCurrentIdentifier: () => 'trial_0',
  useCurrentComponent: () => 'trial',
  useCurrentStep: () => 0,
  useStudyId: () => 'test-study',
}));
vi.mock('react-router', () => ({ useParams: () => ({}), useNavigate: () => navigate, useSearchParams: () => [new URLSearchParams()] }));
vi.mock('../../NextButton', () => ({
  NextButton: ({ hideNextButton }: { hideNextButton?: boolean }) => (
    <div data-testid="restoration-next" data-hidden={hideNextButton ? 'true' : 'false'} />
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const component: IndividualComponent = {
  type: 'questionnaire',
  response: [
    {
      id: 'controller', type: 'radio', prompt: 'Show details?', options: ['yes', 'no'], location: 'sidebar',
    },
    {
      id: 'dependent',
      type: 'shortText',
      prompt: 'Details',
      visibleIf: { responseId: 'controller', comparison: 'equals', value: 'yes' },
    },
  ],
};
const sequence: Sequence = {
  id: 'root', orderPath: 'root', order: 'fixed', components: ['trial', 'review'], skip: [],
};
const formGraph = (form: Record<string, string>) => initializeTrrack({ registry: Registry.create(), initialState: { form, showResponseErrors: false, interactionSource: 'click' } }).graph.backend;

async function restore(provenance: Partial<StoredProvenance>, answer = { controller: 'yes', dependent: 'University' }) {
  getProvenance.mockResolvedValue(provenance);
  const status = makeStoredAnswer({
    identifier: 'trial_0', componentName: 'trial', startTime: 10, endTime: 20, answer,
  });
  const studyStore = await studyStoreCreator(
    'test-study',
    makeStudyConfig({ components: { trial: component, review: { type: 'questionnaire', previousButton: true, response: [] } } }),
    sequence,
    {
      userAgent: 'test', resolution: { width: 1000, height: 800 }, language: 'en', ip: null,
    },
    { trial_0: status },
    { dataCollectionEnabled: true, developmentModeEnabled: false, dataSharingEnabled: false },
    'participant',
    false,
    false,
  );
  render(
    <Provider store={studyStore.store}>
      <StudyStoreContext.Provider value={studyStore}>
        <MantineProvider>
          <WindowEventsContext.Provider value={{ current: [] }}>
            <TrialProvenanceBoundary>
              <ResponseBlock config={component} location="sidebar" status={status} />
              <ResponseBlock config={component} location="belowStimulus" status={status} />
            </TrialProvenanceBoundary>
          </WindowEventsContext.Provider>
        </MantineProvider>
      </StudyStoreContext.Provider>
    </Provider>,
  );
  await screen.findByRole('radio', { name: 'yes' });
  return studyStore;
}

test('restores conditional answers across response locations without changing either graph', async () => {
  const sidebar = formGraph({ controller: 'yes' });
  const belowStimulus = formGraph({ dependent: 'University' });
  const store = await restore({ sidebar, belowStimulus });
  await waitFor(() => expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('University'));
  expect(store.store.getState().trialValidation.trial_0.provenanceGraph).toMatchObject({ sidebar, belowStimulus });
});

test('retained controller state overrides older saved answers before conditional answers mount', async () => {
  const store = await restore({ sidebar: formGraph({ controller: 'yes' }), belowStimulus: formGraph({ dependent: 'University' }) }, { controller: 'no', dependent: '' });
  await waitFor(() => expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('University'));
  expect(store.store.getState().trialValidation.trial_0.sidebar.values).toEqual({ controller: 'yes' });
});

test('an empty retained form does not resurrect older conditional answers', async () => {
  const sidebar = formGraph({ controller: 'no' });
  const belowStimulus = formGraph({});
  const store = await restore({ sidebar, belowStimulus });
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(store.store.getState().trialValidation.trial_0.belowStimulus.values).toEqual({});
  expect(store.store.getState().trialValidation.trial_0.provenanceGraph).toMatchObject({ sidebar, belowStimulus });
});

test('a legacy controller answer restores without adding interactions to the dependent graph', async () => {
  const belowStimulus = formGraph({ dependent: 'University' });
  const store = await restore({ belowStimulus });
  await waitFor(() => expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('University'));
  expect(store.store.getState().trialValidation.trial_0.belowStimulus.values).toEqual({ dependent: 'University' });
  expect(store.store.getState().trialValidation.trial_0.provenanceGraph.belowStimulus).toEqual(belowStimulus);
});

async function restoreLockedAutoAdvance(
  checkAnswer?: StoredAnswer['checkAnswer'],
  expectedAnswer = 'A',
  withDontKnow = false,
  options: { allowResponseChange?: boolean; selectedButtonResponses?: string[]; autoAdvanceDelay?: number; trainingAttempts?: number; allowFailedTraining?: boolean; nextHasPreviousButton?: boolean; choiceLocation?: 'aboveStimulus' | 'belowStimulus'; includeText?: boolean; initialChoice?: string } = {},
) {
  const autoAdvanceComponent: IndividualComponent = {
    type: 'questionnaire',
    provideFeedback: true,
    trainingAttempts: options.trainingAttempts,
    allowFailedTraining: options.allowFailedTraining,
    response: [{
      id: 'choice',
      type: 'buttons',
      prompt: 'Choose',
      options: ['A', 'B'],
      default: 'A',
      ...(withDontKnow ? { withDontKnow: true } : {}),
      autoAdvanceToNextStep: true,
      autoAdvanceDelay: options.autoAdvanceDelay ?? 10,
      allowResponseChange: options.allowResponseChange ?? false,
      location: options.choiceLocation ?? 'belowStimulus',
    }, ...(options.includeText ? [{ id: 'note', type: 'shortText' as const, prompt: 'Note' }] : [])],
    correctAnswer: [{ id: 'choice', answer: expectedAnswer }, ...(options.includeText ? [{ id: 'note', answer: 'good' }] : [])],
  };
  const choiceForm = initializeTrrack({
    registry: Registry.create(),
    initialState: {
      form: { choice: options.initialChoice ?? 'A', ...(withDontKnow ? { 'choice-dontKnow': false } : {}), ...(options.includeText && options.choiceLocation !== 'aboveStimulus' ? { note: 'good' } : {}) },
      selectedButtonResponses: options.selectedButtonResponses ?? ['choice'],
      showResponseErrors: false,
      interactionSource: 'click',
    },
  }).graph.backend;
  const textForm = options.includeText && options.choiceLocation === 'aboveStimulus'
    ? formGraph({ note: 'good' }) : undefined;
  const status = makeStoredAnswer({
    identifier: 'trial_0',
    componentName: 'trial',
    startTime: 10,
    endTime: 20,
    answer: { choice: options.initialChoice ?? 'A', ...(withDontKnow ? { 'choice-dontKnow': false } : {}), ...(options.includeText ? { note: 'good' } : {}) },
    checkAnswer,
  });
  getProvenance.mockResolvedValue({ ...createEmptyProvenance(), belowStimulus: textForm ?? choiceForm, ...(options.choiceLocation === 'aboveStimulus' ? { aboveStimulus: choiceForm } : {}) });
  const studyStore = await studyStoreCreator(
    'test-study',
    makeStudyConfig({ components: { trial: autoAdvanceComponent, review: { type: 'questionnaire', previousButton: options.nextHasPreviousButton, response: [] } } }),
    sequence,
    {
      userAgent: 'test', resolution: { width: 1000, height: 800 }, language: 'en', ip: null,
    },
    { trial_0: status },
    { dataCollectionEnabled: true, developmentModeEnabled: false, dataSharingEnabled: false },
    'participant',
    false,
    false,
  );
  render(
    <Provider store={studyStore.store}>
      <StudyStoreContext.Provider value={studyStore}>
        <MantineProvider>
          <WindowEventsContext.Provider value={{ current: [] }}>
            <TrialProvenanceBoundary>
              {options.choiceLocation === 'aboveStimulus' && <ResponseBlock config={autoAdvanceComponent} location="aboveStimulus" status={status} />}
              <ResponseBlock config={autoAdvanceComponent} location="belowStimulus" status={status} />
            </TrialProvenanceBoundary>
          </WindowEventsContext.Provider>
        </MantineProvider>
      </StudyStoreContext.Provider>
    </Provider>,
  );

  return studyStore;
}

test('rearms auto-advance for a restored locked button selection without showing Next', async () => {
  const store = await restoreLockedAutoAdvance();
  await waitFor(() => expect(store.store.getState().buttonAutoAdvancePending.trial_0?.responseId).toBe('choice'));
  expect(screen.getByTestId('restoration-next').getAttribute('data-hidden')).toBe('true');
  await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
  expect(store.store.getState().checkAnswer.trial_0?.attemptsUsed).toBe(1);
  expect(store.store.getState().buttonSelectionIds.trial_0).toContain('choice');
});

test('resubmits a restored correct locked response without consuming another training attempt', async () => {
  const store = await restoreLockedAutoAdvance({
    attemptsUsed: 1,
    correct: true,
    responses: { choice: true },
    checkedAnswers: { choice: 'A' },
  });
  await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
  expect(store.store.getState().checkAnswer.trial_0?.attemptsUsed).toBe(1);
});

test('continues a restored correct response when response changes were allowed', async () => {
  const store = await restoreLockedAutoAdvance({
    attemptsUsed: 1,
    correct: true,
    responses: { choice: true },
    checkedAnswers: { choice: 'A' },
  }, 'A', false, { allowResponseChange: true });
  expect(screen.getByTestId('restoration-next').getAttribute('data-hidden')).toBe('true');
  await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
  expect(store.store.getState().checkAnswer.trial_0?.attemptsUsed).toBe(1);
});

test('grades an editable answer changed during restored continuation before advancing', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const store = await restoreLockedAutoAdvance({
    attemptsUsed: 1,
    correct: true,
    responses: { choice: true },
    checkedAnswers: { choice: 'A' },
  }, 'A', false, {
    allowResponseChange: true,
    autoAdvanceDelay: 250,
    trainingAttempts: 3,
    allowFailedTraining: false,
    nextHasPreviousButton: true,
  });
  const incorrectOption = screen.getByRole('radio', { name: 'B' });
  expect(incorrectOption).not.toHaveProperty('disabled', true);
  fireEvent.click(incorrectOption);
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
  expect(store.store.getState().trialValidation.trial_0.belowStimulus.values).toMatchObject({ choice: 'B' });
  expect(store.store.getState().checkAnswer.trial_0?.attemptsUsed).toBe(2);
  expect(store.store.getState().checkAnswer.trial_0).toMatchObject({ correct: false, checkedAnswers: { choice: 'B' } });
  expect(screen.getByText('Incorrect Answer')).toBeTruthy();
  expect(navigate).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
  expect(navigate).not.toHaveBeenCalled();
});

test('grades a text edit during a restored locked button continuation', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const store = await restoreLockedAutoAdvance({
    attemptsUsed: 1,
    correct: true,
    responses: { choice: true, note: true },
    checkedAnswers: { choice: 'A', note: 'good' },
  }, 'A', false, {
    includeText: true,
    autoAdvanceDelay: 250,
    trainingAttempts: 3,
    allowFailedTraining: false,
    nextHasPreviousButton: true,
  });
  fireEvent.change(screen.getByRole('textbox', { name: /Note/ }), { target: { value: 'bad' } });
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
  expect(store.store.getState().checkAnswer.trial_0).toMatchObject({
    attemptsUsed: 2,
    correct: false,
    checkedAnswers: { choice: 'A', note: 'bad' },
  });
  expect(screen.getByText('Incorrect Answer')).toBeTruthy();
  expect(navigate).not.toHaveBeenCalled();
});

test('waits for grading when an editable button in another location changes during restored continuation', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const store = await restoreLockedAutoAdvance({
    attemptsUsed: 1,
    correct: true,
    responses: { choice: true },
    checkedAnswers: { choice: 'A' },
  }, 'A', false, {
    choiceLocation: 'aboveStimulus',
    allowResponseChange: true,
    autoAdvanceDelay: 250,
    trainingAttempts: 3,
    allowFailedTraining: false,
    nextHasPreviousButton: true,
  });
  await act(async () => { await vi.advanceTimersByTimeAsync(100); });
  fireEvent.click(screen.getByRole('radio', { name: 'B' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(150); });
  expect(store.store.getState().checkAnswer.trial_0?.attemptsUsed).toBe(1);
  expect(navigate).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(100); });
  expect(store.store.getState().checkAnswer.trial_0).toMatchObject({
    attemptsUsed: 2,
    correct: false,
    checkedAnswers: { choice: 'B' },
  });
  expect(navigate).not.toHaveBeenCalled();
});

test('regrades a restored answer changed after its saved correct feedback', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const store = await restoreLockedAutoAdvance({
    attemptsUsed: 1,
    correct: true,
    responses: { choice: true },
    checkedAnswers: { choice: 'A' },
  }, 'A', false, {
    initialChoice: 'B',
    allowResponseChange: true,
    autoAdvanceDelay: 250,
    trainingAttempts: 3,
    allowFailedTraining: false,
    nextHasPreviousButton: true,
  });
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
  expect(store.store.getState().checkAnswer.trial_0).toMatchObject({
    attemptsUsed: 2,
    correct: false,
    checkedAnswers: { choice: 'B' },
  });
  expect(navigate).not.toHaveBeenCalled();
});

test('does not consume another attempt after a restored training limit is exhausted', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const store = await restoreLockedAutoAdvance({
    attemptsUsed: 1,
    correct: true,
    responses: { choice: true },
    checkedAnswers: { choice: 'A' },
  }, 'A', false, {
    allowResponseChange: true,
    autoAdvanceDelay: 250,
    trainingAttempts: 1,
    allowFailedTraining: true,
    nextHasPreviousButton: true,
  });
  await act(async () => { await vi.advanceTimersByTimeAsync(100); });
  fireEvent.click(screen.getByRole('radio', { name: 'B' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
  expect(store.store.getState().checkAnswer.trial_0?.attemptsUsed).toBe(1);
  expect(navigate).toHaveBeenCalledTimes(1);
});

test('does not advance an exhausted incorrect response when failed training is disallowed', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const store = await restoreLockedAutoAdvance({
    attemptsUsed: 1,
    correct: false,
    responses: { choice: false },
    checkedAnswers: { choice: 'A' },
  }, 'B', false, {
    autoAdvanceDelay: 250,
    trainingAttempts: 1,
    allowFailedTraining: false,
  });
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
  expect(store.store.getState().checkAnswer.trial_0?.attemptsUsed).toBe(1);
  expect(navigate).not.toHaveBeenCalled();
});

test('continues a restored graded default answer without a recorded button selection', async () => {
  const store = await restoreLockedAutoAdvance({
    attemptsUsed: 1,
    correct: true,
    responses: { choice: true },
    checkedAnswers: { choice: 'A' },
  }, 'A', false, { allowResponseChange: true, selectedButtonResponses: [] });
  await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
  expect(store.store.getState().checkAnswer.trial_0?.attemptsUsed).toBe(1);
});

test('continues a restored exhausted attempt when failed training is allowed', async () => {
  const store = await restoreLockedAutoAdvance({
    attemptsUsed: 2,
    correct: false,
    responses: { choice: false },
    checkedAnswers: { choice: 'A' },
  }, 'B', false, { allowResponseChange: true });
  await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
  expect(store.store.getState().checkAnswer.trial_0?.attemptsUsed).toBe(2);
});

test('does not regrade an unchanged restored incorrect response automatically', async () => {
  const store = await restoreLockedAutoAdvance({
    attemptsUsed: 1,
    correct: false,
    responses: { choice: false },
    checkedAnswers: { choice: 'A' },
  }, 'B');
  await waitFor(() => expect(store.store.getState().buttonAutoAdvancePending.trial_0?.responseId).toBe('choice'));
  await waitFor(() => expect(store.store.getState().buttonAutoAdvancePending.trial_0).toBeUndefined());
  expect(store.store.getState().checkAnswer.trial_0?.attemptsUsed).toBe(1);
  expect(navigate).not.toHaveBeenCalled();
});

test('regrades a restored button when its dont-know answer changed since feedback', async () => {
  const store = await restoreLockedAutoAdvance({
    attemptsUsed: 1,
    correct: false,
    responses: { choice: false },
    checkedAnswers: { choice: 'A', 'choice-dontKnow': true },
  }, 'A', true);
  await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
  expect(store.store.getState().checkAnswer.trial_0?.attemptsUsed).toBe(2);
});
