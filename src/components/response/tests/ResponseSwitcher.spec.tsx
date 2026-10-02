import { ReactNode } from 'react';
import { render, cleanup } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import type { IndividualComponent, JsonValue, Response } from '../../../parser/types';
import { ResponseSwitcher } from '../ResponseSwitcher';

// ── mocks ────────────────────────────────────────────────────────────────────

const {
  capturedStringInputProps, capturedCustomInputProps, mockIsAnalysis, mockStoreState, mockCurrentComponent,
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
}));

vi.mock('@mantine/core', () => ({
  Box: ({
    children, className, id, 'data-testid': testId, inert, tabIndex, style,
  }: {
    children?: ReactNode;
    className?: string;
    id?: string;
    'data-testid'?: string;
    inert?: boolean;
    tabIndex?: number;
    style?: React.CSSProperties;
  }) => <div className={className} id={id} data-testid={testId} inert={inert} tabIndex={tabIndex} style={style}>{children}</div>,
  Checkbox: () => <input type="checkbox" />,
  Divider: () => <hr />,
}));

vi.mock('react-router', () => ({
  useSearchParams: vi.fn(() => [new URLSearchParams()]),
  useParams: vi.fn(() => ({})),
}));

vi.mock('../../../store/hooks/useStudyConfig', () => ({
  useStudyConfig: vi.fn(() => ({ uiConfig: {}, components: {} })),
}));

vi.mock('../../../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: vi.fn(() => mockIsAnalysis.value),
}));

vi.mock('../../../routes/utils', () => ({
  useCurrentStep: vi.fn(() => 0),
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
});

afterEach(() => cleanup());

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
});
