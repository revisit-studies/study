import { ReactNode } from 'react';
import {
  render, act, fireEvent, cleanup,
} from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import type { IndividualComponent } from '../../../parser/types';
import { ResponseBlock } from '../ResponseBlock';
import { makeStoredAnswer } from '../../../tests/utils';
import { responseAnswerIsCorrect } from '../../../utils/correctAnswer';

// ── mocks ────────────────────────────────────────────────────────────────────

const { saveIncorrectAnswerSpy, mockStoreState } = vi.hoisted(() => ({
  saveIncorrectAnswerSpy: vi.fn((v: unknown) => v),
  mockStoreState: {
    responseSubmitAttempted: { trial1_0: false } as Record<string, boolean>,
  },
}));

vi.mock('@mantine/core', () => ({
  Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
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

vi.mock('../../../store/store', () => ({
  useFlatSequence: vi.fn(() => [{ id: 'trial1', component: 'trial1' }]),
  useStoreDispatch: vi.fn(() => vi.fn()),
  useStoreActions: vi.fn(() => ({
    updateResponseBlockValidation: vi.fn((v: unknown) => v),
    saveIncorrectAnswer: saveIncorrectAnswerSpy,
    setResponseSubmitAttempt: vi.fn((v: unknown) => v),
    setStimulusSubmitAttempt: vi.fn((v: unknown) => v),
  })),
  useStoreSelector: vi.fn((selector: (s: Record<string, unknown>) => unknown) => selector({
    answers: {},
    analysisProvState: {},
    clickedPrevious: false,
    modes: { dataCollectionEnabled: true },
    reactiveAnswers: {},
    matrixAnswers: {},
    rankingAnswers: {},
    responseSubmitAttempted: mockStoreState.responseSubmitAttempted,
    sequence: {
      order: 'fixed', orderPath: '', components: [], skip: [],
    },
    trialValidation: { trial1_0: {} },
    completed: false,
  })),
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
  useStoredAnswer: vi.fn(() => ({
    formOrder: { response: ['q1'] },
    questionOrders: {},
    optionOrders: {},
  })),
}));

vi.mock('../../../store/hooks/useWindowEvents', () => ({
  useWindowEvents: vi.fn(() => ({ current: [] })),
}));

vi.mock('../../../routes/utils', () => ({
  useCurrentStep: vi.fn(() => 0),
  useCurrentIdentifier: vi.fn(() => 'trial1_0'),
  useStudyId: vi.fn(() => 'test-study'),
}));

vi.mock('../utils', () => ({
  generateInitFields: vi.fn(() => ({})),
  mergeReactiveAnswers: vi.fn((_: unknown, values: unknown) => values),
  useAnswerField: vi.fn(() => ({
    values: {},
    isValid: vi.fn(() => true),
    setValues: vi.fn(),
    setInitialValues: vi.fn(),
    reset: vi.fn(),
    getInputProps: vi.fn(() => ({ value: '', onChange: vi.fn() })),
  })),
  usesStandaloneDontKnowField: vi.fn(() => false),
}));

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
  FeedbackAlert: ({ response, alertConfig }: { response: { id: string }; alertConfig: Record<string, { visible: boolean }> }) => (
    alertConfig[response.id]?.visible ? <div data-testid={`feedback-alert-${response.id}`} /> : null
  ),
}));

vi.mock('../../NextButton', () => ({
  NextButton: ({ label, disabled, checkAnswer }: { label?: string; disabled?: boolean; checkAnswer?: ReactNode }) => (
    <div>
      {checkAnswer}
      <button type="button" disabled={disabled}>{label}</button>
    </div>
  ),
}));

// ── fixture ───────────────────────────────────────────────────────────────────

const baseConfig: IndividualComponent = {
  type: 'questionnaire',
  response: [
    {
      type: 'shortText', id: 'q1', prompt: 'Question 1', required: false,
    },
  ],
};

// ── ResponseBlock ─────────────────────────────────────────────────────────────

beforeEach(() => {
  saveIncorrectAnswerSpy.mockClear();
  vi.mocked(responseAnswerIsCorrect).mockReturnValue(true);
  mockStoreState.responseSubmitAttempted = { trial1_0: false };
});

// Unmount between tests so window keydown listeners from prior renders don't leak
afterEach(() => cleanup());

