import { MantineProvider } from '@mantine/core';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import {
  afterEach, beforeEach, expect, test, vi,
} from 'vitest';
import { ApplicationErrorBoundary } from '../ApplicationErrorBoundary';

function ThrowingChild(): ReactElement {
  throw new Error('render failed');
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

test('application boundary replaces an unexpected render error with the startup fallback', () => {
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const { getByRole } = render(
    <MantineProvider>
      <ApplicationErrorBoundary>
        <ThrowingChild />
      </ApplicationErrorBoundary>
    </MantineProvider>,
  );

  expect(getByRole('alert')).toBeDefined();
  expect(getByRole('heading', { name: 'ReVISit could not load' })).toBeDefined();
  expect(consoleSpy).toHaveBeenCalledWith(
    'Unexpected application render error:',
    expect.any(Error),
    expect.any(Object),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
