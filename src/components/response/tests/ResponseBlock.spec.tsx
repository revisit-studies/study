import { ReactNode } from 'react';
import isEqual from 'lodash.isequal';
import { Provider } from 'react-redux';
import {
  render, act, fireEvent, cleanup,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import * as FeedbackAlertModule from '../FeedbackAlert';
import type { IndividualComponent, StudyConfig } from '../../../parser/types';
import type { CheckAnswerState, Sequence, StoredAnswer } from '../../../store/types';
import type { REVISIT_MODE } from '../../../storage/engines/types';
import { studyStoreCreator, StudyStoreContext } from '../../../store/store';
import { ResponseBlock } from '../ResponseBlock';
import { generateInitFields, useAnswerField } from '../utils';
import { makeStoredAnswer } from '../../../tests/utils';

// ── mocks ────────────────────────────────────────────────────────────────────

const {
  mockStoredAnswerData, capturedNextButtonProps, capturedSwitcherProps, mockIsAnalysis, mockCurrentIdentifier, mockNavigate, mockSaveAnswers, mockTrrackApply, mockAnswerField, mockCustomResponseModule, mockShowNotification, mockAllowFailedTraining, mockProvideFeedback,
} = vi.hoisted(() => ({
  mockStoredAnswerData: {
    formOrder: { response: ['q1'] } as { response: string[] } | undefined,
    questionOrders: {},
    optionOrders: {},
    responseSubmitAttempted: undefined as boolean | undefined,
    checkAnswer: undefined as {
      attemptsUsed: number;
      correct: boolean;
      responses: Record<string, boolean>;
      scores?: Record<string, number>;
      answerSnapshot?: StoredAnswer['answer'];
    } | undefined,
  },
  capturedNextButtonProps: {
    onCheckAnswer: undefined as (() => void) | undefined,
  },
  capturedSwitcherProps: {
    storedAnswer: undefined as Record<string, unknown> | undefined,
    answerFinalized: undefined as boolean | undefined,
    matrixRowFeedback: undefined as Record<string, string> | undefined,
    onChange: undefined as ((value: unknown, source?: 'keyboard' | 'click') => void) | undefined,
    indexes: [] as Array<{
      id: string;
      index: number;
      disabled: boolean | undefined;
      isDelayedDisabled: boolean | undefined;
    }>,
  },
  mockIsAnalysis: { value: false },
  mockCurrentIdentifier: { value: 'trial1_0' },
  mockNavigate: vi.fn(),
  mockAllowFailedTraining: { value: true as boolean | undefined },
  mockProvideFeedback: { value: false as boolean | undefined },
  mockSaveAnswers: vi.fn(() => Promise.resolve()),
  mockTrrackApply: vi.fn(),
  mockAnswerField: {
    values: {} as Record<string, unknown>,
    isValid: vi.fn(() => true),
    setValues: vi.fn(),
    setFieldValue: vi.fn(),
    setInitialValues: vi.fn(),
    reset: vi.fn(),
    getInputProps: vi.fn(() => ({ value: '', onChange: vi.fn() })),
  },
  mockCustomResponseModule: {
    value: null as {
      default: () => null;
      validate?: (value: unknown, values: unknown, response: unknown) => string | boolean | null;
      score?: (value: unknown, values: unknown, response: unknown, expected?: unknown) => number | boolean | null;
    } | null,
  },
  mockShowNotification: vi.fn(),
}));

vi.mock('../../../utils/notifications', () => ({ showNotification: mockShowNotification }));

vi.mock('../../../storage/storageEngineHooks', () => {
  const storageEngine = { saveAnswers: mockSaveAnswers, saveProvenance: vi.fn(() => Promise.resolve()) };
  return { useStorageEngine: vi.fn(() => ({ storageEngine })) };
});

vi.mock('@mantine/core', () => ({
  Box: ({ children, className }: { children?: ReactNode; className?: string }) => <div className={className}>{children}</div>,
  Button: ({ children, disabled, onClick }: { children?: ReactNode; disabled?: boolean; onClick?: () => void }) => (
    <button type="button" disabled={disabled} onClick={onClick}>{children}</button>
  ),
  Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Text: ({ children, role }: { children?: ReactNode; role?: string }) => <p role={role}>{children}</p>,
  ThemeIcon: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Kbd: ({ children }: { children?: ReactNode }) => <kbd>{children}</kbd>,
}));

vi.mock('react-router', () => ({
  useNavigate: vi.fn(() => mockNavigate),
  useParams: vi.fn(() => ({})),
  useSearchParams: vi.fn(() => [new URLSearchParams()]),
}));

vi.mock('@trrack/core', () => ({
  Registry: {
    create: vi.fn(() => ({ register: vi.fn(() => vi.fn()) })),
  },
  initializeTrrack: vi.fn(() => ({
    apply: mockTrrackApply,
    currentChange: vi.fn(() => vi.fn()),
    graph: {
      backend: {
        root: 'root',
        current: 'root',
        nodes: {
          root: {
            id: 'root',
            createdOn: 0,
            children: [],
          },
        },
      },
    },
  })),
}));

vi.mock('lodash.isequal', () => ({ default: vi.fn(() => true) }));

vi.mock('../../../utils/handleComponentInheritance', () => ({
  studyComponentToIndividualComponent: () => ({ response: [], correctAnswer: [] }),
}));

vi.mock('../../../utils/handleResponseRandomization', () => ({
  randomizeOptions: vi.fn(() => ({})),
  randomizeQuestionOrder: vi.fn(() => ({})),
  randomizeForm: vi.fn(() => []),
}));

vi.mock('../../../store/hooks/useStudyConfig', () => ({
  useStudyConfig: vi.fn(() => ({
    uiConfig: {
      nextButtonLocation: 'belowStimulus',
      provideFeedback: mockProvideFeedback.value,
      allowFailedTraining: mockAllowFailedTraining.value,
      trainingAttempts: 2,
      nextButtonText: 'Next',
      nextOnEnter: false,
    },
    components: {},
  })),
}));

vi.mock('../../../store/hooks/useStoredAnswer', () => ({
  useStoredAnswer: vi.fn(() => mockStoredAnswerData),
}));

vi.mock('../../../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: vi.fn(() => mockIsAnalysis.value),
}));

vi.mock('../../../store/hooks/useWindowEvents', () => ({
  useWindowEvents: vi.fn(() => ({ current: [] })),
}));

vi.mock('../../../routes/utils', () => ({
  useCurrentStep: vi.fn(() => 0),
  useCurrentIdentifier: vi.fn(() => mockCurrentIdentifier.value),
  useStudyId: vi.fn(() => 'test-study'),
}));

vi.mock('../utils', () => ({
  generateInitFields: vi.fn(() => ({})),
  mergeReactiveAnswers: vi.fn((_: unknown, values: unknown) => values),
  useAnswerField: vi.fn(() => mockAnswerField),
  usesStandaloneDontKnowField: vi.fn(() => false),
}));

vi.mock('../customResponseModules', async (importOriginal) => ({
  ...await importOriginal(),
  getCustomResponseModule: vi.fn(() => mockCustomResponseModule.value),
  getCustomResponseModuleLoadError: vi.fn(() => null),
}));

vi.mock('../ResponseSwitcher', () => ({
  ResponseSwitcher: ({
    response, storedAnswer, answerFinalized, index, disabled, isDelayedDisabled, form, matrixRowFeedback,
  }: {
    response: { id: string; type: string };
    storedAnswer?: Record<string, unknown>;
    answerFinalized?: boolean;
    matrixRowFeedback?: Record<string, string>;
    index: number;
    disabled?: boolean;
    isDelayedDisabled?: boolean;
    form: { onChange?: (value: unknown, source?: 'keyboard' | 'click') => void };
  }) => {
    capturedSwitcherProps.storedAnswer = storedAnswer;
    capturedSwitcherProps.answerFinalized = answerFinalized;
    capturedSwitcherProps.matrixRowFeedback = matrixRowFeedback;
    capturedSwitcherProps.onChange = form.onChange;
    capturedSwitcherProps.indexes.push({
      id: response.id, index, disabled, isDelayedDisabled,
    });
    return (
      <div className="response" data-testid={`switcher-${response.type}`} data-response-id={response.id} data-index={index}>
        {response.type}
        <input data-testid={`control-${response.id}`} />
      </div>
    );
  },
}));

vi.mock('../FeedbackAlert', async (importOriginal) => ({
  ...await importOriginal<typeof FeedbackAlertModule>(),
  FeedbackAlert: ({ response, alertConfig }: { response: { id: string }; alertConfig: Record<string, { visible: boolean; title: string; message: string; hint?: string; showHelpTextLink?: boolean; fitHeight?: boolean }> }) => (
    alertConfig[response.id]?.visible ? (
      <div data-testid={`feedback-alert-${response.id}`} data-title={alertConfig[response.id].title} data-show-help-text-link={alertConfig[response.id].showHelpTextLink} data-fit-height={alertConfig[response.id].fitHeight}>
        {alertConfig[response.id].message}
        {alertConfig[response.id].hint && <p>{alertConfig[response.id].hint}</p>}
      </div>
    ) : null
  ),
}));

