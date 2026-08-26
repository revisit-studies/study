import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';

import type { RadioResponse, ButtonsResponse, MatrixResponse } from '../../../parser/types';
import ClearSelectionButton from '../ClearSelectionButton';
import { RadioInput } from '../RadioInput';
import { ButtonsInput } from '../ButtonsInput';
import { MatrixInput } from '../MatrixInput';

interface DivProps {
  children?: React.ReactNode;
  [key: string]: unknown;
}

interface RadioProps {
  label?: React.ReactNode;
  value?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}

interface CheckboxProps {
  label?: React.ReactNode;
  value?: string;
  checked?: boolean;
}

interface MockButtonProps {
  children?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

interface StringAnswer {
  value: string;
  onChange: (val: string) => void;
}

interface MatrixAnswer {
  value: Record<string, string>;
}

vi.mock('@mantine/core', () => {
  function Div({ children }: DivProps) {
    return <div>{children}</div>;
  }
  function Span({ children }: DivProps) {
    return <span>{children}</span>;
  }
  const Radio = Object.assign(
    ({
      label, value, children, ...rest
    }: RadioProps) => (
      <div data-value={value} data-label={String(label)} {...rest}>
        {label}
        {children}
      </div>
    ),
    {
      Group: ({
        children, label, description, ...rest
      }: DivProps & { label?: React.ReactNode; description?: React.ReactNode }) => (
        <div {...rest}>
          {label}
          {description}
          {children}
        </div>
      ),
      Card: ({ children, value, ...rest }: RadioProps) => (
        <div data-value={value} {...rest}>{children}</div>
      ),
    },
  );
  function Checkbox({ label, value, checked }: CheckboxProps) {
    return <div data-value={value} data-checked={checked}>{label}</div>;
  }
  return {
    Group: Div,
    Stack: Div,
    Flex: Div,
    Box: Div,
    Text: Span,
    Input: Div,
    Radio,
    Checkbox,
    FocusTrap: Div,
    Button: ({
      children, onClick, disabled,
    }: MockButtonProps) => (
      <button type="button" disabled={disabled} onClick={onClick}>{children}</button>
    ),
    rem: (v: unknown) => String(v),
  };
});

// Mock store with stable spies so tests can assert calls
const mockSetMatrixAnswersRadio = vi.fn();
vi.mock('../../../store/store', () => ({
  useStoreDispatch: vi.fn(() => vi.fn()),
  useStoreActions: vi.fn(() => ({
    setMatrixAnswersRadio: mockSetMatrixAnswersRadio,
    setMatrixAnswersCheckbox: vi.fn(),
    setRankingAnswers: vi.fn(),
    toggleShowHelpText: vi.fn(),
    incrementHelpCounter: vi.fn(),
  })),
  useStoreSelector: vi.fn(() => ({})),
}));

vi.mock('../../../store/hooks/useStoredAnswer', () => ({
  useStoredAnswer: vi.fn(() => undefined),
}));

vi.mock('../../../parser/types', () => ({}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('ClearSelectionButton', () => {
  test('calls onClick when enabled and not when disabled', () => {
    const onClick = vi.fn();
    const { getByText, rerender } = render(<ClearSelectionButton onClick={onClick} disabled={false} />);
    const btn = getByText('Clear selection');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<ClearSelectionButton onClick={onClick} disabled />);
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('RadioInput / ButtonsInput clear & toggle behaviour', () => {
  test('RadioInput toggles selection and Clear selection calls onChange("")', () => {
    const onChange = vi.fn();
    const response: RadioResponse = {
      type: 'radio', id: 'r1', prompt: 'Pick your answer', required: false, options: ['A', 'B'], horizontal: false, withOther: false, labelLocation: 'inline',
    };
    const answer: StringAnswer = { value: '', onChange };
    const { container, getByText, rerender } = render(
      <RadioInput response={response} disabled={false} answer={answer} error={null} index={0} enumerateQuestions={false} />,
    );

    const optionA = container.querySelector('[data-value="A"]');
    expect(optionA).toBeTruthy();
    if (optionA) {
      fireEvent.click(optionA);
      expect(onChange).toHaveBeenLastCalledWith('A');
      rerender(
        <RadioInput response={response} disabled={false} answer={{ ...answer, value: 'A' }} error={null} index={0} enumerateQuestions={false} />,
      );
      fireEvent.click(optionA);
      expect(onChange).toHaveBeenLastCalledWith('');
      rerender(
        <RadioInput response={response} disabled={false} answer={{ ...answer, value: 'A' }} error={null} index={0} enumerateQuestions={false} />,
      );
    }

    expect(optionA).toBeTruthy();
    const clearBtn = getByText('Clear selection');
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  test('ButtonsInput toggles Radio. Card selection and Clear selection works', () => {
    const onChange = vi.fn();
    const response: ButtonsResponse = {
      type: 'buttons', id: 'b1', prompt: 'Pick your answer', required: false, options: ['X', 'Y'],
    };
    const answer: StringAnswer = { value: '', onChange };
    const { container, getByText, rerender } = render(
      <ButtonsInput response={response} disabled={false} answer={answer} error={null} index={0} enumerateQuestions={false} />,
    );

    const cardX = container.querySelector('[data-value="X"]');
    expect(cardX).toBeTruthy();
    if (cardX) {
      fireEvent.click(cardX);
      expect(onChange).toHaveBeenLastCalledWith('X');
      rerender(
        <ButtonsInput response={response} disabled={false} answer={{ ...answer, value: 'X' }} error={null} index={0} enumerateQuestions={false} />,
      );
      fireEvent.click(cardX);
      expect(onChange).toHaveBeenLastCalledWith('');
    }

    const clearBtn = getByText('Clear selection');
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenLastCalledWith('');
  });
});

describe('LikertInput behaviour', () => {
  test('Likert scales (RadioInput) toggle on repeated clicks', () => {
    const onChange = vi.fn();
    const likertResponse: RadioResponse = {
      type: 'radio',
      id: 'l1',
      prompt: 'Pick your answer',
      required: false,
      options: ['1', '2', '3', '4', '5'],
      horizontal: true,
      withOther: false,
      labelLocation: 'inline',
    };
    const answer: StringAnswer = { value: '', onChange };
    const { container, rerender } = render(
      <RadioInput
        response={likertResponse}
        disabled={false}
        answer={answer}
        error={null}
        index={0}
        enumerateQuestions={false}
        stretch
      />,
    );

    const opt1 = container.querySelector('[data-value="1"]');
    expect(opt1).toBeTruthy();
    if (opt1) {
      fireEvent.click(opt1);
      expect(onChange).toHaveBeenLastCalledWith('1');
      rerender(
        <RadioInput
          response={likertResponse}
          disabled={false}
          answer={{ ...answer, value: '1' }}
          error={null}
          index={0}
          enumerateQuestions={false}
          stretch
        />,
      );
      fireEvent.click(opt1);
      expect(onChange).toHaveBeenLastCalledWith('');
    }
  });
});

describe('MatrixInput clear behaviour', () => {
  test('Matrix-level Clear selection calls setMatrixAnswersRadio for each question', () => {
    const response: MatrixResponse = {
      type: 'matrix-radio',
      id: 'm1',
      prompt: 'Pick your answers',
      required: false,
      answerOptions: ['A', 'B'],
      questionOptions: ['q1', 'q2'],
    };

    const answer: MatrixAnswer = { value: { q1: 'A', q2: '' } };
    const { getByText } = render(
      <MatrixInput response={response} answer={answer} index={0} disabled={false} error={null} enumerateQuestions={false} />,
    );

    const clearBtn = getByText('Clear selection');
    fireEvent.click(clearBtn);

    expect(mockSetMatrixAnswersRadio).toHaveBeenCalled();
    expect(mockSetMatrixAnswersRadio.mock.calls.length).toBe(2);
    const payload = mockSetMatrixAnswersRadio.mock.calls[0][0];
    expect(payload).toHaveProperty('responseId', 'm1');
    expect(payload).toHaveProperty('questionKey');
    expect(payload).toHaveProperty('val', '');
  });

  test('clicking a selected matrix cell deselects that row', () => {
    const response: MatrixResponse = {
      type: 'matrix-radio',
      id: 'm2',
      prompt: 'Pick your answer',
      required: false,
      answerOptions: ['A', 'B'],
      questionOptions: ['q1', 'q2'],
    };

    const answer: MatrixAnswer = { value: { q1: 'A', q2: '' } };
    const { container } = render(
      <MatrixInput response={response} answer={answer} index={0} disabled={false} error={null} enumerateQuestions={false} />,
    );

    const radioA = container.querySelector('[data-value="A"]');
    expect(radioA).toBeTruthy();
    if (radioA) {
      fireEvent.click(radioA);
      expect(mockSetMatrixAnswersRadio).toHaveBeenCalled();
      const calledPayload = mockSetMatrixAnswersRadio.mock.calls[mockSetMatrixAnswersRadio.mock.calls.length - 1][0];
      expect(calledPayload).toHaveProperty('responseId', 'm2');
      expect(calledPayload).toHaveProperty('questionKey', 'q1');
      expect(calledPayload).toHaveProperty('val', '');
    }
  });
});
