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
    Text: ({ children, role }: { children: ReactNode; role?: string }) => <span role={role}>{children}</span>,
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

  it('renders row feedback in a separate track to the right of the unchanged matrix grid', () => {
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
    expect(markup).toContain('grid-template-columns:auto 1fr minmax(110px, max-content);');
    expect(markup).toContain('data-testid="matrix-row-feedback"');
    expect(markup).toContain('grid-column:3;grid-row:2');
  });

  it('can place row feedback to the left of the unchanged matrix grid', () => {
    const response: MatrixResponse = {
      id: 'matrix',
      prompt: '',
      type: 'matrix-checkbox',
      answerOptions: ['A', 'B'],
      questionOptions: ['row-1'],
    };
    const markup = renderToStaticMarkup(
      <MatrixInput
        response={response}
        answer={{ value: { 'row-1': 'A' } }}
        index={0}
        disabled={false}
        enumerateQuestions={false}
        rowFeedback={{ 'row-1': 'correct' }}
        rowFeedbackPosition="left"
      />,
    );

    expect(markup).toContain('grid-template-columns:minmax(110px, max-content) auto 1fr;');
    expect(markup).toContain('grid-column:1;grid-row:2');
  });
});
