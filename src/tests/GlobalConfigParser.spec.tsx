import { MantineProvider } from '@mantine/core';
import { cleanup, render, waitFor } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { GlobalConfigParser } from '../GlobalConfigParser';
import { parseGlobalConfig } from '../parser/parser';
import { initializeStorageEngine } from '../storage/initialize';
import { makeGlobalConfig } from './utils';

const setStorageEngine = vi.fn();

vi.mock('../parser/parser', () => ({
  parseGlobalConfig: vi.fn(),
}));

vi.mock('../storage/initialize', () => ({
  initializeStorageEngine: vi.fn(),
}));

vi.mock('../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({
    storageEngine: undefined,
    setStorageEngine,
  }),
}));

vi.mock('../components/ConfigSwitcher', () => ({
  ConfigSwitcher: () => null,
}));

vi.mock('../components/Shell', () => ({
  Shell: () => null,
}));

vi.mock('../analysis/individualStudy/StudyAnalysisTabs', () => ({
  StudyAnalysisTabs: () => null,
}));

vi.mock('../ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../Login', () => ({
  Login: () => null,
}));

vi.mock('../store/hooks/useAuth', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../components/settings/GlobalSettings', () => ({
  GlobalSettings: () => null,
}));

vi.mock('../utils/NavigateWithParams', () => ({
  NavigateWithParams: () => null,
}));

vi.mock('../analysis/interface/AppHeader', () => ({
  AppHeader: () => null,
}));

vi.mock('../utils/PageTitle', () => ({
  PageTitle: () => null,
}));

describe('GlobalConfigParser startup failures', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      text: vi.fn().mockResolvedValue('{}'),
    }));
    vi.mocked(parseGlobalConfig).mockReturnValue(makeGlobalConfig());
    vi.mocked(initializeStorageEngine).mockResolvedValue({} as never);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test('shows the fallback when global-config parsing rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(parseGlobalConfig).mockRejectedValue(new Error('invalid global config'));

    const { getByRole } = render(
      <MantineProvider>
        <GlobalConfigParser />
      </MantineProvider>,
    );

    await waitFor(() => expect(getByRole('alert')).toBeDefined());
    expect(consoleSpy).toHaveBeenCalledWith('Error loading global config:', expect.any(Error));
  });

  test('shows the fallback when storage-engine initialization rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(initializeStorageEngine).mockRejectedValue(new Error('storage unavailable'));

    const { getByRole } = render(
      <MantineProvider>
        <GlobalConfigParser />
      </MantineProvider>,
    );

    await waitFor(() => expect(getByRole('alert')).toBeDefined());
    expect(consoleSpy).toHaveBeenCalledWith('Error initializing storage engine:', expect.any(Error));
  });
});
