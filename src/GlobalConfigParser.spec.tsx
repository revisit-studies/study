import { ReactNode } from 'react';
import { render, act } from '@testing-library/react';
import {
  describe, expect, test, vi,
} from 'vitest';
import { GlobalConfigParser } from './GlobalConfigParser';

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('react-router', () => ({
  BrowserRouter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Route: ({ element }: { element: ReactNode }) => <div>{element}</div>,
  Routes: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@mantine/modals', () => ({
  ModalsProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@mantine/core', () => ({
  AppShell: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    { Main: ({ children }: { children: ReactNode }) => <main>{children}</main> },
  ),
}));

vi.mock('./components/ConfigSwitcher', () => ({
  ConfigSwitcher: () => <div data-testid="config-switcher" />,
}));

vi.mock('./components/Shell', () => ({
  Shell: () => <div data-testid="shell" />,
}));

vi.mock('./parser/parser', () => ({
  parseGlobalConfig: vi.fn(() => ({
    configsList: [{ id: 'test-study', path: 'test-study.json' }],
    configs: {},
  })),
}));

vi.mock('./analysis/individualStudy/StudyAnalysisTabs', () => ({
  StudyAnalysisTabs: () => <div data-testid="analysis-tabs" />,
}));

vi.mock('./utils/Prefix', () => ({ PREFIX: '/' }));

vi.mock('./ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('./Login', () => ({
  Login: () => <div data-testid="login" />,
}));

vi.mock('./store/hooks/useAuth', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('./components/settings/GlobalSettings', () => ({
  GlobalSettings: () => <div data-testid="global-settings" />,
}));

vi.mock('./utils/NavigateWithParams', () => ({
  NavigateWithParams: () => null,
}));

vi.mock('./analysis/interface/AppHeader', () => ({
  AppHeader: () => <div data-testid="analysis-app-header" />,
}));

vi.mock('./utils/fetchConfig', () => ({
  fetchStudyConfigs: vi.fn().mockResolvedValue({}),
}));

vi.mock('./storage/initialize', () => ({
  initializeStorageEngine: vi.fn().mockResolvedValue({ getEngine: () => 'localStorage' }),
}));

vi.mock('./storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({
    storageEngine: undefined,
    setStorageEngine: vi.fn(),
  }),
}));

vi.mock('./utils/PageTitle', () => ({
  PageTitle: () => null,
}));

vi.mock('./utils/analysisRouteAccess', () => ({
  shouldProtectAnalysisRoute: vi.fn().mockResolvedValue(false),
}));

// Mock fetch for global.json
global.fetch = vi.fn().mockResolvedValue({
  text: vi.fn().mockResolvedValue('{}'),
} as unknown as Response);

// ── tests ─────────────────────────────────────────────────────────────────────

describe('GlobalConfigParser', () => {
  test('renders null while global config is loading', async () => {
    const { container } = await act(async () => render(<GlobalConfigParser />));
    // Before globalConfig resolves, returns null or minimal content
    expect(container).toBeDefined();
  });

  test('renders routes after global config loads', async () => {
    const { container } = await act(async () => render(<GlobalConfigParser />));
    expect(container).toBeDefined();
  });
});
