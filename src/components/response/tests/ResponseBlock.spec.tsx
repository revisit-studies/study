import { ReactNode } from 'react';
import isEqual from 'lodash.isequal';
import { Provider } from 'react-redux';
import {
  render, renderHook, act, fireEvent, cleanup,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { publishAutoAdvanceSelection } from '../autoAdvanceEvents';
import { NextButton } from '../../NextButton';
import { usePreviousStep } from '../../../store/hooks/usePreviousStep';
import { useStudyConfig } from '../../../store/hooks/useStudyConfig';
import { encryptIndex } from '../../../utils/encryptDecryptIndex';
import type { IndividualComponent, StudyConfig } from '../../../parser/types';
import type { CheckAnswerState, Sequence, StoredAnswer } from '../../../store/types';
import type { REVISIT_MODE } from '../../../storage/engines/types';
import { studyStoreCreator, StudyStoreContext } from '../../../store/store';
import { ResponseBlock } from '../ResponseBlock';
import { generateInitFields, useAnswerField } from '../utils';
import { makeStoredAnswer } from '../../../tests/utils';
import { responseAnswerIsCorrect } from '../../../utils/correctAnswer';
import type { compareResponseValues } from '../../../utils/correctAnswer';

// ── mocks ────────────────────────────────────────────────────────────────────

const {
  mockRoute, mockSearchParams, realNextButton, mockStoredAnswerData, capturedNextButtonProps, capturedSwitcherProps, mockIsAnalysis, mockCurrentIdentifier, mockNavigate, mockSaveAnswers, mockTrrackApply, mockAnswerField,
} = vi.hoisted(() => ({
  mockRoute: { step: 0, funcIndex: undefined as string | undefined },
  mockSearchParams: { value: '' },
  realNextButton: { enabled: false },
  mockStoredAnswerData: {
    identifier: 'trial1_0',
    endTime: -1,
    formOrder: { response: ['q1'] } as { response: string[] } | undefined,
    questionOrders: {},
    optionOrders: {},
    responseSubmitAttempted: undefined as boolean | undefined,
    checkAnswer: undefined as { attemptsUsed: number; correct: boolean; responses: Record<string, boolean> } | undefined,
  },
  capturedNextButtonProps: {
    onCheckAnswer: undefined as (() => void) | undefined,
  },
  capturedSwitcherProps: {
    storedAnswer: undefined as Record<string, unknown> | undefined,
    answerFinalized: undefined as boolean | undefined,
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
}));

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
  Text: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  ThemeIcon: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Kbd: ({ children }: { children?: ReactNode }) => <kbd>{children}</kbd>,
}));

vi.mock('react-router', () => ({
  useNavigate: vi.fn(() => mockNavigate),
  useParams: vi.fn(() => ({ funcIndex: mockRoute.funcIndex })),
  useSearchParams: vi.fn(() => [new URLSearchParams(mockSearchParams.value)]),
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
      provideFeedback: false,
      allowFailedTraining: true,
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
  useCurrentStep: vi.fn(() => mockRoute.step),
  useCurrentIdentifier: vi.fn(() => mockCurrentIdentifier.value),
  useStudyId: vi.fn(() => 'test-study'),
}));

vi.mock('../utils', () => ({
  generateInitFields: vi.fn(() => ({})),
  mergeReactiveAnswers: vi.fn((_: unknown, values: unknown) => values),
  useAnswerField: vi.fn(() => mockAnswerField),
  usesStandaloneDontKnowField: vi.fn(() => false),
}));

vi.mock('../../../utils/correctAnswer', async (importOriginal) => ({
  ...await importOriginal<{ compareResponseValues: typeof compareResponseValues }>(),
  responseAnswerIsCorrect: vi.fn(() => true),
}));

vi.mock('../customResponseModules', () => ({
  getCustomResponseModule: vi.fn(() => null),
  getCustomResponseModuleLoadError: vi.fn(() => null),
}));

