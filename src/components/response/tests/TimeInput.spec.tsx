import { MantineProvider } from '@mantine/core';
import {
  cleanup, fireEvent, render, screen, waitFor,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import type { TimeResponse } from '../../../parser/types';
import { TimeResponseInput } from '../TimeInput';

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

    const visibleInputs = Array.from(container.querySelectorAll<HTMLInputElement>('input:not([type="hidden"])'));
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

    render(
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

    fireEvent.change(screen.getByLabelText('Select a time. hours'), { target: { value: '23' } });
    fireEvent.change(screen.getByLabelText('Select a time. minutes'), { target: { value: '43' } });

    expect(onChange).toHaveBeenLastCalledWith('23:43');
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

    expect((screen.getByLabelText('Select a time. hours') as HTMLInputElement).value).toBe('02');
    expect((screen.getByLabelText('Select a time. minutes') as HTMLInputElement).value).toBe('28');
    expect((screen.getByLabelText('Select a time. am/pm') as HTMLInputElement).value).toBe('PM');
    expect((container.querySelector('input[type="hidden"]') as HTMLInputElement).value).toBe('14:28');
  });

  test('opens the time dropdown below the input', async () => {
    const response: TimeResponse = {
      id: 'time',
      prompt: 'Select a time.',
      type: 'time',
      required: true,
    };

    render(
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

    fireEvent.focus(screen.getByLabelText('Select a time. hours'));

    await waitFor(() => {
      expect(document.querySelector('.mantine-TimePicker-dropdown')?.getAttribute('data-position'))
        .toBe('bottom-start');
    });
  });
});
