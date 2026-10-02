import { ReactNode } from 'react';
import {
  render, cleanup, fireEvent, act,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import type { IndividualComponent, JsonValue, Response } from '../../../parser/types';
import { ResponseSwitcher } from '../ResponseSwitcher';
import { useAutoAdvanceSelection } from '../autoAdvanceEvents';
import { NextButton } from '../../NextButton';

// ── mocks ────────────────────────────────────────────────────────────────────

const {
  capturedStringInputProps, mockIsAnalysis, mockStoreState, mockCurrentComponent, mockGoToNextStep,
} = vi.hoisted(() => ({
  capturedStringInputProps: {
    disabled: undefined as boolean | undefined,
    answer: undefined as { value?: unknown; readOnly?: boolean } | undefined,
  },
  mockIsAnalysis: { value: false },
  mockStoreState: {
    sequence: {
      order: 'fixed', orderPath: 'root', components: ['trial1'], skip: [],
    },
    completed: false,
    answers: {},
  },
  mockCurrentComponent: { value: '' },
  mockGoToNextStep: vi.fn(() => true),
}));

vi.mock('@mantine/core', () => ({
  Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Checkbox: () => <input type="checkbox" />,
  Divider: () => <hr />,
  Flex: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  FocusTrap: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Alert: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Button: ({ children, disabled, onClick }: { children?: ReactNode; disabled?: boolean; onClick?: () => void }) => (
    <button type="button" disabled={disabled} onClick={onClick}>{children}</button>
  ),
  Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Radio: Object.assign(
    ({ children, value, ...props }: { children?: ReactNode; value?: string; [key: string]: unknown }) => (
      <div data-value={value} {...props}>{children}</div>
    ),
    {
      Group: ({ children, onChange }: { children?: ReactNode; onChange?: (value: string) => void }) => {
        const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
          const card = (event.target as HTMLElement).closest('[data-radio-card]');
          if (card) onChange?.(card.getAttribute('data-value') || '');
        };

        return <div onClick={handleClick}>{children}</div>;
      },
      Card: ({ children, value, ...props }: { children?: ReactNode; value?: string; [key: string]: unknown }) => (
        <button type="button" data-radio-card data-value={value} {...props}>{children}</button>
      ),
    },
  ),
}));

vi.mock('react-router', () => ({
  useSearchParams: vi.fn(() => [new URLSearchParams()]),
  useParams: vi.fn(() => ({})),
  useNavigate: vi.fn(() => vi.fn()),
}));

vi.mock('@tabler/icons-react', () => ({
  IconInfoCircle: () => null,
  IconAlertTriangle: () => null,
}));

vi.mock('../../../store/hooks/useNextStep', () => ({
  useNextStep: vi.fn(() => ({ isNextDisabled: false, goToNextStep: mockGoToNextStep })),
}));

vi.mock('../../../store/hooks/useStudyConfig', () => ({
  useStudyConfig: vi.fn(() => ({ uiConfig: {}, components: {} })),
}));

vi.mock('../../../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: vi.fn(() => mockIsAnalysis.value),
}));

vi.mock('../../../routes/utils', () => ({
  useCurrentStep: vi.fn(() => 0),
  useCurrentIdentifier: vi.fn(() => 'trial1_0'),
  useCurrentComponent: vi.fn(() => mockCurrentComponent.value),
}));

vi.mock('../../../utils/fetchStylesheet', () => ({
  useFetchStylesheet: vi.fn(),
}));

vi.mock('../../../store/store', () => ({
  useStoreSelector: vi.fn((selector: (state: unknown) => unknown) => selector(mockStoreState)),
  useFlatSequence: vi.fn(() => []),
}));

vi.mock('../CustomResponseInput', () => ({
  CustomResponseInput: () => null,
}));

vi.mock('../StringInput', () => ({
  StringInput: ({ disabled, answer }: { disabled: boolean; answer: { value?: unknown; readOnly?: boolean } }) => {
    capturedStringInputProps.disabled = disabled;
    capturedStringInputProps.answer = answer;
    return <input data-testid="string-input" />;
  },
}));

vi.mock('../../PreviousButton', () => ({
  PreviousButton: () => null,
}));

vi.mock('../../../store/hooks/useStoredAnswer', () => ({
  useStoredAnswer: vi.fn(() => undefined),
}));

vi.mock('../InputLabel', () => ({
  InputLabel: ({ prompt, clearSelectionButton }: { prompt?: ReactNode; clearSelectionButton?: ReactNode }) => (
    <div>
      {prompt}
      {clearSelectionButton}
    </div>
  ),
}));

