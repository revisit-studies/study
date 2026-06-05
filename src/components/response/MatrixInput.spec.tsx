import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, it, vi,
} from 'vitest';
import type { MatrixResponse } from '../../parser/types';
import { MatrixInput } from './MatrixInput';

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
    Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Checkbox: ({ checked, value }: { checked?: boolean; value: string }) => (
      <input readOnly type="checkbox" checked={checked} value={value} />
    ),
    Radio,
    Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  };
});

vi.mock('../../store/store', () => ({
  useStoreActions: () => ({
    setMatrixAnswersCheckbox: vi.fn((payload) => payload),
    setMatrixAnswersRadio: vi.fn((payload) => payload),
  }),
  useStoreDispatch: () => vi.fn(),
}));

vi.mock('../../store/hooks/useStoredAnswer', () => ({
  useStoredAnswer: () => ({
    questionOrders: {},
  }),
}));

vi.mock('./InputLabel', () => ({
  InputLabel: ({ prompt }: { prompt: string }) => <label>{prompt}</label>,
}));

vi.mock('./OptionLabel', () => ({
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
});
