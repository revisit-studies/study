import { ReactNode } from 'react';
import {
  cleanup, render, screen, waitFor,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { GlobalConfigParser } from '../GlobalConfigParser';

let mockStorageEngine: { getEngine: ReturnType<typeof vi.fn> } | undefined;
const mockSetStorageEngine = vi.fn((engine: { getEngine: ReturnType<typeof vi.fn> }) => {
  mockStorageEngine = engine;
});
const mockInitializeStorageEngine = vi.fn();
const mockParseGlobalConfig = vi.fn();
const mockFetchStudyConfigs = vi.fn();

vi.mock('../parser/parser', () => ({
  parseGlobalConfig: (configText: string) => mockParseGlobalConfig(configText),
}));

vi.mock('../utils/fetchConfig', () => ({
  fetchStudyConfigs: (globalConfig: object) => mockFetchStudyConfigs(globalConfig),
}));

vi.mock('../storage/initialize', () => ({
  initializeStorageEngine: () => mockInitializeStorageEngine(),
}));

vi.mock('../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({
    storageEngine: mockStorageEngine,
    setStorageEngine: mockSetStorageEngine,
  }),
}));

vi.mock('../store/hooks/useAuth', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <div data-testid="auth-provider">{children}</div>,
}));

vi.mock('react-router', () => ({
  BrowserRouter: ({ children }: { children: ReactNode }) => <div data-testid="browser-router">{children}</div>,
  Routes: ({ children }: { children: ReactNode }) => <div data-testid="routes">{children}</div>,
  Route: ({ element, path }: { element: ReactNode; path: string }) => <div data-testid={`route-${path}`}>{element}</div>,
}));

vi.mock('@mantine/modals', () => ({
  ModalsProvider: ({ children }: { children: ReactNode }) => <div data-testid="modals-provider">{children}</div>,
}));

vi.mock('@mantine/core', () => {
  const AppShell = Object.assign(
    ({ children }: { children: ReactNode }) => <div data-testid="app-shell">{children}</div>,
    {
      Main: ({ children }: { children: ReactNode }) => <main>{children}</main>,
    },
  );
  return { AppShell };
});

vi.mock('../components/ConfigSwitcher', () => ({
  ConfigSwitcher: ({ studyConfigs }: { studyConfigs: Record<string, object | null> }) => (
    <div data-testid="config-switcher">{Object.keys(studyConfigs).join(',')}</div>
  ),
}));

vi.mock('../components/Shell', () => ({
  Shell: () => <div data-testid="shell" />,
}));

vi.mock('../analysis/individualStudy/StudyAnalysisTabs', () => ({
  StudyAnalysisTabs: () => <div data-testid="study-analysis-tabs" />,
}));

vi.mock('../ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: ReactNode }) => <div data-testid="protected-route">{children}</div>,
}));

vi.mock('../Login', () => ({
  Login: () => <div data-testid="login" />,
}));

vi.mock('../components/settings/GlobalSettings', () => ({
  GlobalSettings: () => <div data-testid="global-settings" />,
}));

vi.mock('../utils/NavigateWithParams', () => ({
  NavigateWithParams: ({ to }: { to: string }) => <div data-testid={`navigate-${to}`} />,
}));

vi.mock('../analysis/interface/AppHeader', () => ({
  AppHeader: ({ studyIds }: { studyIds: string[] }) => <div data-testid="analysis-app-header">{studyIds.join(',')}</div>,
}));

vi.mock('../utils/PageTitle', () => ({
  PageTitle: ({ title }: { title: string }) => <div data-testid="page-title">{title}</div>,
}));

vi.mock('../utils/analysisRouteAccess', () => ({
  shouldProtectAnalysisRoute: vi.fn().mockResolvedValue(false),
}));

describe('GlobalConfigParser', () => {
  beforeEach(() => {
    mockStorageEngine = undefined;
    mockSetStorageEngine.mockClear();
    mockInitializeStorageEngine.mockResolvedValue({ getEngine: vi.fn().mockReturnValue('localStorage') });
    mockParseGlobalConfig.mockReturnValue({
      configsList: ['study-a'],
      configs: {
        'study-a': 'study-a/config.json',
      },
    });
    mockFetchStudyConfigs.mockResolvedValue({
      'study-a': {
        parsedConfig: {
          studyMetadata: {
            title: 'Study A',
          },
        },
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      text: vi.fn().mockResolvedValue('{"configsList":["study-a"]}'),
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  test('loads global config, initializes storage, and renders top-level routes', async () => {
    render(<GlobalConfigParser />);

    await waitFor(() => {
      expect(screen.getByTestId('browser-router')).toBeDefined();
    });

    expect(fetch).toHaveBeenCalledWith('/global.json');
    expect(mockParseGlobalConfig).toHaveBeenCalledWith('{"configsList":["study-a"]}');
    expect(mockInitializeStorageEngine).toHaveBeenCalled();
    expect(mockSetStorageEngine).toHaveBeenCalledWith(mockStorageEngine);
    expect(mockFetchStudyConfigs).toHaveBeenCalledWith(expect.objectContaining({ configsList: ['study-a'] }));
    await waitFor(() => {
      expect(screen.getByTestId('config-switcher').textContent).toBe('study-a');
    });
    expect(screen.getAllByTestId('study-analysis-tabs')).toHaveLength(2);
    expect(screen.getByTestId('global-settings')).toBeDefined();
    expect(screen.getByTestId('login')).toBeDefined();
  });
});
