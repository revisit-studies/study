import { ReactNode } from 'react';
import { render, cleanup, screen } from '@testing-library/react';
import {
  afterEach, describe, expect, test, vi,
} from 'vitest';
import type { ReactiveResponse } from '../../../parser/types';
import { ReactiveInput } from '../ReactiveInput';

vi.mock('@mantine/core', () => ({
  Input: {
    Wrapper: ({ children, label }: { children?: ReactNode; label?: ReactNode }) => (
      <div>
        {label}
        {children}
      </div>
    ),
  },
  List: Object.assign(
    ({ children }: { children?: ReactNode }) => <ul>{children}</ul>,
    { Item: ({ children }: { children?: ReactNode }) => <li>{children}</li> },
  ),
}));

vi.mock('../InputLabel', () => ({
  InputLabel: ({ prompt }: { prompt: string }) => <span>{prompt}</span>,
}));

const response = {
  id: 'q1', type: 'reactive', prompt: 'Answer:', required: true,
} as ReactiveResponse;

function renderReactive(value: Parameters<typeof ReactiveInput>[0]['answer']['value']) {
  return render(
    <ReactiveInput response={response} answer={{ value }} index={1} enumerateQuestions={false} />,
  );
}

afterEach(() => cleanup());

describe('ReactiveInput falsy answer rendering', () => {
  test('renders a numeric answer of 0', () => {
    renderReactive(0);
    expect(screen.getByText('0')).toBeDefined();
  });

  test('renders a boolean answer of false', () => {
    renderReactive(false);
    expect(screen.getByText('false')).toBeDefined();
  });

  test('renders nothing for an undefined answer', () => {
    const { container } = renderReactive(undefined);
    expect(container.querySelector('li')).toBeNull();
  });

  test('renders nothing for an empty string answer', () => {
    const { container } = renderReactive('');
    expect(container.querySelector('li')).toBeNull();
  });
});