vi.mock('../../NextButton', () => ({
  NextButton: ({
    label, disabled, checkAnswer, onCheckAnswer, onNext,
  }: { label?: string; disabled?: boolean; checkAnswer?: ReactNode; onCheckAnswer?: () => void; onNext: () => void }) => {
    capturedNextButtonProps.onCheckAnswer = onCheckAnswer;
    return (
      <div>
        {checkAnswer}
        <button type="button" disabled={disabled} onClick={checkAnswer ? onNext : (onCheckAnswer ?? onNext)}>{label}</button>
      </div>
    );
  },
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

const baseConfig: IndividualComponent = {
  hideCheckAnswerButton: true,
  type: 'questionnaire',
  response: [
    {
      type: 'shortText', id: 'q1', prompt: 'Question 1', required: false,
    },
  ],
};

const storeConfig: StudyConfig = {
  $schema: '',
  studyMetadata: {
    title: 'Test',
    version: '1.0',
    authors: [],
    date: '2024-01-01',
    description: '',
    organizations: [],
  },
  uiConfig: {
    contactEmail: 'test@test.com',
    logoPath: '',
    withProgressBar: false,
    withSidebar: false,
    sidebarWidth: 0,
    studyEndMsg: '',
    windowEventDebounceTime: 100,
    showTitleBar: false,
  },
  components: {
    trial1: { type: 'markdown', path: 'trial1.md', response: [] },
  },
  sequence: {
    order: 'fixed',
    components: ['trial1'],
  },
};

const storeSequence: Sequence = {
  id: 'root',
  orderPath: 'root',
  order: 'fixed',
  components: ['trial1'],
  skip: [],
};

const modes: Record<REVISIT_MODE, boolean> = {
  dataCollectionEnabled: true,
  developmentModeEnabled: false,
  dataSharingEnabled: false,
};

const metadata = {
  userAgent: 'test-agent',
  resolution: { width: 1920, height: 1080 },
  language: 'en',
  ip: null,
};

type StudyStore = Awaited<ReturnType<typeof studyStoreCreator>>;

async function makeStudyStore(modesOverride: Partial<Record<REVISIT_MODE, boolean>> = {}, answers: Record<string, StoredAnswer> = {}): Promise<StudyStore> {
  return studyStoreCreator('test-study', storeConfig, storeSequence, metadata, answers, { ...modes, ...modesOverride }, 'p1', false, false);
}

function withStore(studyStore: StudyStore, ui: ReactNode) {
  return (
    <Provider store={studyStore.store}>
      <StudyStoreContext.Provider value={studyStore}>{ui}</StudyStoreContext.Provider>
    </Provider>
  );
}

async function renderWithStore(ui: ReactNode) {
  const studyStore = await makeStudyStore();
  const utils = render(withStore(studyStore, ui));
  return { ...utils, studyStore, store: studyStore.store };
}

function incorrectCount(store: StudyStore['store']) {
  return store.getState().answers.trial1_0?.incorrectAnswers?.q1?.value.length ?? 0;
}

function findButton(container: HTMLElement, label: string) {
  return Array.from(container.querySelectorAll('button')).find((b) => b.textContent === label)!;
}

function countButtons(container: HTMLElement, label: string) {
  return Array.from(container.querySelectorAll('button')).filter((b) => b.textContent === label).length;
}

// ── setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockAnswerField.values = { q1: 'correct' };
  vi.mocked(isEqual).mockReturnValue(true);
  mockStoredAnswerData.formOrder = { response: ['q1'] };
  mockStoredAnswerData.responseSubmitAttempted = undefined;
  mockStoredAnswerData.checkAnswer = undefined;
  capturedNextButtonProps.onCheckAnswer = undefined;
  capturedSwitcherProps.storedAnswer = undefined;
  capturedSwitcherProps.answerFinalized = undefined;
  capturedSwitcherProps.matrixRowFeedback = undefined;
  capturedSwitcherProps.onChange = undefined;
  capturedSwitcherProps.indexes = [];
  mockIsAnalysis.value = false;
  mockAllowFailedTraining.value = true;
  mockProvideFeedback.value = false;
  mockCurrentIdentifier.value = 'trial1_0';
  mockNavigate.mockClear();
  mockSaveAnswers.mockClear();
  mockShowNotification.mockClear();
  mockTrrackApply.mockClear();
  mockCustomResponseModule.value = null;
  mockAnswerField.setFieldValue.mockReset();
});

// Unmount between tests so window keydown listeners from prior renders don't leak
afterEach(() => cleanup());

// ── ResponseBlock ─────────────────────────────────────────────────────────────

describe('ResponseBlock', () => {
  test('shows partial correctness beneath a checkbox question', async () => {
    vi.mocked(isEqual).mockImplementation((left, right) => JSON.stringify(left) === JSON.stringify(right));
    const checkedAnswer = makeStoredAnswer({
      answer: { q1: ['A', 'C'] },
      checkAnswer: {
        attemptsUsed: 1,
        correct: false,
        responses: { q1: false },
        checkedAnswers: { q1: ['A', 'C'] },
      },
    });
    const config: IndividualComponent = {
      type: 'questionnaire',
      provideFeedback: true,
      response: [
        {
          id: 'q1', type: 'checkbox', prompt: 'Choose the correct options', options: ['A', 'B', 'C'],
        },
      ],
      correctAnswer: [{ id: 'q1', answer: ['A', 'B'] }],
    };
    const { container } = await renderWithStore(<ResponseBlock config={config} location="belowStimulus" status={checkedAnswer} />);

    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector('[data-testid="feedback-alert-q1"]')?.textContent).toContain('partially correct');
    expect(container.querySelector('[data-testid="feedback-alert-q1"]')?.getAttribute('data-title')).toBe('Partially Correct');
  });

  test('does not show answer totals before checking an enabled training page', async () => {
    const config: IndividualComponent = {
      type: 'questionnaire',
      provideFeedback: true,
      response: [{ id: 'q1', type: 'shortText', prompt: 'Answer' }],
      correctAnswer: [{ id: 'q1', answer: 'correct' }],
    };
    const { container } = await renderWithStore(<ResponseBlock config={config} location="belowStimulus" />);

    expect(container.querySelector('[data-testid="trial-answer-summary"]')).toBeNull();
  });

  test('does not show answer totals when feedback is disabled', async () => {
    mockStoredAnswerData.checkAnswer = { attemptsUsed: 1, correct: true, responses: { q1: true } };
    const config: IndividualComponent = {
      type: 'questionnaire',
      provideFeedback: false,
      response: [{ id: 'q1', type: 'shortText', prompt: 'Answer' }],
      correctAnswer: [{ id: 'q1', answer: 'correct' }],
    };
    const { container } = await renderWithStore(<ResponseBlock config={config} location="belowStimulus" />);

    expect(container.querySelector('[data-testid="trial-answer-summary"]')).toBeNull();
  });

  test('uses the canonical grading result for checkbox correctness', async () => {
    mockAnswerField.values = { q1: 'incorrect' };
    const checkedAnswer = makeStoredAnswer({
      answer: { q1: ['4'] },
      checkAnswer: {
        attemptsUsed: 1,
        correct: false,
        responses: { q1: false },
        checkedAnswers: { q1: ['4'] },
      },
    });
    const config: IndividualComponent = {
      type: 'questionnaire',
      provideFeedback: true,
      response: [{
        id: 'q1', type: 'checkbox', prompt: 'Select four', options: ['4'],
      }],
      correctAnswer: [{ id: 'q1', answer: [4] }],
    };
    const { container } = await renderWithStore(<ResponseBlock config={config} location="belowStimulus" status={checkedAnswer} />);

    expect(container.querySelector('[data-testid="feedback-alert-q1"]')?.getAttribute('data-title')).toBe('Incorrect Answer');
    expect(container.querySelector('[data-testid="trial-answer-summary"]')?.textContent).toBe('0 of 1 answers correct; 1 incorrect.');
  });

  test('shows incorrect feedback beneath a Likert question', async () => {
    mockStoredAnswerData.checkAnswer = { attemptsUsed: 1, correct: false, responses: { q1: false } };
    const config: IndividualComponent = {
      type: 'questionnaire',
      provideFeedback: true,
      response: [
        {
          id: 'q1', type: 'likert', prompt: 'Rate this', numItems: 5,
        },
      ],
      correctAnswer: [
        { id: 'q1', answer: 5 },
      ],
    };
    const { container } = await renderWithStore(<ResponseBlock config={config} location="belowStimulus" />);

    expect(container.querySelector('[role="status"]')?.textContent).toBe('incorrect');
  });

  test('shows partially correct overall feedback when all matrix rows are partial', async () => {
    const checkedAnswer = makeStoredAnswer({
      answer: { q1: { cat: 'A|C', dog: 'A|C' } },
      checkAnswer: { attemptsUsed: 1, correct: false, responses: { q1: false } },
    });
    const config: IndividualComponent = {
      type: 'questionnaire',
      provideFeedback: true,
      response: [
        {
          id: 'q1',
          type: 'matrix-checkbox',
          prompt: 'Select traits',
          answerOptions: ['A', 'B', 'C'],
          questionOptions: ['cat', 'dog'],
        },
      ],
      correctAnswer: [
        {
          id: 'q1',
          answer: [['A', 'B'], ['A', 'B']],
          feedback: { incorrectText: 'Review the selected traits.' },
        },
      ],
    };
    const { container } = await renderWithStore(<ResponseBlock config={config} location="belowStimulus" status={checkedAnswer} />);

    expect(container.querySelector('[data-testid="feedback-alert-q1"]')?.textContent).toContain('Review the selected traits.');
    expect(container.querySelector('[data-testid="feedback-alert-q1"]')?.getAttribute('data-title')).toBe('Partially Correct');
  });

  test('does not mark mixed matrix alternatives correct when the canonical check failed', async () => {
    mockStoredAnswerData.formOrder = { response: ['matrix'] };
    const checkedAnswer = makeStoredAnswer({
      answer: { matrix: { cat: 'A|B', dog: 'C|D' } },
      checkAnswer: {
        attemptsUsed: 1,
        correct: false,
        responses: { matrix: false },
        checkedAnswers: { matrix: { cat: 'A|B', dog: 'C|D' } },
      },
    });
    const config: IndividualComponent = {
      type: 'questionnaire',
      provideFeedback: true,
      response: [{
        id: 'matrix',
        type: 'matrix-checkbox',
        prompt: 'Select traits',
        answerOptions: ['A', 'B', 'C', 'D'],
        questionOptions: ['cat', 'dog'],
      }],
      correctAnswer: [{
        id: 'matrix',
        answer: [['A', 'B'], ['A', 'B']],
        acceptableAnswers: [[['C', 'D'], ['C', 'D']]],
      }],
    };
    const { container } = await renderWithStore(<ResponseBlock config={config} location="belowStimulus" status={checkedAnswer} />);
    const alert = container.querySelector('[data-testid="feedback-alert-matrix"]');

    expect(alert?.getAttribute('data-title')).toBe('Partially Correct');
    expect(alert?.getAttribute('data-title')).not.toBe('Correct Answer');
  });

  test.each([
    {
      score: 1, correct: true, title: 'Correct Answer', nativeAnswer: 'B',
    },
    {
      score: 0, correct: false, title: 'Incorrect Answer', nativeAnswer: 'A',
    },
    {
      score: 0.5, correct: false, title: 'Partially Correct', nativeAnswer: 'A',
    },
  ])('matrix feedback follows custom score $score instead of native answer matching', async ({
    score, correct, title, nativeAnswer,
  }) => {
    const answer = { q1: { row: 'A' } };
    const status = makeStoredAnswer({
      answer,
      checkAnswer: {
        attemptsUsed: 1,
        correct,
        responses: { q1: correct },
        scores: { q1: score },
        checkedAnswers: answer,
        answerSnapshot: answer,
      },
    });
    const config: IndividualComponent = {
      type: 'questionnaire',
      provideFeedback: true,
      response: [{
        id: 'q1',
        type: 'matrix-checkbox',
        prompt: 'Matrix',
        questionOptions: ['row'],
        answerOptions: ['A', 'B'],
        path: 'test-response-functions/assets/ContextAwareScore.response.ts',
      }],
      correctAnswer: [{ id: 'q1', answer: [[nativeAnswer]] }],
    };
    const { container } = await renderWithStore(<ResponseBlock config={config} location="belowStimulus" status={status} />);

    expect(container.querySelector('[data-testid="feedback-alert-q1"]')?.getAttribute('data-title')).toBe(title);
    expect(capturedSwitcherProps.matrixRowFeedback).toBeUndefined();
  });

  test('keeps checkbox feedback frozen until the next check', async () => {
    vi.mocked(isEqual).mockImplementation((left, right) => JSON.stringify(left) === JSON.stringify(right));
    const checkedAnswer = makeStoredAnswer({
      answer: { q1: ['A'] },
      checkAnswer: {
        attemptsUsed: 1,
        correct: false,
        responses: { q1: false },
        checkedAnswers: { q1: ['A'] },
      },
    });
    const config: IndividualComponent = {
      type: 'questionnaire',
      provideFeedback: true,
      response: [
        {
          id: 'q1', type: 'checkbox', prompt: 'Choose the correct options', options: ['A', 'B', 'C'],
        },
      ],
      correctAnswer: [{ id: 'q1', answer: ['A', 'B'] }],
    };
    mockAnswerField.values = { q1: ['A'] };
    const {
      container, rerender, studyStore, store,
    } = await renderWithStore(
      <ResponseBlock config={config} location="belowStimulus" status={checkedAnswer} />,
    );
    expect(container.querySelector('[data-testid="feedback-alert-q1"]')?.getAttribute('data-title')).toBe('Partially Correct');

    mockAnswerField.setFieldValue.mockImplementation((id: string, value: unknown) => {
      mockAnswerField.values = { ...mockAnswerField.values, [id]: value };
    });
    act(() => { capturedSwitcherProps.onChange?.(['C']); });
    await act(async () => {
      rerender(withStore(studyStore, <ResponseBlock config={config} location="belowStimulus" status={checkedAnswer} />));
    });
    expect(container.querySelector('[data-testid="feedback-alert-q1"]')?.getAttribute('data-title')).toBe('Partially Correct');

    await act(async () => { capturedNextButtonProps.onCheckAnswer?.(); });
    expect(store.getState().checkAnswer.trial1_0.checkedAnswers).toEqual({ q1: ['C'] });
    expect(container.querySelector('[data-testid="feedback-alert-q1"]')?.getAttribute('data-title')).toBe('Incorrect Answer');
  });

  test('records the interaction source of a mapped button answer', async () => {
    const { rerender, studyStore } = await renderWithStore(<ResponseBlock config={baseConfig} location="belowStimulus" />);
    mockTrrackApply.mockClear();
    mockAnswerField.setFieldValue.mockImplementation((id: string, value: unknown) => {
      mockAnswerField.values = { ...mockAnswerField.values, [id]: value };
    });

    act(() => { capturedSwitcherProps.onChange?.('A', 'keyboard'); });
    rerender(withStore(studyStore, <ResponseBlock config={baseConfig} location="belowStimulus" />));

    expect(mockAnswerField.setFieldValue).toHaveBeenCalledWith('q1', 'A');
    expect(mockTrrackApply).toHaveBeenCalledWith('Update form field (keyboard)', undefined);
  });

  test('renders without error', async () => {
    const studyStore = await makeStudyStore();
    const { container } = render(withStore(studyStore, <ResponseBlock config={baseConfig} location="belowStimulus" />));
    const html = container.innerHTML;
    expect(html).toContain('<div');
  });

  test('renders ResponseSwitcher for response at matching location', async () => {
    const studyStore = await makeStudyStore();
    const { container } = render(withStore(studyStore, <ResponseBlock config={baseConfig} location="belowStimulus" />));
    const html = container.innerHTML;
    expect(html).toContain('switcher-shortText');
  });

  test('uses configured response order when a legacy answer has no formOrder', async () => {
    mockStoredAnswerData.formOrder = undefined;
    const studyStore = await makeStudyStore();
    const { container } = render(withStore(studyStore, <ResponseBlock config={baseConfig} location="belowStimulus" />));

    expect(container.querySelector('[data-response-id="q1"]')).not.toBeNull();
  });

  test('preserves persisted randomized response order', async () => {
    mockStoredAnswerData.formOrder = { response: ['q2', 'q1'] };
    const config = {
      ...baseConfig,
      response: [
        ...baseConfig.response!,
        {
          type: 'shortText', id: 'q2', prompt: 'Question 2', required: false,
        },
      ],
    } as IndividualComponent;
    const studyStore = await makeStudyStore();
    const { container } = render(withStore(studyStore, <ResponseBlock config={config} location="belowStimulus" />));

    expect(Array.from(container.querySelectorAll('[data-response-id]')).map((element) => element.getAttribute('data-response-id'))).toEqual(['q2', 'q1']);
  });

  test('shows NextButton when location matches nextButtonLocation', async () => {
    const studyStore = await makeStudyStore();
    const { container } = render(withStore(studyStore, <ResponseBlock config={baseConfig} location="belowStimulus" />));
    const html = container.innerHTML;
    expect(html).toContain('Next');
  });

  test('omits NextButton when location does not match nextButtonLocation', async () => {
    const studyStore = await makeStudyStore();
    const { container } = render(withStore(studyStore, <ResponseBlock config={baseConfig} location="sidebar" />));
    const html = container.innerHTML;
    expect(html).not.toContain('Next');
  });

  test('skips ResponseSwitcher when response is hidden', async () => {
    const hiddenConfig = {
      ...baseConfig,
      response: [
        {
          type: 'shortText', id: 'q1', prompt: 'Q1', required: false, hidden: true,
        },
      ],
    } as IndividualComponent;
    const studyStore = await makeStudyStore();
    const { container } = render(withStore(studyStore, <ResponseBlock config={hiddenConfig} location="belowStimulus" />));
    const html = container.innerHTML;
    expect(html).not.toContain('switcher-shortText');
  });

  test('renders with provided style prop without error', async () => {
    const studyStore = await makeStudyStore();
    const { container } = render(withStore(studyStore, <ResponseBlock config={baseConfig} location="belowStimulus" style={{ color: 'red' }} />));
    const html = container.innerHTML;
    expect(html).toContain('switcher-shortText');
  });

  test('uses custom nextButtonText from config', async () => {
    const configWithText = {
      ...baseConfig,
      nextButtonText: 'Submit',
    } as IndividualComponent;
    const studyStore = await makeStudyStore();
    const { container } = render(withStore(studyStore, <ResponseBlock config={configWithText} location="belowStimulus" />));
    const html = container.innerHTML;
    expect(html).toContain('Submit');
  });

  test('uses only Next when hideCheckAnswerButton is true', async () => {
    const configWithFeedback = {
      ...baseConfig,
      provideFeedback: true,
      correctAnswer: [{ id: 'q1', answer: 'correct' }],
    } as IndividualComponent;
    const studyStore = await makeStudyStore();
    const { container } = render(withStore(studyStore, <ResponseBlock config={configWithFeedback} location="belowStimulus" />));
    const html = container.innerHTML;
    expect(html).not.toContain('Check Answer');
    expect(findButton(container, 'Next')).toHaveProperty('disabled', false);
  });

  test('does not add required=true for textOnly responses', async () => {
    const textOnlyConfig = {
      type: 'questionnaire',
      response: [{ type: 'textOnly', id: 'q1', prompt: 'Read this.' }],
    } as IndividualComponent;
    const studyStore = await makeStudyStore();
    const { container } = render(withStore(studyStore, <ResponseBlock config={textOnlyConfig} location="belowStimulus" />));
    const html = container.innerHTML;
    expect(html).toContain('switcher-textOnly');
  });

  test('does not count section dividers as questions', async () => {
    mockStoredAnswerData.formOrder = undefined;
    const config = {
      type: 'questionnaire',
      response: [
        {
          type: 'shortText', id: 'first', prompt: 'First', required: false,
        },
        { type: 'divider', id: 'section-break' },
        {
          type: 'shortText', id: 'second', prompt: 'Second', required: false,
        },
      ],
    } as IndividualComponent;
    const { container } = await renderWithStore(<ResponseBlock config={config} location="belowStimulus" />);
    expect(container.querySelector('[data-response-id="first"]')?.getAttribute('data-index')).toBe('1');
    expect(container.querySelector('[data-response-id="second"]')?.getAttribute('data-index')).toBe('2');
  });

  test('initialises from status.answer when status prop is provided', async () => {
    const status = makeStoredAnswer({ answer: { q1: 'hello' } });
    // render (not SSR) so useEffect fires and reads status.answer
    const { container } = await renderWithStore(
      <ResponseBlock config={baseConfig} location="belowStimulus" status={status} />,
    );
    expect(container.querySelector('div')).toBeTruthy();
  });

  test('passes answerFinalized to ResponseSwitcher when the trial is finished', async () => {
    const status = makeStoredAnswer({ answer: { q1: 'hello' }, endTime: 100 });
    await renderWithStore(<ResponseBlock config={baseConfig} location="belowStimulus" status={status} />);
    expect(capturedSwitcherProps.storedAnswer).toEqual({ q1: 'hello' });
    expect(capturedSwitcherProps.answerFinalized).toBe(true);
  });

  test('passes answerFinalized=false to ResponseSwitcher while the trial is in progress', async () => {
    const status = makeStoredAnswer({ answer: { q1: 'hello' }, endTime: -1 });
    await renderWithStore(<ResponseBlock config={baseConfig} location="belowStimulus" status={status} />);
    expect(capturedSwitcherProps.storedAnswer).toEqual({ q1: 'hello' });
    expect(capturedSwitcherProps.answerFinalized).toBe(false);
  });

  test('clicking Next grades and shows feedback before advancing', async () => {
    const configWithFeedback = {
      ...baseConfig,
      provideFeedback: true,
      correctAnswer: [{ id: 'q1', answer: 'correct' }],
    } as IndividualComponent;
    const { container } = await renderWithStore(
      <ResponseBlock config={configWithFeedback} location="belowStimulus" />,
    );
    const checkBtn = findButton(container, 'Next');
    await act(async () => { fireEvent.click(checkBtn); });
    // A successful check unlocks the next click for continuing.
    expect(checkBtn).toHaveProperty('disabled', false);
    expect(capturedSwitcherProps.indexes.at(-1)).toMatchObject({
      id: 'q1', disabled: true, isDelayedDisabled: false,
    });
  });

  test('passes timer state to the response without adding a wrapper around it', async () => {
    const delayedConfig = {
      ...baseConfig,
      response: [
        {
          type: 'shortText',
          id: 'q1',
          prompt: 'Delayed Question',
          required: false,
          delay: 5000,
        },
      ],
    } as IndividualComponent;

    const studyStore = await makeStudyStore();
    const { container } = render(withStore(studyStore, <ResponseBlock config={delayedConfig} location="belowStimulus" />));

    const questionBlock = container.querySelector('[data-question-id="q1"]');
    expect(questionBlock).not.toBeNull();
    expect(questionBlock?.querySelector('.response')?.parentElement).toBe(questionBlock);
    expect(capturedSwitcherProps.indexes[0]).toEqual({
      id: 'q1', index: 1, disabled: false, isDelayedDisabled: true,
    });
  });

  test('keeps sequential indices across dividers and enumeration restart settings', async () => {
    const mixedConfig = {
      ...baseConfig,
      response: [
        {
          type: 'shortText',
          id: 'q1',
          prompt: 'Immediate Question',
          required: false,
        },
        {
          type: 'divider',
          id: 'd1',
        },
        {
          type: 'shortText',
          id: 'q2',
          prompt: 'Second Question',
          required: false,
        },
        {
          type: 'textOnly',
          id: 'instructions-no-restart',
          prompt: 'Continue enumeration',
          restartEnumeration: false,
        },
        {
          type: 'shortText',
          id: 'q3',
          prompt: 'Third Question',
          required: false,
        },
        {
          type: 'textOnly',
          id: 'instructions-restart',
          prompt: 'Restart enumeration',
          restartEnumeration: true,
        },
        {
          type: 'shortText',
          id: 'q4',
          prompt: 'Fourth Question',
          required: false,
        },
      ],
    } as IndividualComponent;

    mockStoredAnswerData.formOrder = {
      response: ['q1', 'd1', 'q2', 'instructions-no-restart', 'q3', 'instructions-restart', 'q4'],
    };
    const studyStore = await makeStudyStore();
    render(withStore(studyStore, <ResponseBlock config={mixedConfig} location="belowStimulus" />));

    const responseIndexes = Array.from(new Map(
      capturedSwitcherProps.indexes
        .filter(({ id }) => ['q1', 'q2', 'q3', 'q4'].includes(id))
        .map(({ id, index }) => [id, index]),
    ));
    expect(responseIndexes).toEqual([
      ['q1', 1],
      ['q2', 2],
      ['q3', 3],
      ['q4', 1],
    ]);
    expect(capturedSwitcherProps.indexes.every(({ isDelayedDisabled }) => !isDelayedDisabled)).toBe(true);
  });
});

