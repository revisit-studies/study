import { ReactNode } from 'react';
import { Provider } from 'react-redux';
import {
  render, act, fireEvent, cleanup,
} from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import type { IndividualComponent, StudyConfig } from '../../../parser/types';
import type { CheckAnswerState, Sequence } from '../../../store/types';
import type { REVISIT_MODE } from '../../../storage/engines/types';
import { studyStoreCreator, StudyStoreContext } from '../../../store/store';
import { ResponseBlock } from '../ResponseBlock';
import { makeStoredAnswer } from '../../../tests/utils';
import { responseAnswerIsCorrect } from '../../../utils/correctAnswer';

// ── mocks ────────────────────────────────────────────────────────────────────

const { mockStoredAnswerData, capturedNextButtonProps, mockIsAnalysis } = vi.hoisted(() => ({
  mockStoredAnswerData: {
    formOrder: { response: ['q1'] },
    questionOrders: {},
    optionOrders: {},
    responseSubmitAttempted: undefined as boolean | undefined,
    checkAnswer: undefined as { attemptsUsed: number; correct: boolean; responses: Record<string, boolean> } | undefined,
  },
  capturedNextButtonProps: {
    onCheckAnswer: undefined as (() => void) | undefined,
  },
  mockIsAnalysis: { value: false },
}));

