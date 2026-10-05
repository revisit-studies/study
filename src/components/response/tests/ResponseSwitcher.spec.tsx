import { ComponentPropsWithoutRef, ReactNode } from 'react';
import {
  render, cleanup, fireEvent, act, renderHook,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import type { IndividualComponent, JsonValue, Response } from '../../../parser/types';
import { ResponseSwitcher } from '../ResponseSwitcher';
import { publishAutoAdvanceSelection, useAutoAdvanceSelection } from '../autoAdvanceEvents';
import { NextButton } from '../../NextButton';

// ── mocks ────────────────────────────────────────────────────────────────────

const {
  capturedStringInputProps, capturedCustomInputProps, mockIsAnalysis, mockStoreState, mockCurrentComponent, mockGoToNextStep,
} = vi.hoisted(() => ({
  capturedStringInputProps: {
    disabled: undefined as boolean | undefined,
    answer: undefined as { value?: unknown; readOnly?: boolean } | undefined,
  },
  capturedCustomInputProps: { disabled: undefined as boolean | undefined },
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
  Box: ({ children, ...props }: ComponentPropsWithoutRef<'div'>) => <div {...props}>{children}</div>,
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
  CustomResponseInput: ({ disabled }: { disabled: boolean }) => {
    capturedCustomInputProps.disabled = disabled;
    return null;
  },
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
  OptionTextTemplateContext: { Provider: ({ children }: { children?: ReactNode }) => children },
  OptionLabel: ({ label }: { label: ReactNode }) => <span>{label}</span>,
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

const response = {
  id: 'q1', type: 'shortText', prompt: 'Q1', required: false,
} as Response;

const form = { value: 'live', onChange: vi.fn() } as Parameters<typeof ResponseSwitcher>[0]['form'];

function renderSwitcher({ storedAnswer, answerFinalized, isDelayedDisabled }: {
  storedAnswer?: Record<string, JsonValue>;
  answerFinalized?: boolean;
  isDelayedDisabled?: boolean;
}) {
  return render(
    <ResponseSwitcher
      response={response}
      form={form}
      index={1}
      config={{} as IndividualComponent}
      storedAnswer={storedAnswer}
      answerFinalized={answerFinalized}
      isDelayedDisabled={isDelayedDisabled}
    />,
  );
}

// ── setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  capturedStringInputProps.disabled = undefined;
  capturedStringInputProps.answer = undefined;
  capturedCustomInputProps.disabled = undefined;
  mockIsAnalysis.value = false;
  mockCurrentComponent.value = '';
  mockStoreState.completed = false;
  mockGoToNextStep.mockReset();
  mockGoToNextStep.mockReturnValue(true);
});

afterEach(() => cleanup());

test.each([true, false])('uses semantic validation defaults while preserving custom colors (required=%s)', (required) => {
  const errorColor = required ? 'red' : 'orange';
  const styledResponse: Response = {
    id: 'q1',
    type: 'shortText',
    prompt: 'Q1',
    required,
    minCharLength: 5,
    style: { margin: '12px' },
  };
  const content = (value: string, responseConfig = styledResponse) => (
    <ResponseSwitcher response={responseConfig} form={{ ...form, value }} index={1} config={{} as IndividualComponent} errors />
  );
  const view = render(content('bad'));
  const wrapper = view.container.querySelector<HTMLElement>('.response')!;
  expect(wrapper.style.backgroundColor).toBe(`var(--mantine-color-${errorColor}-light)`);
  expect(wrapper.style.color).toBe(`var(--mantine-color-${errorColor}-light-color)`);
  expect(wrapper.style.border).toBe(`1px solid var(--mantine-color-${errorColor}-outline)`);
  expect(wrapper.style.margin).toBe('12px');

  const customResponse: Response = {
    ...styledResponse,
    style: { ...styledResponse.style, color: 'navy', backgroundColor: 'beige' },
  };
  view.rerender(content('bad', customResponse));
  expect(wrapper.style.backgroundColor).toBe('beige');
  expect(wrapper.style.color).toBe('navy');
  expect(wrapper.style.border).toBe(`1px solid var(--mantine-color-${errorColor}-outline)`);

  view.rerender(content('valid answer', customResponse));
  expect(wrapper.style.backgroundColor).toBe('beige');
  expect(wrapper.style.color).toBe('navy');
  expect(wrapper.style.border).toBe('');
});

test.each([
  ['shortText', 'response--shortText'],
  ['divider', 'response--divider'],
] as const)('adds a response type class for %s', (type, expectedClass) => {
  const typedResponse = type === 'divider'
    ? { id: 'section-break', type }
    : response;
  const view = render(
    <ResponseSwitcher
      response={typedResponse as Response}
      form={form}
      index={1}
      config={{} as IndividualComponent}
    />,
  );
  expect(view.container.querySelector('.response')?.classList.contains(expectedClass)).toBe(true);
});

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

describe('ResponseSwitcher style overrides', () => {
  test('lets an explicit width control the response and releases the input cap', () => {
    const { container } = render(
      <ResponseSwitcher
        response={{ ...response, style: { width: '600px' } } as Response}
        form={form}
        index={1}
        config={{} as IndividualComponent}
      />,
    );
    const wrapper = container.querySelector<HTMLElement>('.response');
    expect(wrapper?.style.width).toBe('600px');
    expect(wrapper?.dataset.answerWidth).toBeUndefined();
  });

  test('keeps user styles when displaying a validation error', () => {
    const { container } = render(
      <ResponseSwitcher
        response={{
          ...response,
          type: 'custom',
          style: {
            padding: '0', border: '0', borderRadius: '0', backgroundColor: 'white',
          },
        } as Response}
        customError="Required answer"
        form={form}
        index={1}
        config={{} as IndividualComponent}
      />,
    );
    const wrapper = container.querySelector<HTMLElement>('.response');
    expect(wrapper?.style.padding).toBe('0px');
    expect(wrapper?.style.borderWidth).toBe('0px');
    expect(wrapper?.style.borderRadius).toBe('0px');
    expect(wrapper?.style.backgroundColor).toBe('white');
  });
});

describe('ResponseSwitcher delay state', () => {
  test('applies inert and delay styling to the response root only while delayed', () => {
    const delayedResponse = { ...response, delay: 5000 } as Response;
    const { container, rerender } = render(
      <ResponseSwitcher
        response={delayedResponse}
        form={form}
        index={1}
        config={{} as IndividualComponent}
        isDelayedDisabled
      />,
    );
    const responseElement = container.querySelector('.response') as HTMLDivElement;

    expect(responseElement.getAttribute('data-testid')).toBe('delay-wrapper-q1');
    expect(responseElement.hasAttribute('inert')).toBe(true);
    expect(responseElement.getAttribute('tabindex')).toBe('-1');
    expect(responseElement.style.pointerEvents).toBe('none');
    expect(responseElement.style.opacity).toBe('0.4');
    expect(capturedStringInputProps.disabled).toBe(true);

    rerender(
      <ResponseSwitcher
        response={delayedResponse}
        form={form}
        index={1}
        config={{} as IndividualComponent}
        isDelayedDisabled={false}
      />,
    );

    expect(responseElement.hasAttribute('inert')).toBe(false);
    expect(responseElement.style.pointerEvents).toBe('');
    expect(responseElement.style.opacity).toBe('');
    expect(capturedStringInputProps.disabled).toBe(false);
  });

  test.each([true, false])('passes timer-disabled state %s to custom responses', (isDelayedDisabled) => {
    render(
      <ResponseSwitcher
        response={{ id: 'custom', type: 'custom', path: 'custom.tsx' } as Response}
        form={form}
        field={{ getInputProps: () => form, setValue: vi.fn(), onBlur: vi.fn() }}
        index={1}
        config={{} as IndividualComponent}
        isDelayedDisabled={isDelayedDisabled}
      />,
    );

    expect(capturedCustomInputProps.disabled).toBe(isDelayedDisabled);
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

describe('HTML auto advance requests', () => {
  const ids = ['button-answer'];

  test('only an enabled website owner receives trial requests and cancellations', () => {
    const owner = renderHook(() => useAutoAdvanceSelection('trial_0', ids, true, true));
    const buttonsOnly = renderHook(() => useAutoAdvanceSelection('trial_0', ids, true));
    const disabled = renderHook(() => useAutoAdvanceSelection('trial_0', ids, false, true));
    const otherTrial = renderHook(() => useAutoAdvanceSelection('trial_1', ids, true, true));

    act(() => publishAutoAdvanceSelection({ identifier: 'trial_0', selected: true, delay: 300 }));
    expect(owner.result.current).toMatchObject({ selected: true, delay: 300 });
    expect(buttonsOnly.result.current).toBeUndefined();
    expect(disabled.result.current).toBeUndefined();
    expect(otherTrial.result.current).toBeUndefined();

    act(() => publishAutoAdvanceSelection({ identifier: 'trial_0', selected: false, delay: 0 }));
    expect(owner.result.current?.selected).toBe(false);
  });

  test('preserves response filtering and clears requests on trial changes', () => {
    const { result, rerender } = renderHook(
      ({ identifier }) => useAutoAdvanceSelection(identifier, ids, true, true),
      { initialProps: { identifier: 'trial_0' } },
    );
    act(() => publishAutoAdvanceSelection({
      identifier: 'trial_0', responseId: 'unrelated', selected: true, delay: 0,
    }));
    expect(result.current).toBeUndefined();
    act(() => publishAutoAdvanceSelection({
      identifier: 'trial_0', responseId: 'button-answer', selected: true, delay: 0,
    }));
    expect(result.current?.responseId).toBe('button-answer');
    rerender({ identifier: 'trial_1' });
    expect(result.current).toBeUndefined();
  });
});