// ── focus recovery on validation errors ──────────────────────────────────────

describe('ResponseBlock focus recovery', () => {
  // Stub browser APIs missing in jsdom that are used by the focus/scroll logic
  const scrollSpy = vi.fn();
  let originalScrollIntoView: typeof HTMLElement.prototype.scrollIntoView;
  beforeEach(() => {
    vi.stubGlobal('CSS', { escape: (s: string) => s });
    scrollSpy.mockClear();
    originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    window.HTMLElement.prototype.scrollIntoView = scrollSpy;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  test('revealing unanswered errors scrolls to and focuses the first unresolved question', async () => {
    mockStoredAnswerData.responseSubmitAttempted = true;
    const requiredConfig = {
      type: 'questionnaire',
      response: [
        {
          type: 'shortText', id: 'q1', prompt: 'Q1', required: true,
        },
      ],
    } as IndividualComponent;
    const { container } = await renderWithStore(
      <ResponseBlock config={requiredConfig} location="belowStimulus" />,
    );
    expect(scrollSpy).toHaveBeenCalled();
    const control = container.querySelector('[data-question-id="q1"] input');
    expect(control).toBeTruthy();
    expect(document.activeElement).toBe(control);
  });

  test('does not move focus while there are no validation errors', async () => {
    const requiredConfig = {
      type: 'questionnaire',
      response: [
        {
          type: 'shortText', id: 'q1', prompt: 'Q1', required: true,
        },
      ],
    } as IndividualComponent;
    await renderWithStore(<ResponseBlock config={requiredConfig} location="belowStimulus" />);
    expect(scrollSpy).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.body);
  });
});

// ── Check Answer via keyboard ─────────────────────────────────────────────────

describe('ResponseBlock onCheckAnswer', () => {
  test('shows a configuration error instead of recording an invalid score', async () => {
    mockAnswerField.values = { customGuess: { score: 5 } };
    mockStoredAnswerData.formOrder = { response: ['customGuess'] };
    mockCustomResponseModule.value = {
      default: () => null,
      score: () => 1.5,
    };
    const config: IndividualComponent = {
      ...baseConfig,
      provideFeedback: true,
      response: [{
        id: 'customGuess', type: 'custom', prompt: '', path: 'missing-custom-score.tsx', required: false,
      }],
      correctAnswer: [{ id: 'customGuess', answer: { score: 10 } }],
    };

    const { store } = await renderWithStore(<ResponseBlock config={config} location="belowStimulus" />);
    await act(async () => { capturedNextButtonProps.onCheckAnswer?.(); });

    expect(store.getState().checkAnswer.trial1_0).toBeUndefined();
    expect(mockShowNotification).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Unable to Check Answer',
      color: 'red',
    }));
    mockCustomResponseModule.value = null;
  });

  test('does not equality-grade a response when its custom module is unavailable', async () => {
    mockAnswerField.values = { customGuess: { score: 10 } };
    mockStoredAnswerData.formOrder = { response: ['customGuess'] };
    mockCustomResponseModule.value = null;
    const config: IndividualComponent = {
      ...baseConfig,
      provideFeedback: true,
      response: [{
        id: 'customGuess', type: 'custom', prompt: '', path: 'missing-custom-score.tsx', required: false,
      }],
      correctAnswer: [{ id: 'customGuess', answer: { score: 10 } }],
    };

    const { store } = await renderWithStore(<ResponseBlock config={config} location="belowStimulus" />);
    await act(async () => { capturedNextButtonProps.onCheckAnswer?.(); });

    expect(store.getState().checkAnswer.trial1_0).toBeUndefined();
    expect(mockShowNotification).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Unable to Check Answer',
      color: 'red',
    }));
  });

  test('scores with the persisted answer values', async () => {
    mockAnswerField.values = { customGuess: { score: 5 }, choice: 'A', 'choice-other': '' };
    mockStoredAnswerData.formOrder = { response: ['customGuess', 'choice'] };
    mockCustomResponseModule.value = {
      default: () => null,
      score: (value, values, _response, expected) => {
        if (expected === undefined) return null;
        const otherValue = values && typeof values === 'object' && 'choice-other' in values ? 0.25 : 0.5;
        return ((value as { score: number }).score / (expected as { score: number }).score) * otherValue;
      },
    };
    const customScoredConfig: IndividualComponent = {
      ...baseConfig,
      provideFeedback: true,
      response: [{
        id: 'customGuess', type: 'custom', prompt: 'Custom score', path: 'test-response-functions/assets/CustomPartialScore.tsx', required: false,
      }, {
        id: 'choice', type: 'radio', prompt: 'Choice', options: ['A', 'other'], withOther: true,
      }],
      correctAnswer: [{ id: 'customGuess', answer: { score: 10 } }],
    };

    const { store } = await renderWithStore(<ResponseBlock config={customScoredConfig} location="belowStimulus" />);
    await act(async () => { capturedNextButtonProps.onCheckAnswer?.(); });
    expect(store.getState().checkAnswer.trial1_0).toMatchObject({
      correct: false,
      scores: { customGuess: 0.25 },
      answerSnapshot: { customGuess: { score: 5 }, choice: 'A' },
    });
    mockCustomResponseModule.value = null;
  });

  test('includes scorer-only responses in Check Answer component correctness', async () => {
    mockAnswerField.values = { q1: 'correct', customScore: 6 };
    mockStoredAnswerData.formOrder = { response: ['q1', 'customScore'] };
    mockCustomResponseModule.value = {
      default: () => null,
      score: (value) => (value as number) / 10,
    };
    const config: IndividualComponent = {
      ...baseConfig,
      provideFeedback: true,
      hideCheckAnswerButton: false,
      response: [{
        id: 'q1', type: 'shortText', prompt: 'Answer', required: true,
      }, {
        id: 'customScore',
        type: 'custom',
        prompt: 'Scored answer',
        required: true,
        path: 'test-response-functions/assets/CustomPartialScore.tsx',
      }],
      correctAnswer: [{ id: 'q1', answer: 'correct' }],
    };

    const { container, store } = await renderWithStore(<ResponseBlock config={config} location="belowStimulus" />);
    await act(async () => { capturedNextButtonProps.onCheckAnswer?.(); });

    expect(store.getState().checkAnswer.trial1_0).toMatchObject({
      correct: false,
      responses: { q1: true, customScore: false },
      scores: { customScore: 0.6 },
    });
    expect(findButton(container, 'Next')).toHaveProperty('disabled', true);
    mockCustomResponseModule.value = null;
  });

  test.each([0, 0.5, 1])('records failed scorer-only attempts once per check (score=%s)', async (score) => {
    mockAnswerField.values = { q1: 'incorrect', customScore: 5 };
    mockStoredAnswerData.formOrder = { response: ['q1', 'customScore'] };
    mockCustomResponseModule.value = { default: () => null, score: () => score };
    const config: IndividualComponent = {
      ...baseConfig,
      provideFeedback: true,
      response: [
        { id: 'q1', type: 'shortText', prompt: 'Expected answer' },
        {
          id: 'customScore', type: 'custom', prompt: 'Scored answer', path: 'test-response-functions/assets/CustomPartialScore.tsx',
        },
      ],
      correctAnswer: [{ id: 'q1', answer: 'correct' }],
    };
    const { store } = await renderWithStore(<ResponseBlock config={config} location="belowStimulus" />);
    await act(async () => { capturedNextButtonProps.onCheckAnswer?.(); });
    await act(async () => { capturedNextButtonProps.onCheckAnswer?.(); });

    const history = store.getState().answers.trial1_0.incorrectAnswers;
    expect(history.q1.value).toEqual(['incorrect', 'incorrect']);
    if (score < 1) expect(history.customScore.value).toEqual([5, 5]);
    else expect(history.customScore).toBeUndefined();
    expect(store.getState().checkAnswer.trial1_0.attemptsUsed).toBe(2);
  });

  test('enables Check Answer training for a scorer-only component', async () => {
    mockAnswerField.values = { customScore: 10 };
    mockStoredAnswerData.formOrder = { response: ['customScore'] };
    mockCustomResponseModule.value = {
      default: () => null,
      score: (value) => (value as number) / 10,
    };
    const config: IndividualComponent = {
      ...baseConfig,
      provideFeedback: true,
      allowFailedTraining: false,
      response: [{
        id: 'customScore',
        type: 'custom',
        prompt: 'Scored answer',
        required: true,
        path: 'test-response-functions/assets/CustomPartialScore.tsx',
      }],
    };

    const { container, store } = await renderWithStore(<ResponseBlock config={config} location="belowStimulus" />);
    expect(capturedNextButtonProps.onCheckAnswer).toBeDefined();
    await act(async () => { capturedNextButtonProps.onCheckAnswer?.(); });

    expect(store.getState().checkAnswer.trial1_0).toMatchObject({ correct: true, scores: { customScore: 1 } });
    expect(findButton(container, 'Next')).toHaveProperty('disabled', false);
    mockCustomResponseModule.value = null;
  });

  test('does not pass Check Answer when a required scorer returns no grade', async () => {
    mockAnswerField.values = { customScore: 5 };
    mockStoredAnswerData.formOrder = { response: ['customScore'] };
    mockCustomResponseModule.value = {
      default: () => null,
      score: () => null,
    };
    const config: IndividualComponent = {
      ...baseConfig,
      provideFeedback: true,
      hideCheckAnswerButton: false,
      allowFailedTraining: false,
      response: [{
        id: 'customScore',
        type: 'custom',
        prompt: 'Scored answer',
        required: true,
        path: 'test-response-functions/assets/CustomPartialScore.tsx',
      }],
    };

    const { container, store } = await renderWithStore(<ResponseBlock config={config} location="belowStimulus" />);
    await act(async () => { capturedNextButtonProps.onCheckAnswer?.(); });

    expect(store.getState().checkAnswer.trial1_0).toMatchObject({
      correct: false,
      responses: { customScore: false },
    });
    expect(findButton(container, 'Next')).toHaveProperty('disabled', true);
    mockCustomResponseModule.value = null;
  });

  test('a required scorer-only response with I do not know ignores its populated default in Check Answer', async () => {
    mockAnswerField.values = { q1: 'correct', customScore: 10, 'customScore-dontKnow': true };
    mockStoredAnswerData.formOrder = { response: ['q1', 'customScore'] };
    mockCustomResponseModule.value = {
      default: () => null,
      score: (value) => (value as number) / 10,
    };
    const config: IndividualComponent = {
      ...baseConfig,
      provideFeedback: true,
      hideCheckAnswerButton: false,
      allowFailedTraining: false,
      response: [{
        id: 'q1', type: 'shortText', prompt: 'Answer', required: true,
      }, {
        id: 'customScore',
        type: 'custom',
        prompt: 'Scored answer',
        required: true,
        withDontKnow: true,
        path: 'test-response-functions/assets/CustomPartialScore.tsx',
      }],
      correctAnswer: [{ id: 'q1', answer: 'correct' }],
    };

    const { container, store } = await renderWithStore(<ResponseBlock config={config} location="belowStimulus" />);
    await act(async () => { capturedNextButtonProps.onCheckAnswer?.(); });

    expect(store.getState().checkAnswer.trial1_0).toMatchObject({
      correct: false,
      responses: { q1: true, customScore: false },
    });
    expect(findButton(container, 'Next')).toHaveProperty('disabled', true);
    mockCustomResponseModule.value = null;
  });

  test('does not let a valid validation-only response block a correct Check Answer', async () => {
    mockAnswerField.values = { q1: 'correct', even: 4 };
    mockStoredAnswerData.formOrder = { response: ['q1', 'even'] };
    const config: IndividualComponent = {
      ...baseConfig,
      provideFeedback: true,
      allowFailedTraining: false,
      response: [
        {
          id: 'q1', type: 'shortText', prompt: 'Answer', required: true,
        },
        {
          id: 'even', type: 'numerical', prompt: 'Even number', required: true, path: 'test-response-functions/assets/EvenNumber.response.ts',
        },
      ],
      correctAnswer: [{ id: 'q1', answer: 'correct' }],
    };

    const { store } = await renderWithStore(<ResponseBlock config={config} location="belowStimulus" />);
    await act(async () => { capturedNextButtonProps.onCheckAnswer?.(); });

    expect(store.getState().checkAnswer.trial1_0).toMatchObject({
      correct: true,
      responses: { q1: true },
    });
  });

  test('ignores unanswered optional expected responses when checking correctness', async () => {
    mockAnswerField.values = { q1: 'correct', optional: '' };
    mockStoredAnswerData.formOrder = { response: ['q1', 'optional'] };
    const config: IndividualComponent = {
      ...baseConfig,
      provideFeedback: true,
      response: [
        {
          id: 'q1', type: 'shortText', prompt: 'Required', required: true,
        },
        {
          id: 'optional', type: 'shortText', prompt: 'Optional', required: false,
        },
      ],
      correctAnswer: [{ id: 'q1', answer: 'correct' }, { id: 'optional', answer: 'also correct' }],
    };

    const { store } = await renderWithStore(<ResponseBlock config={config} location="belowStimulus" />);
    await act(async () => { capturedNextButtonProps.onCheckAnswer?.(); });

    expect(store.getState().checkAnswer.trial1_0).toMatchObject({
      correct: true,
      responses: { q1: true },
    });
  });

  test('does not let a zero threshold grade a required unanswered answer as correct', async () => {
    mockAnswerField.values = { q1: '', 'q1-dontKnow': true };
    const config: IndividualComponent = {
      ...baseConfig,
      provideFeedback: true,
      response: [{
        id: 'q1', type: 'numerical', prompt: 'Number', required: true, withDontKnow: true,
      }],
      correctAnswer: [{ id: 'q1', answer: 10, correctnessThreshold: 0 }],
    };

    const { store } = await renderWithStore(<ResponseBlock config={config} location="belowStimulus" />);
    await act(async () => { capturedNextButtonProps.onCheckAnswer?.(); });

    expect(store.getState().checkAnswer.trial1_0).toMatchObject({
      correct: false,
      responses: { q1: false },
    });
  });

  test('stores partial scores and shows the percentage while keeping Next disabled', async () => {
    mockAnswerField.values = { q1: 5 };
    const scoredConfig: IndividualComponent = {
      ...baseConfig,
      provideFeedback: true,
      hideCheckAnswerButton: false,
      allowFailedTraining: false,
      response: [{
        id: 'q1', type: 'numerical', prompt: 'Score', required: false, path: 'test-response-functions/assets/PartialScore.response.ts',
      }],
      correctAnswer: [{ id: 'q1', answer: 10, feedback: { incorrectText: 'Aim higher.', hints: ['Try a larger number.'] } }],
    };
    const { container, store } = await renderWithStore(<ResponseBlock config={scoredConfig} location="belowStimulus" />);
    await act(async () => { capturedNextButtonProps.onCheckAnswer?.(); });
    expect(store.getState().checkAnswer.trial1_0).toMatchObject({
      correct: false, scores: { q1: 0.5 }, answerSnapshot: { q1: 5 },
    });
    expect(container.querySelector('[data-testid="feedback-alert-q1"]')?.textContent).toContain('50%');
    expect(container.textContent).toContain('Aim higher.');
    expect(container.textContent).toContain('Try a larger number.');
    expect(findButton(container, 'Next')).toHaveProperty('disabled', true);
  });

  test('treats a score of 80% as correct for participant feedback when configured', async () => {
    mockAnswerField.values = { q1: 7 };
    const scoredConfig: IndividualComponent = {
      ...baseConfig,
      provideFeedback: true,
      allowFailedTraining: false,
      response: [{
        id: 'q1',
        type: 'slider',
        prompt: 'Score',
        options: [],
        required: false,
        path: 'test-response-functions/assets/SliderScore.ts',
      }],
      correctAnswer: [{ id: 'q1', answer: 10, correctnessThreshold: 0.8 }],
    };
    const { container, store } = await renderWithStore(<ResponseBlock config={scoredConfig} location="belowStimulus" />);
    await act(async () => { capturedNextButtonProps.onCheckAnswer?.(); });
    expect(store.getState().checkAnswer.trial1_0).toMatchObject({ correct: true, responses: { q1: true }, scores: { q1: 0.8 } });
    expect(findButton(container, 'Next')).toHaveProperty('disabled', false);
  });

  const feedbackEnterConfig = {
    ...baseConfig,
    nextOnEnter: true,
    provideFeedback: true,
    correctAnswer: [{ id: 'q1', answer: 'correct' }],
  } as IndividualComponent;

  test('passes onCheckAnswer to NextButton and grades once when called', async () => {
    mockAnswerField.values = { q1: 'incorrect' };
    const { container, store } = await renderWithStore(
      <>
        <ResponseBlock config={feedbackEnterConfig} location="aboveStimulus" />
        <ResponseBlock config={feedbackEnterConfig} location="belowStimulus" />
        <ResponseBlock config={feedbackEnterConfig} location="sidebar" />
      </>,
    );
    expect(countButtons(container, 'Next')).toBe(1);
    expect(capturedNextButtonProps.onCheckAnswer).toBeDefined();
    await act(async () => { capturedNextButtonProps.onCheckAnswer?.(); });
    expect(container.querySelectorAll('[data-testid="feedback-alert-q1"]')).toHaveLength(1);
    expect(incorrectCount(store)).toBe(1);
    expect(store.getState().checkAnswer.trial1_0.attemptsUsed).toBe(1);
  });

  test('does not pass onCheckAnswer when location does not match nextButtonLocation', async () => {
    const { container } = await renderWithStore(
      <ResponseBlock config={feedbackEnterConfig} location="sidebar" />,
    );
    expect(countButtons(container, 'Next')).toBe(0);
    expect(capturedNextButtonProps.onCheckAnswer).toBeUndefined();
  });

  test('unlocks continuing after all attempts when failed training is allowed', async () => {
    // uiConfig mock sets trainingAttempts: 2
    mockAnswerField.values = { q1: 'incorrect' };
    const { container, store } = await renderWithStore(<ResponseBlock config={feedbackEnterConfig} location="belowStimulus" />);
    await act(async () => { capturedNextButtonProps.onCheckAnswer?.(); });
    await act(async () => { capturedNextButtonProps.onCheckAnswer?.(); });
    expect(store.getState().checkAnswer.trial1_0.attemptsUsed).toBe(2);
    expect(capturedNextButtonProps.onCheckAnswer).toBeUndefined();
    expect(findButton(container, 'Next')).toHaveProperty('disabled', false);
    expect(incorrectCount(store)).toBe(2);
  });

  test('does not pass onCheckAnswer after a correct answer', async () => {
    mockAnswerField.values = { q1: 'correct' };
    const { container, store } = await renderWithStore(
      <ResponseBlock config={feedbackEnterConfig} location="belowStimulus" />,
    );
    await act(async () => { capturedNextButtonProps.onCheckAnswer?.(); });
    const checkBtn = findButton(container, 'Next');
    expect(checkBtn).toHaveProperty('disabled', false);
    expect(capturedNextButtonProps.onCheckAnswer).toBeUndefined();
    expect(container.querySelectorAll('[data-testid="feedback-alert-q1"]')).toHaveLength(1);
    expect(store.getState().checkAnswer.trial1_0.attemptsUsed).toBe(1);
  });

  test('does not pass onCheckAnswer in analysis mode', async () => {
    mockIsAnalysis.value = true;
    const { container } = await renderWithStore(
      <ResponseBlock config={feedbackEnterConfig} location="belowStimulus" />,
    );
    expect(countButtons(container, 'Next')).toBe(1);
    expect(capturedNextButtonProps.onCheckAnswer).toBeUndefined();
  });

  test('does not pass onCheckAnswer when there is no correct answer feedback', async () => {
    const { container } = await renderWithStore(
      <ResponseBlock config={{ ...baseConfig, nextOnEnter: true } as IndividualComponent} location="belowStimulus" />,
    );
    expect(countButtons(container, 'Next')).toBe(1);
    expect(capturedNextButtonProps.onCheckAnswer).toBeUndefined();
  });
});