describe('ResponseBlock', () => {
  test('renders without error', () => {
    const html = renderToStaticMarkup(
      <ResponseBlock config={baseConfig} location="belowStimulus" />,
    );
    expect(html).toContain('<div');
  });

  test('renders ResponseSwitcher for response at matching location', () => {
    const html = renderToStaticMarkup(
      <ResponseBlock config={baseConfig} location="belowStimulus" />,
    );
    expect(html).toContain('switcher-shortText');
  });

  test('shows NextButton when location matches nextButtonLocation', () => {
    const html = renderToStaticMarkup(
      <ResponseBlock config={baseConfig} location="belowStimulus" />,
    );
    expect(html).toContain('Next');
  });

  test('omits NextButton when location does not match nextButtonLocation', () => {
    const html = renderToStaticMarkup(
      <ResponseBlock config={baseConfig} location="sidebar" />,
    );
    expect(html).not.toContain('Next');
  });

  test('skips ResponseSwitcher when response is hidden', () => {
    const hiddenConfig = {
      ...baseConfig,
      response: [
        {
          type: 'shortText', id: 'q1', prompt: 'Q1', required: false, hidden: true,
        },
      ],
    } as IndividualComponent;
    const html = renderToStaticMarkup(
      <ResponseBlock config={hiddenConfig} location="belowStimulus" />,
    );
    expect(html).not.toContain('switcher-shortText');
  });

  test('renders with provided style prop without error', () => {
    const html = renderToStaticMarkup(
      <ResponseBlock config={baseConfig} location="belowStimulus" style={{ color: 'red' }} />,
    );
    expect(html).toContain('switcher-shortText');
  });

  test('uses custom nextButtonText from config', () => {
    const configWithText = {
      ...baseConfig,
      nextButtonText: 'Submit',
    } as IndividualComponent;
    const html = renderToStaticMarkup(
      <ResponseBlock config={configWithText} location="belowStimulus" />,
    );
    expect(html).toContain('Submit');
  });

  test('renders Check Answer button when provideFeedback and correctAnswer exist', () => {
    const configWithFeedback = {
      ...baseConfig,
      provideFeedback: true,
      correctAnswer: [{ id: 'q1', answer: 'correct' }],
    } as IndividualComponent;
    const html = renderToStaticMarkup(
      <ResponseBlock config={configWithFeedback} location="belowStimulus" />,
    );
    expect(html).toContain('Check Answer');
  });

  test('does not add required=true for textOnly responses', () => {
    const textOnlyConfig = {
      type: 'questionnaire',
      response: [{ type: 'textOnly', id: 'q1', prompt: 'Read this.' }],
    } as IndividualComponent;
    const html = renderToStaticMarkup(
      <ResponseBlock config={textOnlyConfig} location="belowStimulus" />,
    );
    expect(html).toContain('switcher-textOnly');
  });

  test('initialises from status.answer when status prop is provided', () => {
    const status = makeStoredAnswer({ answer: { q1: 'hello' } });
    // render (not SSR) so useEffect fires and reads status.answer
    const { container } = render(
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
    const { container } = render(
      <ResponseBlock config={configWithFeedback} location="belowStimulus" />,
    );
    const checkBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Check Answer',
    );
    await act(async () => { fireEvent.click(checkBtn!); });
    // After a correct answer the Check Answer button should become disabled
    expect(checkBtn).toHaveProperty('disabled', true);
  });

  test('nextOnEnter=true registers keydown listener that fires checkAnswerProvideFeedback', async () => {
    const configWithEnter = {
      ...baseConfig,
      nextOnEnter: true,
      provideFeedback: true,
      correctAnswer: [{ id: 'q1', answer: 'correct' }],
    } as IndividualComponent;
    render(<ResponseBlock config={configWithEnter} location="belowStimulus" />);
    await act(async () => { fireEvent.keyDown(window, { key: 'Enter' }); });
    // Verifies the listener registered without throwing
  });
});

// ── focus recovery on validation errors ──────────────────────────────────────

describe('ResponseBlock focus recovery', () => {
  // jsdom implements neither CSS.escape (used by scrollToFirstUnresolvedQuestion)
  // nor scrollIntoView, so stub both and restore after each test to avoid leaking
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

  test('revealing unanswered errors scrolls to and focuses the first unresolved question', () => {
    mockStoreState.responseSubmitAttempted = { trial1_0: true };
    const requiredConfig = {
      type: 'questionnaire',
      response: [
        {
          type: 'shortText', id: 'q1', prompt: 'Q1', required: true,
        },
      ],
    } as IndividualComponent;
    const { container } = render(
      <ResponseBlock config={requiredConfig} location="belowStimulus" />,
    );
    expect(scrollSpy).toHaveBeenCalled();
    const control = container.querySelector('[data-question-id="q1"] input');
    expect(control).toBeTruthy();
    expect(document.activeElement).toBe(control);
  });

  test('does not move focus while there are no validation errors', () => {
    const requiredConfig = {
      type: 'questionnaire',
      response: [
        {
          type: 'shortText', id: 'q1', prompt: 'Q1', required: true,
        },
      ],
    } as IndividualComponent;
    render(<ResponseBlock config={requiredConfig} location="belowStimulus" />);
    expect(scrollSpy).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.body);
  });
});

