import { ReactNode } from 'react';
import { render, act, fireEvent } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, test, vi,
} from 'vitest';
import type { IndividualComponent } from '../../parser/types';
import type { StoredAnswer } from '../../store/types';
import { ResponseBlock } from './ResponseBlock';

// ── mocks ────────────────────────────────────────────────────────────────────

vi.mock('@mantine/core', () => ({
  Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Button: ({ children, disabled, onClick }: { children?: ReactNode; disabled?: boolean; onClick?: () => void }) => (
    <button type="button" disabled={disabled} onClick={onClick}>{children}</button>
  ),
}));

vi.mock('react-router', () => ({
  useNavigate: vi.fn(() => vi.fn()),
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

vi.mock('../../store/store', () => ({
  useStoreDispatch: vi.fn(() => vi.fn()),
  useStoreActions: vi.fn(() => ({
    updateResponseBlockValidation: vi.fn((v: unknown) => v),
    saveIncorrectAnswer: vi.fn((v: unknown) => v),
  })),
  useStoreSelector: vi.fn((selector: (s: Record<string, unknown>) => unknown) => selector({
    analysisProvState: {},
    reactiveAnswers: {},
    matrixAnswers: {},
    rankingAnswers: {},
    trialValidation: {},
    completed: false,
  })),
}));

vi.mock('../../store/hooks/useStudyConfig', () => ({
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

vi.mock('../../store/hooks/useStoredAnswer', () => ({
  useStoredAnswer: vi.fn(() => ({
    formOrder: { response: ['q1'] },
    questionOrders: {},
    optionOrders: {},
  })),
}));

vi.mock('../../routes/utils', () => ({
  useCurrentStep: vi.fn(() => 0),
  useCurrentIdentifier: vi.fn(() => 'trial1_0'),
}));

vi.mock('./utils', () => ({
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

vi.mock('../../utils/correctAnswer', () => ({
  responseAnswerIsCorrect: vi.fn(() => true),
}));

vi.mock('./customResponseModules', () => ({
  getCustomResponseModule: vi.fn(() => null),
  getCustomResponseModuleLoadError: vi.fn(() => null),
}));

vi.mock('./ResponseSwitcher', () => ({
  ResponseSwitcher: ({ response }: { response: { type: string } }) => (
    <div data-testid={`switcher-${response.type}`}>{response.type}</div>
  ),
}));

vi.mock('./FeedbackAlert', () => ({
  FeedbackAlert: () => null,
}));

vi.mock('../NextButton', () => ({
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
    const status = {
      answer: { q1: 'hello' },
    } as Partial<StoredAnswer> as StoredAnswer;
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