describe('ResponseBlock feedback on Next', () => {
  const answerFeedbackConfig: IndividualComponent = {
    ...baseConfig,
    correctAnswer: [{ id: 'q1', answer: 'correct', feedback: { correctText: 'Well done!', incorrectText: 'Try again.' } }],
  };

  test.each([undefined, false])('shows Check Answer by default with hideCheckAnswerButton=%s', async (hideCheckAnswerButton) => {
    mockAnswerField.values = { q1: 'incorrect' };
    const {
      container, store, rerender, studyStore,
    } = await renderWithStore(
      <ResponseBlock config={{ ...answerFeedbackConfig, hideCheckAnswerButton }} location="belowStimulus" />,
    );
    expect(findButton(container, 'Next')).toHaveProperty('disabled', true);
    await act(async () => { fireEvent.click(findButton(container, 'Check Answer')); });
    expect(findButton(container, 'Next')).toHaveProperty('disabled', true);
    expect(container.textContent).toContain('Try again.');
    mockAnswerField.values = { q1: 'correct' };
    await act(async () => { rerender(withStore(studyStore, <ResponseBlock config={{ ...answerFeedbackConfig, hideCheckAnswerButton }} location="belowStimulus" />)); });
    await act(async () => { fireEvent.click(findButton(container, 'Check Answer')); });
    expect(store.getState().checkAnswer.trial1_0).toMatchObject({ attemptsUsed: 2, correct: true });
    expect(findButton(container, 'Check Answer')).toHaveProperty('disabled', true);
    expect(findButton(container, 'Next')).toHaveProperty('disabled', false);
    expect(mockNavigate).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(findButton(container, 'Next')); });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  test('passes configured matrix row IDs through the live Check Answer grading path', async () => {
    mockStoredAnswerData.formOrder = undefined;
    mockAnswerField.values = { matrix: { 10: 'A', 2: 'B' } };
    const config: IndividualComponent = {
      ...baseConfig,
      provideFeedback: true,
      response: [{
        id: 'matrix', type: 'matrix-checkbox', prompt: '', questionOptions: ['10', '2'], answerOptions: ['A', 'B'],
      }],
      correctAnswer: [{ id: 'matrix', acceptableAnswers: [[['A'], ['B']]] }],
    };
    const { store } = await renderWithStore(<ResponseBlock config={config} location="belowStimulus" />);

    act(() => capturedNextButtonProps.onCheckAnswer?.());

    expect(store.getState().checkAnswer.trial1_0).toMatchObject({ correct: true, responses: { matrix: true } });
  });

  test('answer-level feedback enables checking when the component flag is omitted', async () => {
    const { container, store } = await renderWithStore(
      <ResponseBlock config={answerFeedbackConfig} location="belowStimulus" />,
    );
    expect(countButtons(container, 'Check Answer')).toBe(0);
    expect(findButton(container, 'Next')).toHaveProperty('disabled', false);
    await act(async () => { fireEvent.click(findButton(container, 'Next')); });
    expect(store.getState().checkAnswer.trial1_0).toMatchObject({ attemptsUsed: 1, correct: true });
    expect(container.textContent).toContain('Well done!');
    expect(mockNavigate).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(findButton(container, 'Next')); });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(store.getState().checkAnswer.trial1_0.attemptsUsed).toBe(1);
  });

  test.each([
    {
      componentFlag: false, customFeedback: true, globalFlag: true, enabled: false,
    },
    {
      componentFlag: true, customFeedback: false, globalFlag: false, enabled: true,
    },
    {
      componentFlag: undefined, customFeedback: true, globalFlag: false, enabled: true,
    },
    {
      componentFlag: undefined, customFeedback: false, globalFlag: true, enabled: true,
    },
    {
      componentFlag: undefined, customFeedback: false, globalFlag: false, enabled: false,
    },
    {
      componentFlag: undefined, customFeedback: false, globalFlag: undefined, enabled: false,
    },
  ])('resolves feedback with component=$componentFlag, custom=$customFeedback, global=$globalFlag', async ({
    componentFlag, customFeedback, globalFlag, enabled,
  }) => {
    mockProvideFeedback.value = globalFlag;
    const { container, store } = await renderWithStore(
      <ResponseBlock
        config={{
          ...baseConfig,
          hideCheckAnswerButton: false,
          provideFeedback: componentFlag,
          correctAnswer: [{
            id: 'q1',
            acceptableAnswers: ['correct', 'also correct'],
            feedback: customFeedback ? { correctText: 'Well done!' } : undefined,
          }],
        }}
        location="belowStimulus"
      />,
    );

    expect(countButtons(container, 'Check Answer')).toBe(enabled ? 1 : 0);
    expect(findButton(container, 'Next')).toHaveProperty('disabled', enabled);
    await act(async () => { fireEvent.click(findButton(container, enabled ? 'Check Answer' : 'Next')); });

    if (enabled) {
      expect(store.getState().checkAnswer.trial1_0).toMatchObject({ attemptsUsed: 1, correct: true });
      expect(container.textContent).toContain(customFeedback ? 'Well done!' : 'You have answered the question correctly.');
      expect(mockNavigate).not.toHaveBeenCalled();
    } else {
      expect(store.getState().checkAnswer.trial1_0).toBeUndefined();
      expect(container.querySelector('[data-testid="feedback-alert-q1"]')).toBeNull();
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    }
  });

  test.each([true, false])('ignores restored correct=%s checks when component feedback is disabled', async (correct) => {
    mockStoredAnswerData.checkAnswer = { attemptsUsed: correct ? 1 : 2, correct, responses: { q1: correct } };
    const { container } = await renderWithStore(
      <ResponseBlock
        config={{
          ...answerFeedbackConfig,
          provideFeedback: false,
          allowFailedTraining: false,
          response: [{
            id: 'q1', type: 'likert', prompt: 'Rate this', numItems: 5, required: false,
          }],
        }}
        location="belowStimulus"
      />,
    );

    expect(capturedSwitcherProps.indexes.filter(({ id }) => id === 'q1').every(({ disabled }) => disabled === false)).toBe(true);
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector('[data-testid="feedback-alert-q1"]')).toBeNull();
    expect(findButton(container, 'Next')).toHaveProperty('disabled', false);
    await act(async () => { fireEvent.click(findButton(container, 'Next')); });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  test('incorrect answers do not block continuing by default after attempts run out', async () => {
    mockAllowFailedTraining.value = undefined;
    mockAnswerField.values = { q1: 'incorrect' };
    const renderBlock = () => <ResponseBlock config={answerFeedbackConfig} location="belowStimulus" />;
    const {
      container, store, rerender, studyStore,
    } = await renderWithStore(renderBlock());

    await act(async () => { fireEvent.click(findButton(container, 'Next')); });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(findButton(container, 'Next')).toHaveProperty('disabled', false);
    await act(async () => { fireEvent.click(findButton(container, 'Next')); });
    expect(store.getState().checkAnswer.trial1_0).toMatchObject({ attemptsUsed: 2, correct: false });
    expect(findButton(container, 'Next')).toHaveProperty('disabled', false);
    expect(mockNavigate).not.toHaveBeenCalled();

    mockAllowFailedTraining.value = false;
    await act(async () => { rerender(withStore(studyStore, renderBlock())); });
    expect(findButton(container, 'Next')).toHaveProperty('disabled', true);
  });

  test('component allowFailedTraining explicitly permits continuing after exhaustion', async () => {
    mockAllowFailedTraining.value = undefined;
    mockAnswerField.values = { q1: 'incorrect' };
    const { container, store } = await renderWithStore(
      <ResponseBlock config={{ ...answerFeedbackConfig, allowFailedTraining: true }} location="belowStimulus" />,
    );
    await act(async () => { fireEvent.click(findButton(container, 'Next')); });
    expect(mockNavigate).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(findButton(container, 'Next')); });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(findButton(container, 'Next')).toHaveProperty('disabled', false);
    await act(async () => { fireEvent.click(findButton(container, 'Next')); });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(store.getState().checkAnswer.trial1_0.attemptsUsed).toBe(2);
  });
});