vi.mock('../ResponseSwitcher', () => ({
  ResponseSwitcher: ({
    response, storedAnswer, answerFinalized, index, disabled, isDelayedDisabled, form,
  }: {
    response: { id: string; type: string };
    storedAnswer?: Record<string, unknown>;
    answerFinalized?: boolean;
    index: number;
    disabled?: boolean;
    isDelayedDisabled?: boolean;
    form: { onChange?: (value: unknown, source?: 'keyboard' | 'click') => void };
  }) => {
    capturedSwitcherProps.storedAnswer = storedAnswer;
    capturedSwitcherProps.answerFinalized = answerFinalized;
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

vi.mock('../FeedbackAlert', () => ({
  FeedbackAlert: ({ response, alertConfig }: { response: { id: string }; alertConfig: Record<string, { visible: boolean; title: string }> }) => (
    alertConfig[response.id]?.visible ? <div data-testid={`feedback-alert-${response.id}`} data-title={alertConfig[response.id].title} /> : null
  ),
}));

vi.mock('../../NextButton', async (importOriginal) => {
  const actual = await importOriginal<{ NextButton: typeof NextButton }>();
  return {
    NextButton: (props: Parameters<typeof NextButton>[0]) => {
      if (realNextButton.enabled) return <actual.NextButton {...props} />;
      const {
        label, disabled, checkAnswer, onCheckAnswer,
      } = props;
      capturedNextButtonProps.onCheckAnswer = onCheckAnswer;
      return (
        <div>
          {checkAnswer}
          <button type="button" disabled={disabled}>{label}</button>
        </div>
      );
    },
  };
});

vi.mock('../../PreviousButton', () => ({ PreviousButton: () => null }));

// ── fixtures ──────────────────────────────────────────────────────────────────

const baseConfig: IndividualComponent = {
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
  mockRoute.step = 0;
  mockRoute.funcIndex = undefined;
  vi.mocked(useStudyConfig).mockReset();
  mockSearchParams.value = '';
  realNextButton.enabled = false;
  vi.mocked(isEqual).mockReturnValue(true);
  vi.mocked(responseAnswerIsCorrect).mockReturnValue(true);
  mockStoredAnswerData.formOrder = { response: ['q1'] };
  mockStoredAnswerData.responseSubmitAttempted = undefined;
  mockStoredAnswerData.checkAnswer = undefined;
  capturedNextButtonProps.onCheckAnswer = undefined;
  capturedSwitcherProps.storedAnswer = undefined;
  capturedSwitcherProps.answerFinalized = undefined;
  capturedSwitcherProps.onChange = undefined;
  capturedSwitcherProps.indexes = [];
  mockIsAnalysis.value = false;
  mockCurrentIdentifier.value = 'trial1_0';
  mockNavigate.mockClear();
  mockSaveAnswers.mockClear();
  mockTrrackApply.mockClear();
  mockAnswerField.values = {};
  mockAnswerField.setFieldValue.mockReset();
});

// Unmount between tests so window keydown listeners from prior renders don't leak
afterEach(() => cleanup());

// ── ResponseBlock ─────────────────────────────────────────────────────────────

describe('ResponseBlock', () => {
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

  test('renders Check Answer button when provideFeedback and correctAnswer exist', async () => {
    const configWithFeedback = {
      ...baseConfig,
      provideFeedback: true,
      correctAnswer: [{ id: 'q1', answer: 'correct' }],
    } as IndividualComponent;
    const studyStore = await makeStudyStore();
    const { container } = render(withStore(studyStore, <ResponseBlock config={configWithFeedback} location="belowStimulus" />));
    const html = container.innerHTML;
    expect(html).toContain('Check Answer');
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

  test('clicking Check Answer calls checkAnswerProvideFeedback', async () => {
    const configWithFeedback = {
      ...baseConfig,
      provideFeedback: true,
      correctAnswer: [{ id: 'q1', answer: 'correct' }],
    } as IndividualComponent;
    const { container } = await renderWithStore(
      <ResponseBlock config={configWithFeedback} location="belowStimulus" />,
    );
    const checkBtn = findButton(container, 'Check Answer');
    await act(async () => { fireEvent.click(checkBtn); });
    // After a correct answer the Check Answer button should become disabled
    expect(checkBtn).toHaveProperty('disabled', true);
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
  const feedbackEnterConfig = {
    ...baseConfig,
    nextOnEnter: true,
    provideFeedback: true,
    correctAnswer: [{ id: 'q1', answer: 'correct' }],
  } as IndividualComponent;

  test('passes onCheckAnswer to NextButton and grades once when called', async () => {
    vi.mocked(responseAnswerIsCorrect).mockReturnValue(false);
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

  test('does not pass onCheckAnswer and disables Check Answer after all attempts are used', async () => {
    // uiConfig mock sets trainingAttempts: 2
    vi.mocked(responseAnswerIsCorrect).mockReturnValue(false);
    const { container, store } = await renderWithStore(<ResponseBlock config={feedbackEnterConfig} location="belowStimulus" />);
    await act(async () => { capturedNextButtonProps.onCheckAnswer?.(); });
    await act(async () => { capturedNextButtonProps.onCheckAnswer?.(); });
    expect(store.getState().checkAnswer.trial1_0.attemptsUsed).toBe(2);
    expect(capturedNextButtonProps.onCheckAnswer).toBeUndefined();
    expect(findButton(container, 'Check Answer')).toHaveProperty('disabled', true);
    expect(incorrectCount(store)).toBe(2);
  });

  test('does not pass onCheckAnswer after a correct answer', async () => {
    const { container, store } = await renderWithStore(
      <ResponseBlock config={feedbackEnterConfig} location="belowStimulus" />,
    );
    await act(async () => { capturedNextButtonProps.onCheckAnswer?.(); });
    const checkBtn = findButton(container, 'Check Answer');
    expect(checkBtn).toHaveProperty('disabled', true);
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

// ── step-level check-answer state (persistence) ───────────────────────────────

describe('ResponseBlock check-answer state persistence', () => {
  const feedbackConfig = {
    ...baseConfig,
    provideFeedback: true,
    correctAnswer: [{ id: 'q1', answer: 'correct' }],
  } as IndividualComponent;

  test('attempts survive unmount/remount within the same store', async () => {
    vi.mocked(responseAnswerIsCorrect).mockReturnValue(false);
    const studyStore = await makeStudyStore();
    const first = render(withStore(studyStore, <ResponseBlock config={feedbackConfig} location="belowStimulus" />));
    const checkBtn = findButton(first.container, 'Check Answer');
    await act(async () => { fireEvent.click(checkBtn); });
    expect(studyStore.store.getState().checkAnswer.trial1_0.attemptsUsed).toBe(1);
    first.unmount();

    const second = render(withStore(studyStore, <ResponseBlock config={feedbackConfig} location="belowStimulus" />));
    expect(studyStore.store.getState().checkAnswer.trial1_0.attemptsUsed).toBe(1);
    expect(second.container.querySelectorAll('[data-testid="feedback-alert-q1"]')).toHaveLength(1);
  });

  test('seeds store from a persisted StoredAnswer.checkAnswer (refresh restore)', async () => {
    const persisted: CheckAnswerState = { attemptsUsed: 2, correct: false, responses: { q1: false } };
    mockStoredAnswerData.checkAnswer = persisted;
    const { container, store } = await renderWithStore(
      <ResponseBlock config={feedbackConfig} location="belowStimulus" />,
    );
    expect(store.getState().checkAnswer.trial1_0).toEqual(persisted);
    const checkBtn = findButton(container, 'Check Answer');
    expect(checkBtn).toHaveProperty('disabled', true);
    expect(container.querySelectorAll('[data-testid="feedback-alert-q1"]')).toHaveLength(1);
  });

  test('legacy stored answers without checkAnswer behave as before (no seed)', async () => {
    const { container, store } = await renderWithStore(
      <ResponseBlock config={feedbackConfig} location="belowStimulus" />,
    );
    expect(store.getState().checkAnswer.trial1_0).toBeUndefined();
    const checkBtn = findButton(container, 'Check Answer');
    expect(checkBtn).toHaveProperty('disabled', false);
  });

  test('persists each grading attempt to storage before Next', async () => {
    vi.mocked(responseAnswerIsCorrect).mockReturnValue(false);
    mockAnswerField.values = { q1: '42' };
    const { container } = await renderWithStore(
      <ResponseBlock config={feedbackConfig} location="belowStimulus" />,
    );
    await act(async () => { fireEvent.click(findButton(container, 'Check Answer')); });
    expect(mockSaveAnswers).toHaveBeenCalledTimes(1);
    await act(async () => { fireEvent.click(findButton(container, 'Check Answer')); });
    expect(mockSaveAnswers).toHaveBeenCalledTimes(2);
    expect(mockSaveAnswers).toHaveBeenLastCalledWith(expect.objectContaining({
      trial1_0: expect.objectContaining({
        answer: { q1: '42' },
        checkAnswer: { attemptsUsed: 2, correct: false, responses: { q1: false } },
      }),
    }));
  });

  test('saves the graded draft to Redux', async () => {
    vi.mocked(responseAnswerIsCorrect).mockReturnValue(false);
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
    await act(async () => { fireEvent.click(findButton(container, 'Check Answer')); });
    expect(studyStore.store.getState().answers.trial1_0).toMatchObject({
      identifier: 'trial1_0',
      answer: { q1: '42' },
      checkAnswer: { attemptsUsed: 1, correct: false, responses: { q1: false } },
      optionOrders: persistedOptionOrders,
      questionOrders: persistedQuestionOrders,
      formOrder: { response: ['q1'] },
    });
  });

  test('saves the draft to Redux even when data collection is disabled', async () => {
    vi.mocked(responseAnswerIsCorrect).mockReturnValue(false);
    const studyStore = await makeStudyStore({ dataCollectionEnabled: false });
    const { container } = render(withStore(studyStore, <ResponseBlock config={feedbackConfig} location="belowStimulus" />));
    await act(async () => { fireEvent.click(findButton(container, 'Check Answer')); });
    expect(studyStore.store.getState().answers.trial1_0.checkAnswer).toEqual({ attemptsUsed: 1, correct: false, responses: { q1: false } });
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
    vi.mocked(responseAnswerIsCorrect).mockReturnValue(false);
    const answerWithoutIdentifier = {
      ...makeStoredAnswer({ identifier: 'trial1_0' }),
      identifier: undefined,
    } as unknown as StoredAnswer;
    const studyStore = await makeStudyStore({}, { trial1_0: answerWithoutIdentifier });
    const { container } = render(withStore(studyStore, <ResponseBlock config={feedbackConfig} location="belowStimulus" />));

    await act(async () => { fireEvent.click(findButton(container, 'Check Answer')); });

    expect(studyStore.store.getState().answers).not.toHaveProperty('undefined');
    expect(studyStore.store.getState().answers.trial1_0.identifier).toBe('trial1_0');
    expect(mockSaveAnswers).toHaveBeenLastCalledWith(expect.objectContaining({
      trial1_0: expect.objectContaining({ identifier: 'trial1_0' }),
    }));
  });

  test('redirects to the training-failed page after the final failed attempt', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(responseAnswerIsCorrect).mockReturnValue(false);
      const noFailConfig = { ...feedbackConfig, allowFailedTraining: false } as IndividualComponent;
      const { container } = await renderWithStore(<ResponseBlock config={noFailConfig} location="belowStimulus" />);
      await act(async () => { fireEvent.click(findButton(container, 'Check Answer')); });
      await act(async () => { fireEvent.click(findButton(container, 'Check Answer')); });
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
    mockStoredAnswerData.checkAnswer = { attemptsUsed: 1, correct: false, responses: { q1: true, q2: false } };
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

  test('keeps Check Answer enabled and Next disabled after wrong answers', async () => {
    vi.mocked(responseAnswerIsCorrect).mockReturnValue(false);
    const { container, store } = await renderWithStore(
      <ResponseBlock config={unlimitedConfig} location="belowStimulus" />,
    );
    const checkBtn = findButton(container, 'Check Answer');
    await act(async () => { fireEvent.click(checkBtn); });
    await act(async () => { fireEvent.click(checkBtn); });
    await act(async () => { fireEvent.click(checkBtn); });
    expect(store.getState().checkAnswer.trial1_0.attemptsUsed).toBe(3);
    // Unlimited attempts: Check Answer never locks, and Next stays disabled until correct
    expect(checkBtn).toHaveProperty('disabled', false);
    expect(container.querySelector('[data-testid="feedback-alert-q1"]')?.getAttribute('data-title')).toBe('Incorrect Answer');
    expect(findButton(container, 'Next')).toHaveProperty('disabled', true);
  });

  test('enables Next once the answer is correct', async () => {
    vi.mocked(responseAnswerIsCorrect).mockReturnValue(true);
    const { container } = await renderWithStore(
      <ResponseBlock config={unlimitedConfig} location="belowStimulus" />,
    );
    await act(async () => { fireEvent.click(findButton(container, 'Check Answer')); });
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
  vi.mocked(responseAnswerIsCorrect).mockClear();
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
  expect(responseAnswerIsCorrect).not.toHaveBeenCalled();
  expect(store.getState().checkAnswer.trial1_0?.correct).toBe(true);
});

describe('ResponseBlock with real navigation effects', () => {
  const autoConfig = {
    type: 'questionnaire',
    provideFeedback: true,
    correctAnswer: [{ id: 'q1', answer: 'correct' }],
    response: [{
      id: 'q1',
      type: 'buttons',
      prompt: 'Choose',
      options: ['correct', 'wrong'],
      autoAdvanceToNextStep: true,
      autoAdvanceDelay: 250,
    }],
  } satisfies IndividualComponent;

  afterEach(() => { vi.useRealTimers(); });

  test.each(['inherited Previous', 'first dynamic item'] as const)('restored finalized trials allow manual continuation after returning from %s', async (returnPath) => {
    realNextButton.enabled = true;
    const dynamic = returnPath === 'first dynamic item';
    const followingConfig: StudyConfig = {
      ...storeConfig,
      baseComponents: { withPrevious: { type: 'questionnaire', previousButton: true, response: [] } },
      components: { ...storeConfig.components, following: { baseComponent: 'withPrevious' } },
      sequence: {
        order: 'fixed',
        components: ['trial1', dynamic ? { id: 'dynamic', order: 'dynamic', functionPath: 'test.js' } : 'following'],
      },
    };
    vi.mocked(useStudyConfig).mockReturnValue(followingConfig);
    const sequence: Sequence = {
      ...storeSequence,
      components: ['trial1', dynamic ? {
        id: 'dynamic', order: 'dynamic', orderPath: 'root-1', components: ['following'], skip: [],
      } : 'following'],
    };
    const status = makeStoredAnswer({ identifier: 'trial1_0', answer: { q1: 'correct' }, endTime: 100 });
    const studyStore = await studyStoreCreator('test-study', followingConfig, sequence, metadata, { trial1_0: status }, modes, 'p1', false, false);
    mockRoute.step = 1;
    mockRoute.funcIndex = dynamic ? encryptIndex(0) : undefined;
    const previous = renderHook(() => usePreviousStep(), { wrapper: ({ children }) => withStore(studyStore, children) });
    act(() => {
      studyStore.store.dispatch(studyStore.actions.setClickedPrevious(true));
      previous.result.current.goToPreviousStep();
    });
    expect(mockNavigate).toHaveBeenLastCalledWith(`/test-study/${encryptIndex(0)}`);
    previous.unmount();
    mockNavigate.mockClear();
    mockRoute.step = 0;
    mockRoute.funcIndex = undefined;
    mockAnswerField.values = { q1: 'correct' };
    vi.useFakeTimers();
    const returnConfig: IndividualComponent = {
      ...autoConfig,
      provideFeedback: false,
      nextButtonHidden: true,
      response: [{ ...autoConfig.response[0], allowResponseChange: false }],
    };
    const view = render(withStore(studyStore, <ResponseBlock config={returnConfig} location="belowStimulus" status={status} />));
    expect(capturedSwitcherProps.answerFinalized).toBe(true);
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(findButton(view.container, 'Next')).toBeDefined();
    act(() => publishAutoAdvanceSelection({
      identifier: 'trial1_0', responseId: 'q1', selected: true, delay: 250,
    }));
    expect(findButton(view.container, 'Next')).toBeUndefined();
    act(() => publishAutoAdvanceSelection({
      identifier: 'trial1_0', responseId: 'q1', selected: false, delay: 0,
    }));
    const next = findButton(view.container, 'Next');
    expect(next).toBeDefined();
    expect(next.disabled).toBe(false);
    act(() => fireEvent.click(next));
    expect(mockNavigate).toHaveBeenLastCalledWith(`/test-study/${encryptIndex(1)}`);
  });

  test.each(['answer=correct', 'answer=', ''])('keeps Next available only for a supplied paramCapture answer (%s)', async (query) => {
    realNextButton.enabled = true;
    mockSearchParams.value = query;
    const studyStore = await makeStudyStore();
    vi.useFakeTimers();
    mockAnswerField.values = { q1: query === 'answer=correct' ? 'correct' : '' };
    const capturedConfig: IndividualComponent = {
      ...autoConfig,
      provideFeedback: false,
      response: [{ ...autoConfig.response[0], paramCapture: 'answer' }],
    };
    const { container } = render(withStore(studyStore, <ResponseBlock config={capturedConfig} location="belowStimulus" />));
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(mockNavigate).not.toHaveBeenCalled();
    const next = findButton(container, 'Next');
    if (query === 'answer=correct') {
      expect(next).toBeDefined();
      expect(next.disabled).toBe(false);
      act(() => fireEvent.click(next));
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(studyStore.store.getState().answers.trial1_0.answer).toEqual({ q1: 'correct' });
    } else {
      expect(next).toBeUndefined();
    }
  });

  test('grading a ready selection persists the completed trial last', async () => {
    realNextButton.enabled = true;
    const studyStore = await makeStudyStore();
    vi.useFakeTimers();
    mockAnswerField.values = { q1: 'correct' };
    const { container } = render(withStore(studyStore, <ResponseBlock config={autoConfig} location="belowStimulus" />));
    act(() => publishAutoAdvanceSelection({
      identifier: 'trial1_0', responseId: 'q1', selected: true, delay: 250,
    }));
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(mockNavigate).not.toHaveBeenCalled();
    act(() => fireEvent.click(findButton(container, 'Check Answer')));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(studyStore.store.getState().answers.trial1_0.endTime).toBeGreaterThan(0);
    expect(mockSaveAnswers).toHaveBeenLastCalledWith(expect.objectContaining({
      trial1_0: expect.objectContaining({
        endTime: studyStore.store.getState().answers.trial1_0.endTime,
        answer: { q1: 'correct' },
        checkAnswer: { attemptsUsed: 1, correct: true, responses: { q1: true } },
      }),
    }));
  });

  test.each([false, true])('restored grading exposes continuation without a new selection (failed=%s)', async (failed) => {
    realNextButton.enabled = true;
    mockStoredAnswerData.checkAnswer = { attemptsUsed: failed ? 2 : 1, correct: !failed, responses: { q1: !failed } };
    mockAnswerField.values = { q1: failed ? 'wrong' : 'correct' };
    const { container } = await renderWithStore(<ResponseBlock config={autoConfig} location="belowStimulus" />);
    expect(findButton(container, 'Check Answer').disabled).toBe(true);
    const next = findButton(container, 'Next');
    expect(next).toBeDefined();
    expect(next.disabled).toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
    act(() => fireEvent.click(next));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  test('a conditionally hidden auto response exposes Next and cancels pending advancement', async () => {
    realNextButton.enabled = true;
    vi.mocked(isEqual).mockImplementation((left, right) => left === right);
    mockStoredAnswerData.formOrder = undefined;
    const studyStore = await makeStudyStore();
    vi.useFakeTimers();
    const conditionalConfig: IndividualComponent = {
      ...autoConfig,
      provideFeedback: false,
      response: [
        {
          id: 'controller', type: 'radio', prompt: 'Controller', options: ['yes', 'no'],
        },
        { ...autoConfig.response[0], visibleIf: { responseId: 'controller', comparison: 'equals', value: 'yes' } },
      ],
    };
    mockAnswerField.values = { controller: 'yes', q1: 'correct' };
    const view = render(withStore(studyStore, <ResponseBlock config={conditionalConfig} location="belowStimulus" />));
    expect(findButton(view.container, 'Next')).toBeUndefined();
    act(() => publishAutoAdvanceSelection({
      identifier: 'trial1_0', responseId: 'q1', selected: true, delay: 250,
    }));
    mockAnswerField.values = { controller: 'no', q1: 'correct' };
    view.rerender(withStore(studyStore, <ResponseBlock config={conditionalConfig} location="belowStimulus" />));
    expect(findButton(view.container, 'Next')).toBeDefined();
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
