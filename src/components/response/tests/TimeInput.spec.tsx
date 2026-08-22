import { MantineProvider } from '@mantine/core';
import { cleanup, render } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import type { TimeResponse } from '../../../parser/types';
import { TimeResponseInput } from '../TimeInput';

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

describe('TimeResponseInput', () => {
  test('enables seconds in the native time input', () => {
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
      <MantineProvider>
        <TimeResponseInput
          response={response}
          disabled={false}
          answer={{ value: '14:28:30' }}
          index={1}
          enumerateQuestions={false}
        />
      </MantineProvider>,
    );

    const input = container.querySelector('input[type="time"]');
    expect(input?.getAttribute('step')).toBe('1');
    expect(input?.getAttribute('min')).toBe('09:00:00');
    expect(input?.getAttribute('max')).toBe('18:00:00');
    expect((input as HTMLInputElement).value).toBe('14:28:30');
  });
});