vi.mock('../OptionLabel', () => ({
  OptionLabel: ({ label }: { label: ReactNode }) => <span>{label}</span>,
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

const response = {
  id: 'q1', type: 'shortText', prompt: 'Q1', required: false,
} as Response;

const form = { value: 'live', onChange: vi.fn() } as Parameters<typeof ResponseSwitcher>[0]['form'];

function renderSwitcher({ storedAnswer, answerFinalized }: { storedAnswer?: Record<string, JsonValue>; answerFinalized?: boolean }) {
  return render(
    <ResponseSwitcher
      response={response}
      form={form}
      index={1}
      config={{} as IndividualComponent}
      storedAnswer={storedAnswer}
      answerFinalized={answerFinalized}
    />,
  );
}

// ── setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  capturedStringInputProps.disabled = undefined;
  capturedStringInputProps.answer = undefined;
  mockIsAnalysis.value = false;
  mockCurrentComponent.value = '';
  mockStoreState.completed = false;
  mockGoToNextStep.mockReset();
  mockGoToNextStep.mockReturnValue(true);
});

afterEach(() => cleanup());

function AutoAdvanceOwner({ onNext }: { onNext: () => boolean }) {
  const selection = useAutoAdvanceSelection('trial1_0', ['choice'], true);
  return <NextButton checkAnswer={null} onNext={onNext} autoAdvanceRequest={selection} />;
}

// ── ResponseSwitcher stored answer locking ────────────────────────────────────

describe('ResponseSwitcher stored answer locking', () => {
  test('keeps in-progress stored answers editable', () => {
    renderSwitcher({ storedAnswer: { q1: 'stored' }, answerFinalized: false });
    expect(capturedStringInputProps.disabled).toBe(false);
    expect(capturedStringInputProps.answer).toMatchObject({ value: 'live' });
  });

  test('locks the input once the trial is completed', () => {
    renderSwitcher({ storedAnswer: { q1: 'stored' }, answerFinalized: true });
    expect(capturedStringInputProps.disabled).toBe(true);
    expect(capturedStringInputProps.answer).toMatchObject({ value: 'stored', readOnly: true });
  });

  test('renders in-progress stored answers in analysis mode', () => {
    mockIsAnalysis.value = true;
    renderSwitcher({ storedAnswer: { q1: 'stored' }, answerFinalized: false });
    expect(capturedStringInputProps.disabled).toBe(true);
    expect(capturedStringInputProps.answer).toMatchObject({ value: 'stored', readOnly: true });
  });

  test('locks the input for a completed participant even when the answer is not finalized', () => {
    mockStoreState.completed = true;
    renderSwitcher({ storedAnswer: { q1: 'stored' }, answerFinalized: false });
    expect(capturedStringInputProps.disabled).toBe(true);
    expect(capturedStringInputProps.answer).toMatchObject({ value: 'stored', readOnly: true });
  });

  test('does not crash for a completed participant without a stored answer', () => {
    mockStoreState.completed = true;
    expect(() => renderSwitcher({ storedAnswer: undefined, answerFinalized: false })).not.toThrow();
    expect(capturedStringInputProps.disabled).toBe(true);
    expect(capturedStringInputProps.answer).toMatchObject({ value: undefined, readOnly: true });
  });
});

describe('ResponseSwitcher dynamic loading', () => {
  test('does not render raw templated response text while the component is resolving', () => {
    mockCurrentComponent.value = '__dynamicLoading';
    const { container } = render(
      <ResponseSwitcher
        response={{ ...response, prompt: 'Question: {{value}}' } as Response}
        form={form}
        index={1}
        config={{ parameters: { value: 'static' } } as unknown as IndividualComponent}
      />,
    );

    expect(container.textContent).not.toContain('{{value}}');
    expect(container.querySelector('[data-testid="string-input"]')).toBeNull();
  });

  test('a button selection in a separate response location reaches its Next owner', async () => {
    vi.useFakeTimers();
    const onNext = vi.fn(() => true);
    const autoAdvanceResponse = {
      type: 'buttons',
      id: 'choice',
      prompt: 'Choose',
      required: false,
      options: ['A', 'B'],
      location: 'sidebar',
      allowResponseChange: false,
      autoAdvanceToNextStep: true,
      autoAdvanceDelay: 0,
    } as Response;
    const { container } = render(
      <>
        <ResponseSwitcher
          response={autoAdvanceResponse}
          form={{ value: 'A', onChange: vi.fn() } as Parameters<typeof ResponseSwitcher>[0]['form']}
          index={1}
          config={{} as IndividualComponent}
        />
        <AutoAdvanceOwner onNext={onNext} />
      </>,
    );

    const selectedOption = container.querySelector('[data-radio-card][data-value="A"]') as HTMLButtonElement;
    expect(selectedOption.disabled).toBe(false);
    fireEvent.click(selectedOption);
    await act(async () => { vi.advanceTimersByTime(0); });

    expect(selectedOption.disabled).toBe(true);
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
