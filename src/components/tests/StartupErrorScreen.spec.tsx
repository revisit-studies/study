import { MantineProvider } from '@mantine/core';
import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { StartupErrorScreen } from '../StartupErrorScreen';

describe('StartupErrorScreen', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test('shows an accessible, sanitized error and moves focus to its heading', () => {
    const { getByRole, queryByText } = render(
      <MantineProvider>
        <StartupErrorScreen error={new Error('private backend detail')} showDetails={false} />
      </MantineProvider>,
    );

    expect(getByRole('alert')).toBeDefined();
    expect(getByRole('heading', { name: 'ReVISit could not load' })).toBe(document.activeElement);
    expect(getByRole('button', { name: 'Reload' })).toBeDefined();
    expect(queryByText(/private backend detail/)).toBeNull();
  });

  test('shows diagnostic details only when requested', () => {
    const { getByText } = render(
      <MantineProvider>
        <StartupErrorScreen error={new Error('development detail')} showDetails />
      </MantineProvider>,
    );

    expect(getByText(/development detail/)).toBeDefined();
  });

  test('reload action is keyboard accessible', async () => {
    const user = userEvent.setup();
    const reloadSpy = vi.fn();
    const { getByRole } = render(
      <MantineProvider>
        <StartupErrorScreen
          error={new Error('failure')}
          showDetails={false}
          onReload={reloadSpy}
        />
      </MantineProvider>,
    );

    getByRole('button', { name: 'Reload' }).focus();
    await user.keyboard('{Enter}');

    expect(reloadSpy).toHaveBeenCalledOnce();
  });
});
