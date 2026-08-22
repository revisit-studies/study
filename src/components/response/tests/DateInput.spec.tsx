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
  ] as const)('renders an editable $options value', ({ options, value, prompt }) => {
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

    expect((screen.getByPlaceholderText(options === 'month' ? 'MM/YYYY' : 'YYYY') as HTMLInputElement).value)
      .toBe(value);
  });

  test.each([
    {
      options: 'month', typedValue: '062026', expectedValue: '06/2026', placeholder: 'MM/YYYY',
    },
    {
      options: 'year', typedValue: '2026', expectedValue: '2026', placeholder: 'YYYY',
    },
  ] as const)('stores a typed $options value', ({
    options, typedValue, expectedValue, placeholder,
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
        <TestPartialDateInput />
      </MantineProvider>,
    );

    const input = screen.getByPlaceholderText(placeholder);
    fireEvent.change(input, { target: { value: typedValue } });

    expect(onChange).toHaveBeenLastCalledWith(expectedValue);
    expect((input as HTMLInputElement).value).toBe(expectedValue);
  });

  test.each([
    {
      options: 'month', initialValue: '06/2026', selectedLabel: 'Jul', expectedValue: '07/2026', placeholder: 'MM/YYYY',
    },
    {
      options: 'year', initialValue: '2026', selectedLabel: '2027', expectedValue: '2027', placeholder: 'YYYY',
    },
  ] as const)('stores a $options picker selection', async ({
    options, initialValue, selectedLabel, expectedValue, placeholder,
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

    const input = screen.getByPlaceholderText(placeholder);
    fireEvent.click(screen.getByRole('button', { name: `Open ${options} picker` }));
    fireEvent.click(await screen.findByRole('button', { name: selectedLabel }));

    expect(onChange).toHaveBeenLastCalledWith(expectedValue);
    expect((input as HTMLInputElement).value).toBe(expectedValue);
  });

  test.each([
    {
      options: 'date', initialValue: '06/24/2026', placeholder: 'MM/DD/YYYY', expectedValue: '6/24/2026',
    },
    {
      options: 'month', initialValue: '06/2026', placeholder: 'MM/YYYY', expectedValue: '6/2026',
    },
  ] as const)('does not repartition a $options value after a cursor edit', async ({
    options, initialValue, placeholder, expectedValue,
  }) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const response: DateResponse = {
      id: options,
      prompt: `Select a ${options}.`,
      type: 'date',
      options,
      required: true,
    };

    function TestDateInput() {
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
        <TestDateInput />
      </MantineProvider>,
    );

    const input = screen.getByPlaceholderText(placeholder) as HTMLInputElement;
    await user.click(input);
    input.setSelectionRange(1, 1);
    await user.keyboard('{Backspace}');

    expect(onChange).toHaveBeenLastCalledWith(expectedValue);
    expect(input.value).toBe(expectedValue);
  });

  test('provides a keyboard path into and out of the month picker', async () => {
    const user = userEvent.setup();
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
    const response: DateResponse = {
      id: 'month',
      prompt: 'Select a month.',
      type: 'date',
      options: 'month',
      required: true,
    };

    render(
      <MantineProvider env="test">
        <DateResponseInput
          response={response}
          disabled={false}
          answer={{ value: '06/2026' }}
          index={1}
          enumerateQuestions={false}
        />
      </MantineProvider>,
    );

    const input = screen.getByPlaceholderText('MM/YYYY');
    const pickerButton = screen.getByRole('button', { name: 'Open month picker' });
    expect(input.getAttribute('aria-haspopup')).toBeNull();
    expect(pickerButton.getAttribute('aria-expanded')).toBe('false');
    await user.click(input);
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.tab();
    expect(document.activeElement).toBe(pickerButton);
    await user.keyboard('{Enter}');

    const dialog = await screen.findByRole('dialog');
    expect(pickerButton.getAttribute('aria-expanded')).toBe('true');
    expect(pickerButton.getAttribute('aria-controls')).toBe(dialog.id);
    expect(dialog.getAttribute('data-position')).toBe('bottom-start');
    await waitFor(() => {
      expect(document.activeElement).toBe(dialog.querySelector('[data-selected]'));
    });
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.activeElement).toBe(pickerButton);
    });
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
