import { MantineProvider } from '@mantine/core';
import {
  cleanup, fireEvent, render, screen, waitFor,
} from '@testing-library/react';
import { useState } from 'react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import type { TimeResponse } from '../../../parser/types';
import { TimeResponseInput } from '../TimeInput';
import { validateResponse } from '../responseValidation';

class ResizeObserverMock {
  observe() {}

  unobserve() {}

  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
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

describe('TimeResponseInput', () => {
  function getVisibleInputs(container: HTMLElement) {
    return Array.from(container.querySelectorAll<HTMLInputElement>('input:not([type="hidden"])'));
  }

  test('renders a 24-hour time picker with seconds', () => {
    const response: TimeResponse = {
      id: 'time',
      prompt: 'Select a time.',
      type: 'time',
      required: true,
      withSeconds: true,
      min: '09:00:00',
      max: '18:00:00',
    };

    const { container } = render(
      <MantineProvider env="test">
        <TimeResponseInput
          response={response}
          disabled={false}
          answer={{ value: '14:28:30' }}
          index={1}
          enumerateQuestions={false}
        />
      </MantineProvider>,
    );

    const visibleInputs = getVisibleInputs(container);
    expect(visibleInputs.map((input) => input.value)).toEqual(['14', '28', '30']);
    expect(container.querySelector('select')).toBeNull();
    expect((container.querySelector('input[type="hidden"]') as HTMLInputElement).value).toBe('14:28:30');
  });

  test('reports a complete value in 24-hour format', () => {
    const onChange = vi.fn();
    const response: TimeResponse = {
      id: 'time',
      prompt: 'Select a time.',
      type: 'time',
      required: true,
    };

    const { container } = render(
      <MantineProvider env="test">
        <TimeResponseInput
          response={response}
          disabled={false}
          answer={{ value: '', onChange }}
          index={1}
          enumerateQuestions={false}
        />
      </MantineProvider>,
    );

    const [hoursInput, minutesInput] = getVisibleInputs(container);
    fireEvent.change(hoursInput, { target: { value: '23' } });
    fireEvent.change(minutesInput, { target: { value: '43' } });

    expect(onChange).toHaveBeenLastCalledWith('23:43');
  });

  test('keeps an out-of-range pasted value visible, stored, and invalid', () => {
    const onChange = vi.fn();
    const response: TimeResponse = {
      id: 'time',
      prompt: 'Select a time.',
      type: 'time',
      required: true,
      min: '09:00',
      max: '18:00',
    };

    function ControlledTimeInput() {
      const [value, setValue] = useState('');
      const validation = validateResponse(response, value, { [response.id]: value });

      return (
        <TimeResponseInput
          response={response}
          disabled={false}
          answer={{
            value,
            onChange: (nextValue) => {
              onChange(nextValue);
              setValue(nextValue);
            },
          }}
          error={validation.message}
          index={1}
          enumerateQuestions={false}
        />
      );
    }

    const { container } = render(
      <MantineProvider env="test">
        <ControlledTimeInput />
      </MantineProvider>,
    );

    const [hoursInput, minutesInput] = getVisibleInputs(container);
    fireEvent.paste(hoursInput, {
      clipboardData: { getData: () => '08:30' },
    });

    expect(onChange).toHaveBeenLastCalledWith('08:30');
    expect(hoursInput.value).toBe('08');
    expect(minutesInput.value).toBe('30');
    expect((container.querySelector('input[type="hidden"]') as HTMLInputElement).value).toBe('08:30');
    expect(screen.getByText('Please select a time between 09:00 and 18:00.')).toBeDefined();
  });

  test('displays a 12-hour picker while preserving a 24-hour value', () => {
    const response: TimeResponse = {
      id: 'time',
      prompt: 'Select a time.',
      type: 'time',
      required: true,
      format: '12h',
    };

    const { container } = render(
      <MantineProvider env="test">
        <TimeResponseInput
          response={response}
          disabled={false}
          answer={{ value: '14:28' }}
          index={1}
          enumerateQuestions={false}
        />
      </MantineProvider>,
    );

    const [hoursInput, minutesInput, amPmInput] = getVisibleInputs(container);
    expect(hoursInput.value).toBe('02');
    expect(minutesInput.value).toBe('28');
    expect(amPmInput.value).toBe('PM');
    expect((container.querySelector('input[type="hidden"]') as HTMLInputElement).value).toBe('14:28');
  });

  test('opens the time dropdown below the input', async () => {
    const response: TimeResponse = {
      id: 'time',
      prompt: 'Select a time.',
      type: 'time',
      required: true,
    };

    const { container } = render(
      <MantineProvider env="test">
        <TimeResponseInput
          response={response}
          disabled={false}
          answer={{ value: '14:28' }}
          index={1}
          enumerateQuestions={false}
        />
      </MantineProvider>,
    );

    fireEvent.focus(getVisibleInputs(container)[0]);

    await waitFor(() => {
      expect(document.querySelector('.mantine-TimePicker-dropdown')?.getAttribute('data-position'))
        .toBe('bottom-start');
    });
  });
});