vi.mock('@mantine/core', () => ({
  Box: ({ children, className }: { children?: ReactNode; className?: string }) => <div className={className}>{children}</div>,
  Button: ({ children, disabled, onClick }: { children?: ReactNode; disabled?: boolean; onClick?: () => void }) => (
    <button type="button" disabled={disabled} onClick={onClick}>{children}</button>
  ),
  Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  ThemeIcon: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));

vi.mock('react-router', () => ({
  useNavigate: vi.fn(() => vi.fn()),
  useParams: vi.fn(() => ({})),
  useSearchParams: vi.fn(() => [new URLSearchParams()]),
}));

vi.mock('@trrack/core', () => ({
  Registry: {
    create: vi.fn(() => ({ register: vi.fn(() => vi.fn()) })),
  },
  initializeTrrack: vi.fn(() => ({
    apply: vi.fn(),
    graph: { backend: {} },
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
  useCurrentStep: vi.fn(() => 0),
  useCurrentIdentifier: vi.fn(() => 'trial1_0'),
  useStudyId: vi.fn(() => 'test-study'),
}));

vi.mock('../utils', () => {
  const answerField = {
    values: {},
    isValid: vi.fn(() => true),
    setValues: vi.fn(),
    setInitialValues: vi.fn(),
    reset: vi.fn(),
    getInputProps: vi.fn(() => ({ value: '', onChange: vi.fn() })),
  };
  return {
    generateInitFields: vi.fn(() => ({})),
    mergeReactiveAnswers: vi.fn((_: unknown, values: unknown) => values),
    useAnswerField: vi.fn(() => answerField),
    usesStandaloneDontKnowField: vi.fn(() => false),
  };
});

vi.mock('../../../utils/correctAnswer', () => ({
  responseAnswerIsCorrect: vi.fn(() => true),
}));

vi.mock('../customResponseModules', () => ({
  getCustomResponseModule: vi.fn(() => null),
  getCustomResponseModuleLoadError: vi.fn(() => null),
}));

vi.mock('../ResponseSwitcher', () => ({
  ResponseSwitcher: ({ response }: { response: { id: string; type: string } }) => (
    <div data-testid={`switcher-${response.type}`}>
      {response.type}
      <input data-testid={`control-${response.id}`} />
    </div>
  ),
}));

vi.mock('../FeedbackAlert', () => ({
  FeedbackAlert: ({ response, alertConfig }: { response: { id: string }; alertConfig: Record<string, { visible: boolean; title: string }> }) => (
    alertConfig[response.id]?.visible ? <div data-testid={`feedback-alert-${response.id}`} data-title={alertConfig[response.id].title} /> : null
  ),
}));

vi.mock('../../NextButton', () => ({
  NextButton: ({
    label, disabled, checkAnswer, onCheckAnswer,
  }: { label?: string; disabled?: boolean; checkAnswer?: ReactNode; onCheckAnswer?: () => void }) => {
    capturedNextButtonProps.onCheckAnswer = onCheckAnswer;
    return (
      <div>
        {checkAnswer}
        <button type="button" disabled={disabled}>{label}</button>
      </div>
    );
  },
}));

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

async function makeStudyStore(): Promise<StudyStore> {
  return studyStoreCreator('test-study', storeConfig, storeSequence, metadata, {}, modes, 'p1', false, false);
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

// ── setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(responseAnswerIsCorrect).mockReturnValue(true);
  mockStoredAnswerData.formOrder = { response: ['q1'] };
  mockStoredAnswerData.responseSubmitAttempted = undefined;
  mockStoredAnswerData.checkAnswer = undefined;
  capturedNextButtonProps.onCheckAnswer = undefined;
  mockIsAnalysis.value = false;
});

// Unmount between tests so window keydown listeners from prior renders don't leak
afterEach(() => cleanup());

// ── ResponseBlock ─────────────────────────────────────────────────────────────

describe('ResponseBlock', () => {
  test('renders without error', async () => {
    const studyStore = await makeStudyStore();
    const html = renderToStaticMarkup(withStore(studyStore, <ResponseBlock config={baseConfig} location="belowStimulus" />));
    expect(html).toContain('<div');
  });

  test('renders ResponseSwitcher for response at matching location', async () => {
    const studyStore = await makeStudyStore();
    const html = renderToStaticMarkup(withStore(studyStore, <ResponseBlock config={baseConfig} location="belowStimulus" />));
    expect(html).toContain('switcher-shortText');
  });

  test('shows NextButton when location matches nextButtonLocation', async () => {
    const studyStore = await makeStudyStore();
    const html = renderToStaticMarkup(withStore(studyStore, <ResponseBlock config={baseConfig} location="belowStimulus" />));
    expect(html).toContain('Next');
  });

  test('omits NextButton when location does not match nextButtonLocation', async () => {
    const studyStore = await makeStudyStore();
    const html = renderToStaticMarkup(withStore(studyStore, <ResponseBlock config={baseConfig} location="sidebar" />));
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
    const html = renderToStaticMarkup(withStore(studyStore, <ResponseBlock config={hiddenConfig} location="belowStimulus" />));
    expect(html).not.toContain('switcher-shortText');
  });

  test('renders with provided style prop without error', async () => {
    const studyStore = await makeStudyStore();
    const html = renderToStaticMarkup(withStore(studyStore, <ResponseBlock config={baseConfig} location="belowStimulus" style={{ color: 'red' }} />));
    expect(html).toContain('switcher-shortText');
  });

  test('uses custom nextButtonText from config', async () => {
    const configWithText = {
      ...baseConfig,
      nextButtonText: 'Submit',
    } as IndividualComponent;
    const studyStore = await makeStudyStore();
    const html = renderToStaticMarkup(withStore(studyStore, <ResponseBlock config={configWithText} location="belowStimulus" />));
    expect(html).toContain('Submit');
  });

  test('renders Check Answer button when provideFeedback and correctAnswer exist', async () => {
    const configWithFeedback = {
      ...baseConfig,
      provideFeedback: true,
      correctAnswer: [{ id: 'q1', answer: 'correct' }],
    } as IndividualComponent;
    const studyStore = await makeStudyStore();
    const html = renderToStaticMarkup(withStore(studyStore, <ResponseBlock config={configWithFeedback} location="belowStimulus" />));
    expect(html).toContain('Check Answer');
  });

  test('does not add required=true for textOnly responses', async () => {
    const textOnlyConfig = {
      type: 'questionnaire',
      response: [{ type: 'textOnly', id: 'q1', prompt: 'Read this.' }],
    } as IndividualComponent;
    const studyStore = await makeStudyStore();
    const html = renderToStaticMarkup(withStore(studyStore, <ResponseBlock config={textOnlyConfig} location="belowStimulus" />));
    expect(html).toContain('switcher-textOnly');
  });

  test('initialises from status.answer when status prop is provided', async () => {
    const status = makeStoredAnswer({ answer: { q1: 'hello' } });
    // render (not SSR) so useEffect fires and reads status.answer
    const { container } = await renderWithStore(
      <ResponseBlock config={baseConfig} location="belowStimulus" status={status} />,
    );
    expect(container.querySelector('div')).toBeTruthy();
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
    const checkBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Check Answer',
    );
    await act(async () => { fireEvent.click(checkBtn!); });
    // After a correct answer the Check Answer button should become disabled
    expect(checkBtn).toHaveProperty('disabled', true);
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
    const nextButtons = Array.from(container.querySelectorAll('button')).filter((b) => b.textContent === 'Next');
    expect(nextButtons).toHaveLength(1);
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
    expect(Array.from(container.querySelectorAll('button')).filter((b) => b.textContent === 'Next')).toHaveLength(0);
    expect(capturedNextButtonProps.onCheckAnswer).toBeUndefined();
  });

  test('does not pass onCheckAnswer after all attempts are used', async () => {
    // uiConfig mock sets trainingAttempts: 2
    vi.mocked(responseAnswerIsCorrect).mockReturnValue(false);
    const { store } = await renderWithStore(<ResponseBlock config={feedbackEnterConfig} location="belowStimulus" />);
    await act(async () => { capturedNextButtonProps.onCheckAnswer?.(); });
    await act(async () => { capturedNextButtonProps.onCheckAnswer?.(); });
    expect(store.getState().checkAnswer.trial1_0.attemptsUsed).toBe(2);
    expect(capturedNextButtonProps.onCheckAnswer).toBeUndefined();
    expect(incorrectCount(store)).toBe(2);
  });

  test('does not pass onCheckAnswer after a correct answer', async () => {
    const { container, store } = await renderWithStore(
      <ResponseBlock config={feedbackEnterConfig} location="belowStimulus" />,
    );
    await act(async () => { capturedNextButtonProps.onCheckAnswer?.(); });
    const checkBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Check Answer',
    );
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
    expect(Array.from(container.querySelectorAll('button')).filter((b) => b.textContent === 'Next')).toHaveLength(1);
    expect(capturedNextButtonProps.onCheckAnswer).toBeUndefined();
  });

  test('does not pass onCheckAnswer when there is no correct answer feedback', async () => {
    const { container } = await renderWithStore(
      <ResponseBlock config={{ ...baseConfig, nextOnEnter: true } as IndividualComponent} location="belowStimulus" />,
    );
    expect(Array.from(container.querySelectorAll('button')).filter((b) => b.textContent === 'Next')).toHaveLength(1);
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
    const checkBtn = Array.from(first.container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Check Answer',
    )!;
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
    const checkBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Check Answer',
    );
    expect(checkBtn).toHaveProperty('disabled', true);
    expect(container.querySelectorAll('[data-testid="feedback-alert-q1"]')).toHaveLength(1);
  });

  test('legacy stored answers without checkAnswer behave as before (no seed)', async () => {
    const { container, store } = await renderWithStore(
      <ResponseBlock config={feedbackConfig} location="belowStimulus" />,
    );
    expect(store.getState().checkAnswer.trial1_0).toBeUndefined();
    const checkBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Check Answer',
    );
    expect(checkBtn).toHaveProperty('disabled', false);
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
  test('trainingAttempts: -1 never disables Check Answer and Next unlocks after the first check', async () => {
    vi.mocked(responseAnswerIsCorrect).mockReturnValue(false);
    const unlimitedConfig = {
      ...baseConfig,
      provideFeedback: true,
      correctAnswer: [{ id: 'q1', answer: 'correct' }],
      trainingAttempts: -1,
    } as IndividualComponent;
    const { container, store } = await renderWithStore(
      <ResponseBlock config={unlimitedConfig} location="belowStimulus" />,
    );
    const checkBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Check Answer',
    )!;
    await act(async () => { fireEvent.click(checkBtn); });
    await act(async () => { fireEvent.click(checkBtn); });
    await act(async () => { fireEvent.click(checkBtn); });
    expect(store.getState().checkAnswer.trial1_0.attemptsUsed).toBe(3);
    expect(checkBtn).toHaveProperty('disabled', false);
    expect(container.querySelector('[data-testid="feedback-alert-q1"]')?.getAttribute('data-title')).toBe('Incorrect Answer');
    const nextBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Next',
    )!;
    expect(nextBtn).toHaveProperty('disabled', false);
  });
});
