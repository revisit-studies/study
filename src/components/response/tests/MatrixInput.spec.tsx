import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, it, vi,
} from 'vitest';
import type { MatrixResponse } from '../../../parser/types';
import { MatrixInput } from '../MatrixInput';

vi.mock('@mantine/core', () => {
  const Radio = Object.assign(
    ({ value }: { value: string }) => <input readOnly type="radio" value={value} />,
    {
      Group: ({ children, value }: { children: ReactNode; value?: string }) => (
        <div data-radio-value={value || ''}>{children}</div>
      ),
    },
  );

  return {
    Box: ({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) => <div className={className} style={style}>{children}</div>,
    Checkbox: ({ checked, value }: { checked?: boolean; value: string }) => (
      <input readOnly type="checkbox" checked={checked} value={value} />
    ),
    Radio,
    Text: ({ children, role, ...props }: { children: ReactNode; role?: string; [key: string]: unknown }) => <span role={role} {...props}>{children}</span>,
  };
});

vi.mock('../../../store/store', () => ({
  useStoreActions: () => ({
    setMatrixAnswersCheckbox: vi.fn((payload) => payload),
    setMatrixAnswersRadio: vi.fn((payload) => payload),
  }),
  useStoreDispatch: () => vi.fn(),
}));

vi.mock('../../../store/hooks/useStoredAnswer', () => ({
  useStoredAnswer: () => ({}),
}));

vi.mock('../InputLabel', () => ({
  InputLabel: ({ prompt }: { prompt: string }) => <label>{prompt}</label>,
}));

vi.mock('../OptionLabel', () => ({
  OptionLabel: ({ label }: { label: string }) => <span>{label}</span>,
}));

describe('MatrixInput', () => {
  it('renders matrix rows when the form value has not initialized yet', () => {
    const response: MatrixResponse = {
      id: 'ueq-response',
      prompt: 'For each word pair, select a value from 1 to 7.',
      type: 'matrix-radio',
      required: true,
      answerOptions: ['1', '2', '3', '4', '5', '6', '7'],
      questionOptions: [
        {
          label: 'Unpleasant - Pleasant',
          value: 'unpleasant-pleasant',
          leftLabel: 'Unpleasant',
          rightLabel: 'Pleasant',
        },
      ],
    };

    const markup = renderToStaticMarkup(
      <MatrixInput
        response={response}
        answer={{ value: undefined }}
        index={0}
        disabled={false}
        enumerateQuestions={false}
      />,
    );

    expect(markup).toContain('Unpleasant');
    expect(markup).toContain('Pleasant');
    expect(markup).toContain('data-radio-value=""');
  });

  it('renders row feedback below each matrix row label', () => {
    const response: MatrixResponse = {
      id: 'matrix',
      prompt: '',
      type: 'matrix-checkbox',
      answerOptions: ['A', 'B'],
      questionOptions: ['row-1', 'row-2', 'row-3'],
    };
    const markup = renderToStaticMarkup(
      <MatrixInput
        response={response}
        answer={{ value: { 'row-1': 'A', 'row-2': 'B', 'row-3': '' } }}
        index={0}
        disabled={false}
        enumerateQuestions={false}
        rowFeedback={{ 'row-1': 'correct', 'row-2': 'partially correct', 'row-3': 'incorrect' }}
      />,
    );

    expect(markup.match(/role="status"/g)).toHaveLength(3);
    expect(markup).toContain('correct');
    expect(markup).toContain('partially correct');
    expect(markup).toContain('incorrect');
    expect(markup).toContain('grid-template-columns:auto 1fr;');
    expect(markup).toContain('flex-direction:column');
    expect(markup).toContain('data-testid="matrix-row-feedback-row-1"');
    expect(markup).not.toContain('data-testid="matrix-row-feedback"');
  });
});