// ── keyboard Check Answer (issue #1237) ──────────────────────────────────────

describe('ResponseBlock keyboard Check Answer', () => {
  const feedbackEnterConfig = {
    ...baseConfig,
    nextOnEnter: true,
    provideFeedback: true,
    correctAnswer: [{ id: 'q1', answer: 'correct' }],
  } as IndividualComponent;

  test('one Enter press shows one feedback alert and saves one incorrect answer across all mounted locations', async () => {
    vi.mocked(responseAnswerIsCorrect).mockReturnValue(false);
    const { container } = render(
      <>
        <ResponseBlock config={feedbackEnterConfig} location="aboveStimulus" />
        <ResponseBlock config={feedbackEnterConfig} location="belowStimulus" />
        <ResponseBlock config={feedbackEnterConfig} location="sidebar" />
      </>,
    );
    await act(async () => { fireEvent.keyDown(window, { key: 'Enter' }); });
    expect(container.querySelectorAll('[data-testid="feedback-alert-q1"]')).toHaveLength(1);
    expect(saveIncorrectAnswerSpy).toHaveBeenCalledTimes(1);
  });

  test('non-owner response block ignores Enter', async () => {
    vi.mocked(responseAnswerIsCorrect).mockReturnValue(false);
    const { container } = render(
      <ResponseBlock config={feedbackEnterConfig} location="sidebar" />,
    );
    await act(async () => { fireEvent.keyDown(window, { key: 'Enter' }); });
    expect(container.querySelectorAll('[data-testid="feedback-alert-q1"]')).toHaveLength(0);
    expect(saveIncorrectAnswerSpy).not.toHaveBeenCalled();
  });

  test('Enter pressed inside a textarea does not trigger Check Answer', async () => {
    vi.mocked(responseAnswerIsCorrect).mockReturnValue(false);
    const { container } = render(
      <ResponseBlock config={feedbackEnterConfig} location="belowStimulus" />,
    );
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    try {
      await act(async () => { fireEvent.keyDown(textarea, { key: 'Enter' }); });
      expect(container.querySelectorAll('[data-testid="feedback-alert-q1"]')).toHaveLength(0);
      expect(saveIncorrectAnswerSpy).not.toHaveBeenCalled();
    } finally {
      document.body.removeChild(textarea);
    }
  });

  test('Enter stops counting attempts once training attempts are exhausted', async () => {
    // uiConfig mock sets trainingAttempts: 2
    vi.mocked(responseAnswerIsCorrect).mockReturnValue(false);
    render(<ResponseBlock config={feedbackEnterConfig} location="belowStimulus" />);
    await act(async () => { fireEvent.keyDown(window, { key: 'Enter' }); });
    await act(async () => { fireEvent.keyDown(window, { key: 'Enter' }); });
    await act(async () => { fireEvent.keyDown(window, { key: 'Enter' }); });
    expect(saveIncorrectAnswerSpy).toHaveBeenCalledTimes(2);
  });

  test('Enter on the focused Check Answer button defers to its synthesized click (no double handling)', async () => {
    vi.mocked(responseAnswerIsCorrect).mockReturnValue(false);
    const { container } = render(
      <ResponseBlock config={feedbackEnterConfig} location="belowStimulus" />,
    );
    const checkBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Check Answer',
    )!;
    // the browser synthesizes a click for Enter on a focused button, so the
    // global handler must skip the keydown
    await act(async () => { fireEvent.keyDown(checkBtn, { key: 'Enter' }); });
    expect(saveIncorrectAnswerSpy).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(checkBtn); });
    expect(saveIncorrectAnswerSpy).toHaveBeenCalledTimes(1);
  });

  test('Enter after a correct answer does not re-run feedback', async () => {
    const { container } = render(
      <ResponseBlock config={feedbackEnterConfig} location="belowStimulus" />,
    );
    await act(async () => { fireEvent.keyDown(window, { key: 'Enter' }); });
    const checkBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Check Answer',
    );
    expect(checkBtn).toHaveProperty('disabled', true);
    await act(async () => { fireEvent.keyDown(window, { key: 'Enter' }); });
    expect(container.querySelectorAll('[data-testid="feedback-alert-q1"]')).toHaveLength(1);
    expect(saveIncorrectAnswerSpy).not.toHaveBeenCalled();
  });
});