// ── step-level check-answer state (persistence) ───────────────────────────────

describe('ResponseBlock check-answer state persistence', () => {
  const feedbackConfig = {
    ...baseConfig,
    provideFeedback: true,
    correctAnswer: [{ id: 'q1', answer: 'correct' }],
  } as IndividualComponent;

  test('attempts survive unmount/remount within the same store', async () => {
    mockAnswerField.values = { q1: 'incorrect' };
    const studyStore = await makeStudyStore();
    const first = render(withStore(studyStore, <ResponseBlock config={feedbackConfig} location="belowStimulus" />));
    const checkBtn = findButton(first.container, 'Next');
    await act(async () => { fireEvent.click(checkBtn); });
    expect(studyStore.store.getState().checkAnswer.trial1_0.attemptsUsed).toBe(1);
    first.unmount();

    const second = render(withStore(studyStore, <ResponseBlock config={feedbackConfig} location="belowStimulus" />));
    expect(studyStore.store.getState().checkAnswer.trial1_0.attemptsUsed).toBe(1);
    expect(second.container.querySelectorAll('[data-testid="feedback-alert-q1"]')).toHaveLength(1);
  });

  test('seeds store from a persisted StoredAnswer.checkAnswer (refresh restore)', async () => {
    const persisted: CheckAnswerState = {
      attemptsUsed: 2, correct: false, responses: { q1: false }, answerSnapshot: {},
    };
    mockStoredAnswerData.checkAnswer = persisted;
    const { container, store } = await renderWithStore(
      <ResponseBlock config={feedbackConfig} location="belowStimulus" />,
    );
    expect(store.getState().checkAnswer.trial1_0).toEqual(persisted);
    const checkBtn = findButton(container, 'Next');
    expect(checkBtn).toHaveProperty('disabled', false);
    expect(container.querySelectorAll('[data-testid="feedback-alert-q1"]')).toHaveLength(1);
  });

  test('legacy stored answers without checkAnswer behave as before (no seed)', async () => {
    const { container, store } = await renderWithStore(
      <ResponseBlock config={feedbackConfig} location="belowStimulus" />,
    );
    expect(store.getState().checkAnswer.trial1_0).toBeUndefined();
    const checkBtn = findButton(container, 'Next');
    expect(checkBtn).toHaveProperty('disabled', false);
  });

  test('persists each grading attempt to storage before Next', async () => {
    mockAnswerField.values = { q1: 'incorrect' };
    mockAnswerField.values = { q1: '42' };
    const { container } = await renderWithStore(
      <ResponseBlock config={feedbackConfig} location="belowStimulus" />,
    );
    await act(async () => { fireEvent.click(findButton(container, 'Next')); });
    expect(mockSaveAnswers).toHaveBeenCalledTimes(1);
    await act(async () => { fireEvent.click(findButton(container, 'Next')); });
    expect(mockSaveAnswers).toHaveBeenCalledTimes(2);
    expect(mockSaveAnswers).toHaveBeenLastCalledWith(expect.objectContaining({
      trial1_0: expect.objectContaining({
        answer: { q1: '42' },
        checkAnswer: {
          attemptsUsed: 2,
          correct: false,
          responses: { q1: false },
          checkedAnswers: { q1: '42' },
        },
      }),
    }));
  });

  test('saves the graded draft to Redux', async () => {
    mockAnswerField.values = { q1: 'incorrect' };
    mockAnswerField.values = { q1: '42' };
    const persistedOptionOrders = { q1: [{ label: 'Forty two', value: '42' }] };
    const persistedQuestionOrders = { matrix: ['row2', 'row1'] };
    const studyStore = await makeStudyStore({}, {
      trial1_0: makeStoredAnswer({
        identifier: 'trial1_0',
        optionOrders: persistedOptionOrders,
        questionOrders: persistedQuestionOrders,
        formOrder: { response: ['q1'] },
      }),
    });
    const { container } = render(withStore(studyStore, <ResponseBlock config={feedbackConfig} location="belowStimulus" />));
    await act(async () => { fireEvent.click(findButton(container, 'Next')); });
    expect(studyStore.store.getState().answers.trial1_0).toMatchObject({
      identifier: 'trial1_0',
      answer: { q1: '42' },
      checkAnswer: {
        attemptsUsed: 1,
        correct: false,
        responses: { q1: false },
        checkedAnswers: { q1: '42' },
      },
      optionOrders: persistedOptionOrders,
      questionOrders: persistedQuestionOrders,
      formOrder: { response: ['q1'] },
    });
  });

  test('saves the draft to Redux even when data collection is disabled', async () => {
    mockAnswerField.values = { q1: 'incorrect' };
    mockAnswerField.values = { q1: '42' };
    const studyStore = await makeStudyStore({ dataCollectionEnabled: false });
    const { container } = render(withStore(studyStore, <ResponseBlock config={feedbackConfig} location="belowStimulus" />));
    await act(async () => { fireEvent.click(findButton(container, 'Next')); });
    expect(studyStore.store.getState().answers.trial1_0.checkAnswer).toEqual({
      attemptsUsed: 1,
      correct: false,
      responses: { q1: false },
      checkedAnswers: { q1: '42' },
    });
    expect(mockSaveAnswers).not.toHaveBeenCalled();
  });

  test('does not re-persist when restoring a saved checkAnswer', async () => {
    const persisted: CheckAnswerState = { attemptsUsed: 1, correct: false, responses: { q1: false } };
    mockStoredAnswerData.checkAnswer = persisted;
    const studyStore = await makeStudyStore({}, { trial1_0: makeStoredAnswer({ identifier: 'trial1_0', checkAnswer: persisted }) });
    render(withStore(studyStore, <ResponseBlock config={feedbackConfig} location="belowStimulus" />));
    expect(mockSaveAnswers).not.toHaveBeenCalled();
  });

  test('does not persist check-answer state while a dynamic component is loading', async () => {
    const loadingIdentifier = 'dynamicBlock_1___dynamicLoading_0';
    mockCurrentIdentifier.value = loadingIdentifier;
    const studyStore = await makeStudyStore();
    studyStore.store.dispatch(studyStore.actions.setCheckAnswerResult({
      identifier: loadingIdentifier,
      attemptsUsed: 1,
      correct: true,
      responses: { q1: true },
    }));

    render(withStore(studyStore, <ResponseBlock config={feedbackConfig} location="belowStimulus" />));
    await act(async () => {});

    expect(studyStore.store.getState().answers).not.toHaveProperty('undefined');
    expect(studyStore.store.getState().answers).not.toHaveProperty(loadingIdentifier);
  });

  test('does not persist check-answer state into a restored dynamic loading record', async () => {
    const loadingIdentifier = 'dynamicBlock_1___dynamicLoading_0';
    mockCurrentIdentifier.value = loadingIdentifier;
    const malformedLoadingAnswer = {
      answer: {},
      checkAnswer: undefined,
    } as unknown as StoredAnswer;
    const studyStore = await makeStudyStore({}, { [loadingIdentifier]: malformedLoadingAnswer });
    studyStore.store.dispatch(studyStore.actions.setCheckAnswerResult({
      identifier: loadingIdentifier,
      attemptsUsed: 1,
      correct: true,
      responses: { q1: true },
    }));

    render(withStore(studyStore, <ResponseBlock config={feedbackConfig} location="belowStimulus" />));
    await act(async () => {});

    expect(studyStore.store.getState().answers).not.toHaveProperty('undefined');
    expect(studyStore.store.getState().answers[loadingIdentifier]).toEqual(malformedLoadingAnswer);
    expect(mockSaveAnswers).not.toHaveBeenCalled();
  });

  test('repairs a missing internal identifier from the resolved route key', async () => {
    mockAnswerField.values = { q1: 'incorrect' };
    const answerWithoutIdentifier = {
      ...makeStoredAnswer({ identifier: 'trial1_0' }),
      identifier: undefined,
    } as unknown as StoredAnswer;
    const studyStore = await makeStudyStore({}, { trial1_0: answerWithoutIdentifier });
    const { container } = render(withStore(studyStore, <ResponseBlock config={feedbackConfig} location="belowStimulus" />));

    await act(async () => { fireEvent.click(findButton(container, 'Next')); });

    expect(studyStore.store.getState().answers).not.toHaveProperty('undefined');
    expect(studyStore.store.getState().answers.trial1_0.identifier).toBe('trial1_0');
    expect(mockSaveAnswers).toHaveBeenLastCalledWith(expect.objectContaining({
      trial1_0: expect.objectContaining({ identifier: 'trial1_0' }),
    }));
  });

  test('redirects to the training-failed page after the final failed attempt', async () => {
    vi.useFakeTimers();
    try {
      mockAnswerField.values = { q1: 'incorrect' };
      mockAnswerField.values = { q1: 'incorrect' };
      const noFailConfig = { ...feedbackConfig, allowFailedTraining: false } as IndividualComponent;
      const { container } = await renderWithStore(<ResponseBlock config={noFailConfig} location="belowStimulus" />);
      await act(async () => { fireEvent.click(findButton(container, 'Next')); });
      await act(async () => { fireEvent.click(findButton(container, 'Next')); });
      await act(async () => { vi.advanceTimersByTime(5000); });
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('__trainingFailed'));
    } finally {
      vi.useRealTimers();
    }
  });

  test('redirects to the training-failed page when restoring a failed training state', async () => {
    vi.useFakeTimers();
    try {
      mockStoredAnswerData.checkAnswer = { attemptsUsed: 2, correct: false, responses: { q1: false } };
      const noFailConfig = { ...feedbackConfig, allowFailedTraining: false } as IndividualComponent;
      await renderWithStore(<ResponseBlock config={noFailConfig} location="belowStimulus" />);
      await act(async () => { vi.advanceTimersByTime(5000); });
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('__trainingFailed'));
    } finally {
      vi.useRealTimers();
    }
  });

  test('does not redirect a restored failure when allowFailedTraining is true', async () => {
    vi.useFakeTimers();
    try {
      mockStoredAnswerData.checkAnswer = { attemptsUsed: 2, correct: false, responses: { q1: false } };
      await renderWithStore(<ResponseBlock config={feedbackConfig} location="belowStimulus" />);
      await act(async () => { vi.advanceTimersByTime(5000); });
      expect(mockNavigate).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  test('restores mixed per-response feedback in the correct locations', async () => {
    mockStoredAnswerData.formOrder = { response: ['q1', 'q2'] };
    mockStoredAnswerData.checkAnswer = {
      attemptsUsed: 1, correct: false, responses: { q1: true, q2: false }, answerSnapshot: {},
    };
    const multiConfig = {
      type: 'questionnaire',
      response: [
        {
          type: 'shortText', id: 'q1', prompt: 'Q1', required: false,
        },
        {
          type: 'shortText', id: 'q2', prompt: 'Q2', required: false, location: 'aboveStimulus',
        },
      ],
      provideFeedback: true,
      correctAnswer: [{ id: 'q1', answer: 'a' }, { id: 'q2', answer: 'b' }],
    } as IndividualComponent;
    const studyStore = await makeStudyStore();
    const { container } = render(withStore(
      studyStore, (
        <>
          <ResponseBlock config={multiConfig} location="aboveStimulus" />
          <ResponseBlock config={multiConfig} location="belowStimulus" />
        </>
      ),
    ));
    const above = container.querySelector('.responseBlock-aboveStimulus')!;
    const below = container.querySelector('.responseBlock-belowStimulus')!;
    // Each alert renders once, in the block its response lives in
    expect(above.querySelector('[data-testid="feedback-alert-q2"]')?.getAttribute('data-title')).toBe('Incorrect Answer');
    expect(above.querySelector('[data-testid="feedback-alert-q1"]')).toBeNull();
    expect(below.querySelector('[data-testid="feedback-alert-q1"]')?.getAttribute('data-title')).toBe('Correct Answer');
    expect(below.querySelector('[data-testid="feedback-alert-q2"]')).toBeNull();
    expect(container.querySelectorAll('[data-testid^="feedback-alert-"]')).toHaveLength(2);
  });
});

// ── unlimited attempts (trainingAttempts: -1) ─────────────────────────────────

describe('ResponseBlock unlimited attempts', () => {
  const unlimitedConfig = {
    ...baseConfig,
    provideFeedback: true,
    correctAnswer: [{ id: 'q1', answer: 'correct' }],
    trainingAttempts: -1,
  } as IndividualComponent;

  test('keeps Next available for retrying unlimited attempts', async () => {
    mockAnswerField.values = { q1: 'incorrect' };
    const { container, store } = await renderWithStore(
      <ResponseBlock config={unlimitedConfig} location="belowStimulus" />,
    );
    const checkBtn = findButton(container, 'Next');
    await act(async () => { fireEvent.click(checkBtn); });
    await act(async () => { fireEvent.click(checkBtn); });
    await act(async () => { fireEvent.click(checkBtn); });
    expect(store.getState().checkAnswer.trial1_0.attemptsUsed).toBe(3);
    // Unlimited attempts keep Next available for checking again without advancing.
    expect(checkBtn).toHaveProperty('disabled', false);
    expect(container.querySelector('[data-testid="feedback-alert-q1"]')?.getAttribute('data-title')).toBe('Incorrect Answer');
    expect(findButton(container, 'Next')).toHaveProperty('disabled', false);
  });

  test('enables Next once the answer is correct', async () => {
    mockAnswerField.values = { q1: 'correct' };
    const { container } = await renderWithStore(
      <ResponseBlock config={unlimitedConfig} location="belowStimulus" />,
    );
    await act(async () => { fireEvent.click(findButton(container, 'Next')); });
    expect(findButton(container, 'Next')).toHaveProperty('disabled', false);
  });
});

test.each([null, {}])('replay distinguishes an initial form from an empty snapshot: %j', async (form) => {
  mockIsAnalysis.value = true;
  const status = makeStoredAnswer({ answer: { q1: 'saved' } });
  const studyStore = await makeStudyStore();
  studyStore.store.dispatch(studyStore.actions.saveAnalysisState({ location: 'belowStimulus', prov: { form } }));
  render(withStore(studyStore, <ResponseBlock config={baseConfig} location="belowStimulus" status={status} />));
  expect(capturedSwitcherProps.storedAnswer).toEqual(form === null ? status.answer : {});
  expect(vi.mocked(useAnswerField).mock.lastCall?.[6]).toEqual(form === null ? status.answer : {});
});

test('replay only uses saved correctness scores when they match the replayed values', async () => {
  mockIsAnalysis.value = true;
  mockStoredAnswerData.formOrder = undefined;
  vi.mocked(isEqual).mockImplementation((first, second) => JSON.stringify(first) === JSON.stringify(second));
  const config: IndividualComponent = {
    type: 'questionnaire',
    response: [{
      id: 'controller', type: 'numerical', prompt: '', path: 'test-response-functions/assets/PartialScore.response.ts',
    }],
    correctAnswer: [{ id: 'controller', answer: 10 }],
  };
  const answer = { controller: 10 };
  const status = makeStoredAnswer({
    answer,
    checkAnswer: {
      attemptsUsed: 1,
      correct: true,
      responses: { controller: true },
      scores: { controller: 1 },
      answerSnapshot: answer,
    },
  });
  const studyStore = await makeStudyStore();
  studyStore.store.dispatch(studyStore.actions.saveAnalysisState({
    location: 'belowStimulus', prov: { form: { controller: 5 } },
  }));

  render(withStore(studyStore, <ResponseBlock config={config} location="belowStimulus" status={status} />));
  expect(vi.mocked(useAnswerField).mock.lastCall?.[9]).toBeUndefined();
});

test('replay uses matching saved scores before resolving historical follow-up visibility', async () => {
  mockIsAnalysis.value = true;
  mockStoredAnswerData.formOrder = undefined;
  mockAnswerField.values = { controller: 5, followUp: 'detail' };
  const config: IndividualComponent = {
    type: 'questionnaire',
    response: [{
      id: 'controller', type: 'numerical', prompt: '', path: 'test-response-functions/assets/PartialScore.response.ts',
    }, {
      id: 'followUp',
      type: 'shortText',
      prompt: 'Follow up',
      visibleIf: { responseId: 'controller', comparison: 'isCorrect', value: true },
    }],
    correctAnswer: [{ id: 'controller', answer: 10 }, { id: 'followUp', answer: 'detail' }],
  };
  const answer = { controller: 5, followUp: 'detail' };
  const status = makeStoredAnswer({
    answer,
    checkAnswer: {
      attemptsUsed: 1,
      correct: true,
      responses: { controller: true, followUp: true },
      scores: { controller: 1 },
      answerSnapshot: answer,
    },
  });
  const studyStore = await makeStudyStore();
  studyStore.store.dispatch(studyStore.actions.saveAnalysisState({
    location: 'belowStimulus', prov: { form: answer },
  }));

  const { container } = render(withStore(studyStore, <ResponseBlock config={config} location="belowStimulus" status={status} />));
  expect(vi.mocked(useAnswerField).mock.lastCall?.[9]).toEqual({ controller: 1 });
  expect(container.querySelector('[data-response-id="followUp"]')).not.toBeNull();
});

test('replay treats a location snapshot as authoritative when a controller answer was removed', async () => {
  mockIsAnalysis.value = true;
  mockStoredAnswerData.formOrder = undefined;
  const config: IndividualComponent = {
    type: 'questionnaire',
    response: [
      {
        id: 'controller', type: 'radio', prompt: '', options: ['yes', 'no'], location: 'sidebar',
      },
      {
        id: 'dependent', type: 'shortText', prompt: '', visibleIf: { responseId: 'controller', comparison: 'equals', value: 'yes' },
      },
    ],
  };
  const status = makeStoredAnswer({ answer: { controller: 'yes', dependent: 'University' } });
  const studyStore = await makeStudyStore();
  const { container } = render(withStore(studyStore, <ResponseBlock config={config} location="belowStimulus" status={status} />));
  expect(container.querySelector('[data-response-id="dependent"]')).not.toBeNull();
  act(() => {
    studyStore.store.dispatch(studyStore.actions.saveAnalysisState({ location: 'sidebar', prov: { form: null } }));
  });
  expect(container.querySelector('[data-response-id="dependent"]')).not.toBeNull();
  act(() => {
    studyStore.store.dispatch(studyStore.actions.saveAnalysisState({ location: 'sidebar', prov: { form: {} } }));
  });
  expect(container.querySelector('[data-response-id="dependent"]')).toBeNull();
  act(() => {
    studyStore.store.dispatch(studyStore.actions.saveAnalysisState({ location: 'sidebar', prov: { form: { controller: 'yes' } } }));
  });
  expect(container.querySelector('[data-response-id="dependent"]')).not.toBeNull();
});

test('uses restored answers until another location publishes a complete snapshot', async () => {
  mockStoredAnswerData.formOrder = undefined;
  const config: IndividualComponent = {
    type: 'questionnaire',
    response: [
      {
        id: 'controller', type: 'radio', prompt: '', options: ['yes', 'no'], location: 'sidebar',
      },
      {
        id: 'dependent', type: 'shortText', prompt: '', visibleIf: { responseId: 'controller', comparison: 'equals', value: 'yes' },
      },
    ],
  };
  const status = makeStoredAnswer({ answer: { controller: 'yes', dependent: 'University' } });
  vi.mocked(generateInitFields).mockImplementation(() => ({ ...status.answer }));
  const studyStore = await makeStudyStore();
  render(withStore(studyStore, <ResponseBlock config={config} location="belowStimulus" status={status} />));
  expect(vi.mocked(useAnswerField).mock.lastCall?.[6]).toMatchObject({ controller: 'yes' });
  act(() => {
    studyStore.store.dispatch(studyStore.actions.updateResponseBlockValidation({
      location: 'sidebar', identifier: 'trial1_0', values: {}, status: true, replaceValues: true,
    }));
  });
  expect(vi.mocked(useAnswerField).mock.lastCall?.[6]).not.toHaveProperty('controller');
  vi.mocked(generateInitFields).mockReturnValue({});
});

test('Check Answer ignores a conditionally hidden correct answer', async () => {
  mockStoredAnswerData.formOrder = undefined;
  mockAnswerField.values = { controller: '' };
  const config: IndividualComponent = {
    type: 'questionnaire',
    provideFeedback: true,
    response: [
      {
        id: 'controller', type: 'radio', prompt: '', options: ['yes', 'no'], required: false,
      },
      {
        id: 'dependent', type: 'shortText', prompt: '', visibleIf: { responseId: 'controller', comparison: 'equals', value: 'yes' },
      },
    ],
    correctAnswer: [{ id: 'dependent', answer: 'University' }],
  };
  const { store } = await renderWithStore(<ResponseBlock config={config} location="belowStimulus" />);
  act(() => capturedNextButtonProps.onCheckAnswer?.());
  expect(store.getState().checkAnswer.trial1_0?.correct).toBe(true);
});

test('keeps trial totals from the checked snapshot when an answer hides a dependent response', async () => {
  vi.mocked(isEqual).mockImplementation((left, right) => JSON.stringify(left) === JSON.stringify(right));
  mockStoredAnswerData.formOrder = undefined;
  mockAnswerField.values = { controller: 'no' };
  const config: IndividualComponent = {
    type: 'questionnaire',
    provideFeedback: true,
    response: [
      {
        id: 'controller', type: 'radio', prompt: '', options: ['yes', 'no'], required: false,
      },
      {
        id: 'dependent', type: 'shortText', prompt: '', visibleIf: { responseId: 'controller', comparison: 'equals', value: 'yes' },
      },
    ],
    correctAnswer: [
      { id: 'controller', answer: 'yes' },
      { id: 'dependent', answer: 'expected' },
    ],
  };
  const checkedAnswer = makeStoredAnswer({
    answer: { controller: 'yes', dependent: 'saved answer' },
    checkAnswer: {
      attemptsUsed: 1,
      correct: false,
      responses: { controller: true, dependent: false },
      checkedAnswers: { controller: 'yes', dependent: 'saved answer' },
    },
  });
  const { container } = await renderWithStore(
    <ResponseBlock config={config} location="belowStimulus" status={checkedAnswer} />,
  );
  expect(container.querySelector('[data-testid="trial-answer-summary"]')?.textContent).toBe('1 of 2 answers correct; 1 incorrect.');
  expect(container.querySelector('[data-response-id="dependent"]')).toBeNull();
});

describe('custom training feedback', () => {
  const config: IndividualComponent = {
    type: 'questionnaire',
    response: [
      {
        id: 'q1', type: 'shortText', prompt: 'First', location: 'belowStimulus',
      },
      {
        id: 'q2', type: 'shortText', prompt: 'Second', location: 'aboveStimulus',
      },
    ],
    correctAnswer: [
      { id: 'q1', answer: 'a', feedback: { correctText: 'First correct answer' } },
      { id: 'q2', answer: 'b', feedback: { incorrectText: 'Retry with {attemptsLeft} left', exhaustedText: 'Finished after {attemptsUsed}', hints: ['First answer-specific hint', 'Second answer-specific hint'] } },
    ],
    provideFeedback: true,
    trainingAttempts: 2,
  };

  test('renders individual feedback across response locations', async () => {
    mockStoredAnswerData.formOrder = { response: ['q1', 'q2'] };
    mockStoredAnswerData.checkAnswer = { attemptsUsed: 1, correct: false, responses: { q1: true, q2: false } };
    const { container } = await renderWithStore(
      <>
        <ResponseBlock config={config} location="aboveStimulus" />
        <ResponseBlock config={config} location="belowStimulus" />
      </>,
    );
    expect(container.textContent).toContain('First correct answer');
    expect(container.textContent).toContain('Retry with 1 left');
    expect(container.querySelector('[data-testid="feedback-alert-q2"]')?.textContent).toContain('First answer-specific hint');
    expect(container.querySelector('[data-testid="feedback-alert-q2"]')?.getAttribute('data-show-help-text-link')).toBe('false');
    expect(container.querySelector('[data-testid="feedback-alert-q1"]')?.getAttribute('data-fit-height')).toBe('true');
    expect(container.querySelector('[data-testid="feedback-alert-q2"]')?.getAttribute('data-fit-height')).toBe('true');
    expect(container.querySelector('[data-testid="feedback-alert-q1"]')?.textContent).not.toContain('answer-specific hint');
    expect(container.querySelector('[data-testid="trial-answer-summary"]')?.textContent).toBe('1 of 2 answers correct; 1 incorrect.');
  });

  test('uses exhausted text after the final failed attempt', async () => {
    mockStoredAnswerData.formOrder = { response: ['q1', 'q2'] };
    mockStoredAnswerData.checkAnswer = { attemptsUsed: 2, correct: false, responses: { q1: true, q2: false } };
    const { container } = await renderWithStore(<ResponseBlock config={config} location="aboveStimulus" />);
    expect(container.textContent).toContain('Finished after 2');
    expect(container.textContent).not.toContain('Retry with');
    expect(container.textContent).not.toContain('answer-specific hint');
  });

  test('uses different feedback for each attempt', async () => {
    mockStoredAnswerData.formOrder = { response: ['q1', 'q2'] };
    mockStoredAnswerData.checkAnswer = { attemptsUsed: 2, correct: false, responses: { q1: true, q2: false } };
    const { container } = await renderWithStore(<ResponseBlock
      config={{ ...config, trainingAttempts: 3, correctAnswer: [config.correctAnswer![0], { id: 'q2', answer: 'b', feedback: { incorrectText: ['First hint', 'Second hint: {attemptsLeft} left'] } }] }}
      location="aboveStimulus"
    />);
    expect(container.textContent).toContain('Second hint: 1 left');
    expect(container.textContent).not.toContain('First hint');
  });

  test('keeps incorrect feedback when no exhausted message is specified', async () => {
    mockStoredAnswerData.checkAnswer = { attemptsUsed: 2, correct: false, responses: { q1: false } };
    const { container } = await renderWithStore(<ResponseBlock
      config={{ ...config, correctAnswer: [{ id: 'q1', answer: 'a', feedback: { incorrectText: 'Keep this explanation', hints: ['Helpful hint'] } }] }}
      location="belowStimulus"
    />);
    expect(container.textContent).toContain('Keep this explanation');
    expect(container.textContent).not.toContain('Helpful hint');
  });

  test('clears hints when the answer is correct', async () => {
    mockStoredAnswerData.formOrder = { response: ['q1', 'q2'] };
    mockStoredAnswerData.checkAnswer = { attemptsUsed: 2, correct: true, responses: { q2: true } };
    const { container } = await renderWithStore(<ResponseBlock config={config} location="aboveStimulus" />);
    expect(container.textContent).toContain('You have answered the question correctly.');
    expect(container.textContent).not.toContain('answer-specific hint');
  });

  test('shows correct and incorrect totals once across response locations', async () => {
    mockStoredAnswerData.formOrder = { response: ['q1', 'q2'] };
    mockStoredAnswerData.checkAnswer = { attemptsUsed: 1, correct: false, responses: { q1: true, q2: false } };
    const { container } = await renderWithStore(
      <>
        <ResponseBlock config={config} location="aboveStimulus" />
        <ResponseBlock config={config} location="belowStimulus" />
      </>,
    );
    expect(container.textContent).toContain('First correct answer');
    expect(container.querySelector('[data-testid="trial-answer-summary"]')?.textContent).toBe('1 of 2 answers correct; 1 incorrect.');
    expect(container.querySelectorAll('[data-testid="trial-answer-summary"]')).toHaveLength(1);
  });

  test('shows trial totals when the first checked response is hidden', async () => {
    mockStoredAnswerData.formOrder = { response: ['hidden-q', 'visible-q'] };
    const checkedAnswer = makeStoredAnswer({
      answer: { 'hidden-q': 'hidden', 'visible-q': 'visible' },
      checkAnswer: {
        attemptsUsed: 1,
        correct: false,
        responses: { 'hidden-q': true, 'visible-q': false },
        checkedAnswers: { 'hidden-q': 'hidden', 'visible-q': 'visible' },
      },
    });
    const hiddenFirstConfig: IndividualComponent = {
      type: 'questionnaire',
      provideFeedback: true,
      response: [
        {
          id: 'hidden-q', type: 'shortText', prompt: 'Hidden answer', hidden: true,
        },
        {
          id: 'visible-q', type: 'shortText', prompt: 'Visible answer',
        },
      ],
      correctAnswer: [
        { id: 'hidden-q', answer: 'hidden' },
        { id: 'visible-q', answer: 'expected' },
      ],
    };
    const { container } = await renderWithStore(<ResponseBlock config={hiddenFirstConfig} location="belowStimulus" status={checkedAnswer} />);

    expect(container.querySelector('[data-testid="switcher-shortText"][data-response-id="hidden-q"]')).toBeNull();
    expect(container.querySelector('[data-testid="trial-answer-summary"]')?.textContent).toBe('1 of 2 answers correct; 1 incorrect.');
  });
});
