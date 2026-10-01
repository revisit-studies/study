import { MantineProvider } from '@mantine/core';
import {
  cleanup, fireEvent, render, screen, waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  ] as const)('renders an $options picker input', ({ options, value, prompt }) => {
    const response: DateResponse = {
      id: options,
      prompt,
      type: 'date',
      options,
      required: true,
    };

    render(
      <MantineProvider env="test">
        <DateResponseInput
          response={response}
          disabled={false}
          answer={{ value }}
          index={1}
          enumerateQuestions={false}
        />
      </MantineProvider>,
    );

    const pickerInput = document.querySelector<HTMLButtonElement>('[data-dates-input]');
    expect(pickerInput?.textContent).toBe(value);
    expect(screen.queryByRole('button', { name: `Open ${options} picker` })).toBeNull();
  });

  test.each([
    {
      options: 'month', initialValue: '06/2026', selectedLabel: 'Jul', expectedValue: '07/2026',
    },
    {
      options: 'year', initialValue: '2026', selectedLabel: '2027', expectedValue: '2027',
    },
  ] as const)('stores a $options picker selection', async ({
    options, initialValue, selectedLabel, expectedValue,
  }) => {
    const onChange = vi.fn();
    const response: DateResponse = {
      id: options,
      prompt: `Select a ${options}.`,
      type: 'date',
      options,
      required: true,
    };

    function TestPartialDateInput() {
      const [value, setValue] = useState<string>(initialValue);
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
      <MantineProvider env="test">
        <TestPartialDateInput />
      </MantineProvider>,
    );

    const pickerInput = document.querySelector<HTMLButtonElement>('[data-dates-input]');
    expect(pickerInput).not.toBeNull();
    fireEvent.click(pickerInput!);
    fireEvent.click(await screen.findByRole('button', { name: selectedLabel }));

    expect(onChange).toHaveBeenLastCalledWith(expectedValue);
    expect(pickerInput?.textContent).toBe(expectedValue);
  });

  test('does not repartition a date value after a cursor edit', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const response: DateResponse = {
      id: 'date',
      prompt: 'Select a date.',
      type: 'date',
      required: true,
    };

    function TestDateInput() {
      const [value, setValue] = useState('06/24/2026');
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
      <MantineProvider env="test">
        <TestDateInput />
      </MantineProvider>,
    );

    const input = screen.getByPlaceholderText('MM/DD/YYYY') as HTMLInputElement;
    await user.click(input);
    input.setSelectionRange(1, 1);
    await user.keyboard('{Backspace}');

    expect(onChange).toHaveBeenLastCalledWith('6/24/2026');
    expect(input.value).toBe('6/24/2026');
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
      <MantineProvider env="test">
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

  test('stores a calendar selection in MM/DD/YYYY format', async () => {
    const onChange = vi.fn();
    const response: DateResponse = {
      id: 'date',
      prompt: 'Select a date.',
      type: 'date',
      required: true,
    };

    function TestDateInput() {
      const [value, setValue] = useState('06/24/2026');
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
      <MantineProvider env="test">
        <TestDateInput />
      </MantineProvider>,
    );

    fireEvent.focus(screen.getByPlaceholderText('MM/DD/YYYY'));
    await waitFor(() => {
      expect(document.querySelector('[data-dates-dropdown]')?.getAttribute('data-position'))
        .toBe('bottom-start');
    });
    fireEvent.click(await screen.findByRole('button', { name: '25 June 2026' }));

    expect(onChange).toHaveBeenLastCalledWith('06/25/2026');
    expect((screen.getByPlaceholderText('MM/DD/YYYY') as HTMLInputElement).value).toBe('06/25/2026');
  });
});
