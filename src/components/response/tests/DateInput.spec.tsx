import { MantineProvider } from '@mantine/core';
import {
  cleanup, fireEvent, render, screen,
} from '@testing-library/react';
import { useState } from 'react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import type { DateResponse } from '../../../parser/types';
import { DateResponseInput } from '../DateInput';

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('DateResponseInput', () => {
  test.each([
    { options: 'month', value: '06/2009', prompt: 'Select a month.' },
    { options: 'year', value: '2009', prompt: 'Select a year.' },
  ] as const)('renders an $options picker value', ({ options, value, prompt }) => {
    const response: DateResponse = {
      id: options,
      prompt,
      type: 'date',
      options,
      required: true,
    };

    render(
      <MantineProvider>
        <DateResponseInput
          response={response}
          disabled={false}
          answer={{ value }}
          index={1}
          enumerateQuestions={false}
        />
      </MantineProvider>,
    );

    expect(screen.getByRole('button', { name: `${prompt}*` }).textContent).toContain(value);
  });

  test('shows an error after a complete invalid date is typed', () => {
    const onChange = vi.fn();
    const response: DateResponse = {
      id: 'date',
      prompt: 'Select a date.',
      type: 'date',
      required: true,
    };
    function TestDateInput() {
      const [value, setValue] = useState('');
      return (
        <DateResponseInput
          response={response}
          disabled={false}
          answer={{
            value,
            onChange: (nextValue) => {
              onChange(nextValue);
              setValue(nextValue);
            },
          }}
          index={1}
          enumerateQuestions={false}
        />
      );
    }

    render(
      <MantineProvider>
        <TestDateInput />
      </MantineProvider>,
    );

    const input = screen.getByPlaceholderText('MM/DD/YYYY');
    expect(input.getAttribute('maxlength')).toBe('10');

    fireEvent.input(input, { target: { value: '02' }, inputType: 'insertText' });
    expect((input as HTMLInputElement).value).toBe('02/');

    fireEvent.input(input, { target: { value: '02' }, inputType: 'deleteContentBackward' });
    expect((input as HTMLInputElement).value).toBe('02');

    fireEvent.input(input, { target: { value: '02/29' }, inputType: 'insertText' });
    expect((input as HTMLInputElement).value).toBe('02/29/');

    fireEvent.input(input, { target: { value: '02/29/' } });

    expect(screen.queryByText('Please select a valid date.')).toBeNull();

    fireEvent.input(input, { target: { value: '02/29/2025' } });

    expect(screen.getByText('Please select a valid date.')).toBeDefined();
    expect(onChange).toHaveBeenLastCalledWith('02/29/2025');
    expect((input as HTMLInputElement).value).toBe('02/29/2025');

    fireEvent.input(input, { target: { value: '02/29/' } });

    expect(screen.queryByText('Please select a valid date.')).toBeNull();

    fireEvent.blur(input);

    expect(onChange).toHaveBeenLastCalledWith('02/29/');
    expect((input as HTMLInputElement).value).toBe('02/29/');
    expect(screen.getByText('Please select a valid date.')).toBeDefined();
  });
});
