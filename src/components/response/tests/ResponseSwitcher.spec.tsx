import { ComponentPropsWithoutRef, ReactNode, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  render, cleanup, fireEvent, act, renderHook,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import type {
  ButtonsResponse, IndividualComponent, JsonValue, Response,
} from '../../../parser/types';
import type { Sequence } from '../../../store/types';
import { makeStudyConfig } from '../../../tests/utils';
import { useStudyConfig } from '../../../store/hooks/useStudyConfig';
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
    } as Sequence,
    completed: false,
    answers: {},
  },
  mockCurrentComponent: { value: '' },
  mockGoToNextStep: vi.fn(() => true),
}));

vi.mock('@mantine/core', () => ({
  Box: ({ children, ...props }: ComponentPropsWithoutRef<'div'>) => <div {...props}>{children}</div>,
  Checkbox: ({
    checked, disabled, onChange, label,
  }: { checked?: boolean; disabled?: boolean; onChange?: React.ChangeEventHandler<HTMLInputElement>; label?: string }) => (
    <label>
      <input type="checkbox" checked={checked ?? false} disabled={disabled} onChange={onChange} />
      {label}
    </label>
  ),
  Divider: () => <hr />,
  Flex: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  FocusTrap: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Alert: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Button: ({ children, disabled, onClick }: { children?: ReactNode; disabled?: boolean; onClick?: () => void }) => (
    <button type="button" disabled={disabled} onClick={onClick}>{children}</button>
  ),
  Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Kbd: ({ children }: { children?: ReactNode }) => <kbd>{children}</kbd>,
  Radio: Object.assign(
    ({ children, value, ...props }: { children?: ReactNode; value?: string; [key: string]: unknown }) => (
      <div data-value={value} {...props}>{children}</div>
    ),
    {
      Group: ({ children, label, onChange }: { children?: ReactNode; label?: ReactNode; onChange?: (value: string) => void }) => {
        const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
          const card = (event.target as HTMLElement).closest('[data-radio-card]');
          if (card) onChange?.(card.getAttribute('data-value') || '');
        };

        return (
          <div onClick={handleClick}>
            {label}
            {children}
          </div>
        );
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
  vi.mocked(useStudyConfig).mockReset();
  mockStoreState.sequence = {
    order: 'fixed', orderPath: 'root', components: ['trial1'], skip: [],
  };
  vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams(), vi.fn()]);
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
  test('clearing a default keeps required buttons editable until a non-empty selection', async () => {
    vi.useFakeTimers();
    const onNext = vi.fn(() => true);
    const buttonResponse: Response = {
      type: 'buttons',
      id: 'choice',
      prompt: 'Choose',
      required: true,
      options: ['A', 'B'],
      default: 'A',
      allowResponseChange: false,
      autoAdvanceToNextStep: true,
      autoAdvanceDelay: 100,
    };
    function Trial() {
      const [value, setValue] = useState('A');
      return (
        <>
          <ResponseSwitcher response={buttonResponse} form={{ value, onChange: setValue }} index={1} config={{} as IndividualComponent} />
          <AutoAdvanceOwner onNext={onNext} />
          <output data-testid="answer">{value}</output>
        </>
      );
    }
    try {
      const view = render(<Trial />);
      const options = Array.from(view.container.querySelectorAll<HTMLButtonElement>('[data-radio-card]'));
      fireEvent.click(view.getByText('Clear selection'));
      expect(view.getByTestId('answer').textContent).toBe('');
      expect(options.every((option) => !option.disabled)).toBe(true);
      await act(async () => { vi.advanceTimersByTime(100); });
      expect(onNext).not.toHaveBeenCalled();

      fireEvent.click(options[1]);
      expect(view.getByTestId('answer').textContent).toBe('B');
      expect(options.every((option) => option.disabled)).toBe(true);
      await act(async () => { vi.advanceTimersByTime(100); });
      expect(onNext).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

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

describe('response auto-advance regressions', () => {
  const choice: ButtonsResponse = {
    type: 'buttons',
    id: 'choice',
    prompt: 'Choose',
    options: [{ label: 'A', value: 'A', key: 'a' }],
    autoAdvanceToNextStep: true,
    autoAdvanceDelay: 250,
    required: true,
  };

  test.each(['inherited Previous', 'first dynamic item'] as const)('finalized choices cannot emit a selection after returning from %s', (returnPath) => {
    const dynamic = returnPath === 'first dynamic item';
    mockStoreState.sequence.components = ['trial1', dynamic
      ? {
        id: 'dynamic', order: 'dynamic', orderPath: 'root-1', components: ['following'], skip: [],
      }
      : 'following'];
    vi.mocked(useStudyConfig).mockReturnValue(makeStudyConfig({
      uiConfig: {},
      components: { following: { baseComponent: 'withPrevious' } },
      baseComponents: { withPrevious: { type: 'questionnaire', previousButton: true, response: [] } },
    }));
    const onChange = vi.fn();
    const owner = renderHook(() => useAutoAdvanceSelection('trial1_0', ['choice'], true));
    const view = render(<ResponseSwitcher response={choice} form={{ value: 'A', onChange }} storedAnswer={{ choice: 'A' }} answerFinalized index={1} config={{} as IndividualComponent} />);
    fireEvent.click(view.container.querySelector('[data-radio-card]')!);
    fireEvent.keyDown(window, { key: 'a' });
    expect(onChange).not.toHaveBeenCalled();
    expect(owner.result.current).toBeUndefined();
  });

  test.each([false, true])('returning with Previous preserves allowResponseChange=%s', (allowResponseChange) => {
    vi.mocked(useStudyConfig).mockReturnValue(makeStudyConfig({
      components: { following: { type: 'questionnaire', previousButton: true, response: [] } },
    }));
    mockStoreState.sequence.components = ['trial1', 'following'];
    const onChange = vi.fn();
    const owner = renderHook(() => useAutoAdvanceSelection('trial1_0', ['choice'], true));
    const trial = () => (
      <ResponseSwitcher
        response={{ ...choice, allowResponseChange, options: ['A', { label: 'B', value: 'B', key: 'b' }] }}
        form={{ value: 'A', onChange }}
        storedAnswer={{ choice: 'A' }}
        answerFinalized
        index={1}
        config={{} as IndividualComponent}
      />
    );
    const first = render(trial());
    first.unmount();
    const view = render(trial());
    const otherOption = view.container.querySelector('[data-radio-card][data-value="B"]') as HTMLButtonElement;
    expect(otherOption.disabled).toBe(!allowResponseChange);
    expect(owner.result.current).toBeUndefined();
    fireEvent.click(otherOption);
    fireEvent.keyDown(window, { key: 'b' });
    if (allowResponseChange) {
      expect(onChange).toHaveBeenCalledWith('B', 'keyboard');
      expect(owner.result.current?.selected).toBe(true);
    } else {
      expect(onChange).not.toHaveBeenCalled();
      expect(owner.result.current).toBeUndefined();
    }
  });

  test('a finalized I do not know answer stays locked on return', () => {
    vi.mocked(useStudyConfig).mockReturnValue(makeStudyConfig({
      components: { following: { type: 'questionnaire', previousButton: true, response: [] } },
    }));
    mockStoreState.sequence.components = ['trial1', 'following'];
    const onChange = vi.fn();
    const view = render(
      <ResponseSwitcher
        response={{ ...choice, withDontKnow: true, allowResponseChange: false }}
        form={{ value: '', onChange }}
        dontKnowCheckbox={{ checked: true, onChange }}
        storedAnswer={{ choice: '', 'choice-dontKnow': true }}
        answerFinalized
        index={1}
        config={{} as IndividualComponent}
      />,
    );
    const checkbox = view.getByLabelText("I don't know") as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
    checkbox.click();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('captured auto-advance buttons remain read-only without emitting a selection', () => {
    vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams('answer=A'), vi.fn()]);
    const onChange = vi.fn();
    const owner = renderHook(() => useAutoAdvanceSelection('trial1_0', ['choice'], true));
    const view = render(<ResponseSwitcher response={{ ...choice, paramCapture: 'answer' }} form={{ value: 'A', onChange }} index={1} config={{} as IndividualComponent} />);
    expect((view.container.querySelector('[data-radio-card]') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(window, { key: 'a' });
    expect(onChange).not.toHaveBeenCalled();
    expect(owner.result.current).toBeUndefined();
  });

  test('forwards mapped-key provenance even when auto-advance is off', () => {
    const onChange = vi.fn();
    render(<ResponseSwitcher response={{ ...choice, autoAdvanceToNextStep: false }} form={{ value: '', onChange }} index={1} config={{} as IndividualComponent} />);
    fireEvent.keyDown(window, { key: 'a' });
    expect(onChange).toHaveBeenCalledWith('A', 'keyboard');
  });

  test.each([true, false])('I do not know advances and honors response locking (allowResponseChange=%s)', async (allowResponseChange) => {
    vi.useFakeTimers();
    const onNext = vi.fn(() => true);
    function Trial() {
      const [checked, setChecked] = useState(false);
      return (
        <>
          <ResponseSwitcher
            response={{ ...choice, withDontKnow: true, allowResponseChange }}
            form={{ value: '', onChange: vi.fn() }}
            dontKnowCheckbox={{ checked, onChange: setChecked }}
            index={1}
            config={{} as IndividualComponent}
          />
          <AutoAdvanceOwner onNext={onNext} />
        </>
      );
    }
    const view = render(<Trial />);
    const checkbox = view.getByLabelText("I don't know") as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    expect(checkbox.disabled).toBe(!allowResponseChange);
    if (allowResponseChange) {
      fireEvent.click(checkbox);
      await act(async () => { vi.advanceTimersByTime(250); });
      expect(onNext).not.toHaveBeenCalled();
      fireEvent.click(checkbox);
    }
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(onNext).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  test('invalidates hidden response requests without restoring them when visible again', () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useAutoAdvanceSelection('trial1_0', ids, true),
      { initialProps: { ids: ['choice'] } },
    );
    act(() => publishAutoAdvanceSelection({
      identifier: 'trial1_0', responseId: 'choice', delay: 250, selected: true,
    }));
    expect(result.current?.selected).toBe(true);
    rerender({ ids: [] });
    expect(result.current).toBeUndefined();
    rerender({ ids: ['choice'] });
    expect(result.current).toBeUndefined();
  });

  test('cancellations affect only the request from the same source', () => {
    const { result } = renderHook(() => useAutoAdvanceSelection('trial1_0', ['choice'], true, true));
    act(() => publishAutoAdvanceSelection({
      identifier: 'trial1_0', responseId: 'choice', delay: 250, selected: true,
    }));
    act(() => publishAutoAdvanceSelection({ identifier: 'trial1_0', delay: 0, selected: false }));
    expect(result.current?.responseId).toBe('choice');
    act(() => publishAutoAdvanceSelection({
      identifier: 'trial1_0', responseId: 'choice', delay: 0, selected: false,
    }));
    expect(result.current?.selected).toBe(false);
  });
});
