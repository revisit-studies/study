import type { HTMLAttributes, ReactNode } from 'react';
import {
  render, act, cleanup, waitFor,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { useRoutes } from 'react-router';
import { Shell, StudyLoadingOverlay } from '../Shell';
import type { ParsedConfig, StudyConfig } from '../../parser/types';
import { getStudyConfig, resolveConfigKey } from '../../utils/fetchConfig';
import { makeGlobalConfig, makeStudyConfig } from '../../tests/utils';
import { studyStoreCreator } from '../../store/store';
import { parseConditionParam } from '../../utils/handleConditionLogic';
import { parseStudyConfig } from '../../parser/parser';
import { useStudyColorMode } from '../AppThemeProvider';
import type { ParticipantMetadata } from '../../store/types';

// ── mutable state ─────────────────────────────────────────────────────────────

let mockStudyId = 'test-study';
let mockSystemColorMode: 'light' | 'dark' = 'light';
let mockSearchParams = new URLSearchParams();
let mockStorageEngine: Record<string, ReturnType<typeof vi.fn>> | null = null;

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../routes/utils', () => ({
  useStudyId: () => mockStudyId,
}));

vi.mock('../../utils/fetchConfig', () => ({
  getStudyConfig: vi.fn().mockResolvedValue(null),
  resolveConfigKey: vi.fn(() => 'test-study'),
}));

vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: mockStorageEngine }),
}));

vi.mock('../AppThemeProvider', () => ({
  useStudyColorMode: vi.fn(),
  useAppColorMode: () => ({ colorMode: localStorage.getItem('revisit-user-color-mode') ?? 'light' }),
}));

vi.mock('../../utils/handleRandomSequences', () => ({
  generateSequenceArray: vi.fn().mockResolvedValue([{
    id: 'root', order: 'fixed', components: [], skip: [], orderPath: 'root',
  }]),
}));

vi.mock('../../parser/parser', () => ({
  parseStudyConfig: vi.fn().mockResolvedValue({ components: {}, sequences: {} }),
}));

vi.mock('../../utils/handleConditionLogic', () => ({
  filterSequenceByCondition: vi.fn().mockReturnValue({
    id: 'root', order: 'fixed', components: [], skip: [], orderPath: 'root',
  }),
  parseConditionParam: vi.fn(() => []),
  resolveParticipantConditions: vi.fn(() => []),
}));

vi.mock('../../utils/encryptDecryptIndex', () => ({
  encryptIndex: vi.fn((x: number) => String(x)),
}));

vi.mock('../../storage/engines/utils', () => ({
  hash: vi.fn(() => 'abc123'),
}));

vi.mock('../ErrorLoadingConfig', () => ({
  ErrorLoadingConfig: () => <div data-testid="error-loading-config" />,
}));

vi.mock('../StartupErrorScreen', () => ({
  StartupErrorScreen: () => <div role="alert">startup fallback</div>,
}));

vi.mock('../../ResourceNotFound', () => ({
  ResourceNotFound: ({ email }: { email?: string }) => <div data-testid="resource-not-found" data-email={email} />,
}));

vi.mock('../StepRenderer', () => ({
  StepRenderer: () => <div data-testid="step-renderer" />,
}));

vi.mock('../../controllers/ComponentController', () => ({
  ComponentController: () => <div data-testid="component-controller" />,
}));

vi.mock('../../utils/NavigateWithParams', () => ({
  NavigateWithParams: () => null,
}));

vi.mock('react-router', () => ({
  useRoutes: vi.fn(() => <div data-testid="routing" />),
  useSearchParams: () => [mockSearchParams, vi.fn()],
}));

vi.mock('@mantine/core', () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
  LoadingOverlay: ({ visible }: { visible: boolean }) => (
    visible ? <div data-testid="loading-overlay" /> : null
  ),
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
  Title: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
}));

vi.mock('react-redux', () => ({
  Provider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../store/store', () => ({
  studyStoreCreator: vi.fn().mockResolvedValue({
    store: { getState: vi.fn(() => ({ config: { uiConfig: {} }, metadata: {} })), dispatch: vi.fn(), subscribe: vi.fn() },
  }),
  StudyStoreContext: {
    Provider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  },
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

const globalConfig = makeGlobalConfig({
  configsList: ['test-study'],
  configs: { 'test-study': { path: 'test-study.json' } },
});

const mockActiveConfig: ParsedConfig<StudyConfig> = {
  ...makeStudyConfig(),
  errors: [],
  warnings: [],
};

const baseSession = {
  participantId: 'p1',
  participantConfigHash: 'abc123', // matches hash() mock default return
  searchParams: {},
  conditions: [],
  sequence: {
    id: 'root', order: 'fixed', components: [], skip: [], orderPath: 'root',
  },
  completed: false,
  answers: {},
  metadata: {
    language: 'en', userAgent: 'test', resolution: {}, ip: '',
  },
};

function setupThemeSession(colorMode: StudyConfig['uiConfig']['colorMode'], savedMetadata?: ParticipantMetadata) {
  const config = { ...mockActiveConfig, uiConfig: { ...mockActiveConfig.uiConfig, colorMode } };
  vi.mocked(getStudyConfig).mockResolvedValue(config);
  mockStorageEngine = {
    initializeStudyDb: vi.fn().mockResolvedValue(undefined),
    saveConfig: vi.fn().mockResolvedValue(undefined),
    getSequenceArray: vi.fn().mockResolvedValue(['seq1']),
    getModes: vi.fn().mockResolvedValue({ developmentModeEnabled: false, dataSharingEnabled: false, dataCollectionEnabled: true }),
    initializeParticipantSession: vi.fn(async (_params, _config, metadata) => ({
      ...baseSession, metadata: savedMetadata ?? metadata,
    })),
    getAllConfigsFromHash: vi.fn().mockResolvedValue({ abc123: config }),
    getParticipantCompletionStatus: vi.fn().mockResolvedValue(false),
    updateParticipantMetadata: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(true),
    getEngine: vi.fn().mockReturnValue('firebase'),
  };
  vi.mocked(studyStoreCreator).mockImplementationOnce(async (_id, runtimeConfig, _sequence, metadata) => ({
    store: {
      getState: () => ({ config: runtimeConfig, metadata }),
      dispatch: vi.fn(),
      subscribe: vi.fn(),
    },
    actions: { setMetadata: vi.fn(), setParticipantCompleted: vi.fn() },
  }) as unknown as Awaited<ReturnType<typeof studyStoreCreator>>);
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('Shell', () => {
  beforeEach(() => {
    mockStudyId = 'test-study';
    mockSystemColorMode = 'light';
    localStorage.removeItem('revisit-user-color-mode');
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' && mockSystemColorMode === 'dark',
    })));
    mockSearchParams = new URLSearchParams();
    mockStorageEngine = null;
    vi.mocked(getStudyConfig).mockResolvedValue(null);
    vi.mocked(resolveConfigKey).mockReturnValue('test-study');
    vi.mocked(parseConditionParam).mockReturnValue([]);
    vi.mocked(useRoutes).mockReturnValue(<div data-testid="routing" />);
    // jsdom doesn't provide window.screen.orientation; stub it so Shell.tsx doesn't throw
    vi.stubGlobal('screen', {
      width: 1920,
      height: 1080,
      availWidth: 1920,
      availHeight: 1080,
      colorDepth: 24,
      pixelDepth: 24,
      orientation: { type: 'landscape-primary' },
    });
    // Always stub fetch so initializeUserStoreRouting never makes real network calls
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    localStorage.removeItem('revisit-user-color-mode');
  });

  test.each([
    ['userPreference', 'dark'], ['light', 'light'], ['dark', 'dark'], [undefined, 'light'],
  ] as const)('captures %s once as %s and preserves it when IP metadata arrives', async (configuredMode, expectedMode) => {
    mockSystemColorMode = 'dark';
    setupThemeSession(configuredMode);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ip: '1.2.3.4' }))));
    const view = render(<Shell globalConfig={globalConfig} />);
    await waitFor(() => expect(mockStorageEngine!.updateParticipantMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ colorMode: expectedMode, ip: '1.2.3.4' }),
    ));
    expect(mockStorageEngine!.initializeParticipantSession).toHaveBeenCalledWith({}, expect.anything(), expect.objectContaining({ colorMode: expectedMode }), undefined);
    mockSystemColorMode = 'light';
    view.rerender(<Shell globalConfig={globalConfig} />);
    expect(useStudyColorMode).toHaveBeenLastCalledWith(expectedMode);
    expect(mockStorageEngine!.initializeParticipantSession).toHaveBeenCalledTimes(1);
  });

  test.each(['light', 'dark'] as const)('uses system %s instead of the saved app preference', async (systemMode) => {
    mockSystemColorMode = systemMode;
    const appPreference = systemMode === 'dark' ? 'light' : 'dark';
    localStorage.setItem('revisit-user-color-mode', appPreference);
    setupThemeSession('userPreference');

    const view = render(<Shell globalConfig={globalConfig} />);

    await waitFor(() => expect(mockStorageEngine!.initializeParticipantSession).toHaveBeenCalledWith({}, expect.anything(), expect.objectContaining({ colorMode: systemMode }), undefined));
    await waitFor(() => expect(useStudyColorMode).toHaveBeenLastCalledWith(systemMode));
    expect(localStorage.getItem('revisit-user-color-mode')).toBe(appPreference);
    mockSystemColorMode = appPreference;
    localStorage.setItem('revisit-user-color-mode', systemMode);
    view.rerender(<Shell globalConfig={globalConfig} />);
    expect(useStudyColorMode).toHaveBeenLastCalledWith(systemMode);
    expect(mockStorageEngine!.initializeParticipantSession).toHaveBeenCalledTimes(1);
  });

  test.each([false, true])('uses the persisted participant mode on resume/replay (replay=%s)', async (isReplay) => {
    if (isReplay) mockSearchParams = new URLSearchParams('participantId=p1');
    setupThemeSession('userPreference', { ...baseSession.metadata, colorMode: 'dark' });
    render(<Shell globalConfig={globalConfig} />);
    await waitFor(() => expect(useStudyColorMode).toHaveBeenLastCalledWith('dark'));
    if (isReplay) expect(fetch).not.toHaveBeenCalled();
    expect(mockStorageEngine!.updateParticipantMetadata).not.toHaveBeenCalled();
  });

  test.each([false, true])('keeps the initial dark preference during startup recovery (disconnected=%s)', async (disconnected) => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      vi.stubEnv('VITE_STORAGE_ENGINE', 'firebase');
      mockSystemColorMode = 'dark';
      setupThemeSession('userPreference');
      mockStorageEngine!.initializeStudyDb.mockRejectedValue(new Error('db init failed'));
      mockStorageEngine!.isConnected.mockReturnValue(!disconnected);
      mockStorageEngine!.peekCurrentParticipantId = vi.fn().mockResolvedValue(undefined);

      const view = render(<Shell globalConfig={globalConfig} />);
      await waitFor(() => expect(studyStoreCreator).toHaveBeenCalled());
      expect(vi.mocked(studyStoreCreator).mock.calls[0][3].colorMode).toBe('dark');
      await waitFor(() => expect(useStudyColorMode).toHaveBeenLastCalledWith('dark'));
      mockSystemColorMode = 'light';
      view.rerender(<Shell globalConfig={globalConfig} />);
      expect(useStudyColorMode).toHaveBeenLastCalledWith('dark');
    } finally {
      consoleSpy.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  test.each([
    ['dark', 'dark'], ['light', 'light'], ['userPreference', 'light'], [undefined, 'light'],
  ] as const)('uses historical %s for legacy replay without recording a new preference', async (configuredMode, expectedMode) => {
    mockSystemColorMode = 'dark';
    mockSearchParams = new URLSearchParams('participantId=p1');
    setupThemeSession(configuredMode, baseSession.metadata);
    render(<Shell globalConfig={globalConfig} />);
    await waitFor(() => expect(studyStoreCreator).toHaveBeenCalled());
    await waitFor(() => expect(useStudyColorMode).toHaveBeenLastCalledWith(expectedMode));
    expect(mockStorageEngine!.updateParticipantMetadata).not.toHaveBeenCalled();
  });

  test('applies config color mode and clears the old config when navigating to another study', async () => {
    vi.mocked(getStudyConfig).mockResolvedValue({
      ...mockActiveConfig,
      uiConfig: { ...mockActiveConfig.uiConfig, colorMode: 'dark' },
    });
    const view = render(<Shell globalConfig={globalConfig} />);
    await waitFor(() => expect(useStudyColorMode).toHaveBeenLastCalledWith('dark'));

    mockStudyId = 'another-study';
    vi.mocked(resolveConfigKey).mockReturnValue('another-study');
    vi.mocked(getStudyConfig).mockReturnValue(new Promise(() => {}));
    view.rerender(<Shell globalConfig={globalConfig} />);
    expect(useStudyColorMode).toHaveBeenLastCalledWith(undefined);
    expect(view.getByTestId('loading-overlay')).toBeDefined();
  });

  test('shows loading context only after startup remains pending for 1.5 seconds', () => {
    vi.useFakeTimers();

    const { getByTestId, getByRole, queryByRole } = render(<StudyLoadingOverlay visible />);

    expect(getByTestId('loading-overlay')).toBeDefined();
    expect(queryByRole('status')).toBeNull();

    act(() => vi.advanceTimersByTime(1499));
    expect(queryByRole('status')).toBeNull();

    act(() => vi.advanceTimersByTime(1));
    expect(getByRole('status').textContent).toBe('Loading your study. This may take a moment.');
    expect(getByRole('status').getAttribute('aria-live')).toBe('polite');
    expect(getByRole('status').getAttribute('aria-atomic')).toBe('true');
  });

  test('cancels the loading message when startup completes before the delay', () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');

    const { queryByRole, queryByTestId, rerender } = render(<StudyLoadingOverlay visible />);

    rerender(<StudyLoadingOverlay visible={false} />);
    act(() => vi.advanceTimersByTime(1500));

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(queryByTestId('loading-overlay')).toBeNull();
    expect(queryByRole('status')).toBeNull();
  });

  test('removes loading context as soon as startup completes', () => {
    vi.useFakeTimers();

    const { getByRole, queryByRole, rerender } = render(<StudyLoadingOverlay visible />);

    act(() => vi.advanceTimersByTime(1500));
    expect(getByRole('status')).toBeDefined();

    rerender(<StudyLoadingOverlay visible={false} />);
    expect(queryByRole('status')).toBeNull();
  });

  test('shows loading overlay when routes are not yet initialized', async () => {
    const { getByTestId } = await act(async () => render(<Shell globalConfig={globalConfig} />));
    expect(getByTestId('loading-overlay')).toBeDefined();
  });

  test('shows startup fallback when study config loading rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    vi.mocked(getStudyConfig).mockRejectedValue(new Error('study config failed'));

    const { getByRole } = render(<Shell globalConfig={globalConfig} />);

    await waitFor(() => expect(getByRole('alert').textContent).toBe('startup fallback'));
    expect(consoleSpy).toHaveBeenCalledWith('Error loading study config:', expect.any(Error));
  });

  test('shows detailed config errors without initializing the participant store', async () => {
    vi.mocked(getStudyConfig).mockResolvedValue({
      errors: [{
        message: 'There was an issue validating your config file',
        instancePath: 'root',
        params: {},
        category: 'invalid-config',
      }],
      warnings: [],
    } as unknown as ParsedConfig<StudyConfig>);
    mockStorageEngine = {
      initializeStudyDb: vi.fn(),
    };

    const { getByTestId, getByText, queryByTestId } = render(
      <Shell globalConfig={globalConfig} />,
    );

    await waitFor(() => expect(getByTestId('error-loading-config')).toBeDefined());
    expect(getByText('Error loading config')).toBeDefined();
    expect(queryByTestId('loading-overlay')).toBeNull();
    expect(mockStorageEngine.initializeStudyDb).not.toHaveBeenCalled();
    expect(vi.mocked(studyStoreCreator)).not.toHaveBeenCalled();
  });

  test('shows ResourceNotFound for an invalid study ID', async () => {
    vi.mocked(resolveConfigKey).mockReturnValue(null);
    const { getByTestId } = await act(async () => render(<Shell globalConfig={globalConfig} />));
    expect(getByTestId('resource-not-found').getAttribute('data-email')).toBeNull();
  });

  test('__revisit-widget: canonicalStudyId returns routeStudyId', async () => {
    mockStudyId = '__revisit-widget';
    const { getByTestId } = await act(async () => render(<Shell globalConfig={globalConfig} />));
    // Widget is a valid study (isValidStudyId = true) but no activeConfig yet → loading
    expect(getByTestId('loading-overlay')).toBeDefined();
  });

  test('__revisit-widget: registers message listener, posts READY, handles CONFIG message', async () => {
    mockStudyId = '__revisit-widget';
    const addEventSpy = vi.spyOn(window, 'addEventListener');
    const postMessageSpy = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => { });

    const { unmount } = await act(async () => render(<Shell globalConfig={globalConfig} />));

    expect(addEventSpy).toHaveBeenCalledWith('message', expect.any(Function));
    expect(postMessageSpy).toHaveBeenCalledWith({ type: 'revisitWidget/READY' }, '*');

    // Dispatch CONFIG to cover the listener body
    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', {
        data: { type: 'revisitWidget/CONFIG', payload: '{}' },
      }));
    });
    await waitFor(() => expect(vi.mocked(parseStudyConfig)).toHaveBeenCalled());

    // Unmount triggers cleanup (removeEventListener)
    unmount();

    addEventSpy.mockRestore();
    postMessageSpy.mockRestore();
  });

  test('happy path: initializeUserStoreRouting runs and renders study', async () => {
    vi.mocked(getStudyConfig).mockResolvedValue(mockActiveConfig);

    mockStorageEngine = {
      initializeStudyDb: vi.fn().mockResolvedValue(undefined),
      saveConfig: vi.fn().mockResolvedValue(undefined),
      getSequenceArray: vi.fn().mockResolvedValue(['seq1']), // non-null → no setSequenceArray
      getModes: vi.fn().mockResolvedValue({ developmentModeEnabled: false, dataSharingEnabled: false, dataCollectionEnabled: true }),
      initializeParticipantSession: vi.fn().mockResolvedValue(baseSession),
      getParticipantCompletionStatus: vi.fn().mockResolvedValue(false),
      peekCurrentParticipantId: vi.fn().mockResolvedValue(undefined),
      getAllConfigsFromHash: vi.fn().mockResolvedValue({}),
      isConnected: vi.fn().mockReturnValue(true),
      getEngine: vi.fn().mockReturnValue('firebase'),
    };

    render(<Shell globalConfig={globalConfig} />);
    await waitFor(() => expect(mockStorageEngine!.initializeStudyDb).toHaveBeenCalled(), { timeout: 3000 });
    await waitFor(() => expect(vi.mocked(studyStoreCreator)).toHaveBeenCalled(), { timeout: 3000 });
  });

  test('passes the contact email to the unmatched-route fallback outside the study provider', async () => {
    vi.mocked(getStudyConfig).mockResolvedValue(mockActiveConfig);

    mockStorageEngine = {
      initializeStudyDb: vi.fn().mockResolvedValue(undefined),
      saveConfig: vi.fn().mockResolvedValue(undefined),
      getSequenceArray: vi.fn().mockResolvedValue(['seq1']), // non-null → no setSequenceArray
      getModes: vi.fn().mockResolvedValue({ developmentModeEnabled: false, dataSharingEnabled: false, dataCollectionEnabled: true }),
      initializeParticipantSession: vi.fn().mockResolvedValue(baseSession),
      getParticipantCompletionStatus: vi.fn().mockResolvedValue(false),
      peekCurrentParticipantId: vi.fn().mockResolvedValue(undefined),
      getAllConfigsFromHash: vi.fn().mockResolvedValue({}),
      isConnected: vi.fn().mockReturnValue(true),
      getEngine: vi.fn().mockReturnValue('firebase'),
    };

    vi.mocked(useRoutes).mockReturnValue(null);
    const { getByTestId } = render(<Shell globalConfig={globalConfig} />);
    await waitFor(() => expect(mockStorageEngine!.initializeStudyDb).toHaveBeenCalled(), { timeout: 3000 });
    await waitFor(() => expect(getByTestId('resource-not-found').getAttribute('data-email'))
      .toBe(mockActiveConfig.uiConfig.contactEmail));
  });

  test('calls setSequenceArray when getSequenceArray returns null', async () => {
    vi.mocked(getStudyConfig).mockResolvedValue(mockActiveConfig);

    mockStorageEngine = {
      initializeStudyDb: vi.fn().mockResolvedValue(undefined),
      saveConfig: vi.fn().mockResolvedValue(undefined),
      getSequenceArray: vi.fn().mockResolvedValue(null), // null → calls setSequenceArray
      setSequenceArray: vi.fn().mockResolvedValue(undefined),
      getModes: vi.fn().mockResolvedValue({ developmentModeEnabled: false, dataSharingEnabled: false, dataCollectionEnabled: true }),
      initializeParticipantSession: vi.fn().mockResolvedValue(baseSession),
      getParticipantCompletionStatus: vi.fn().mockResolvedValue(false),
      peekCurrentParticipantId: vi.fn().mockResolvedValue(undefined),
      getAllConfigsFromHash: vi.fn().mockResolvedValue({}),
      isConnected: vi.fn().mockReturnValue(true),
      getEngine: vi.fn().mockReturnValue('firebase'),
    };

    render(<Shell globalConfig={globalConfig} />);
    await waitFor(() => expect(mockStorageEngine!.setSequenceArray).toHaveBeenCalled(), { timeout: 3000 });
  });

  test('covers study condition update path', async () => {
    vi.mocked(getStudyConfig).mockResolvedValue(mockActiveConfig);
    vi.mocked(parseConditionParam).mockReturnValue(['condA']);

    mockStorageEngine = {
      initializeStudyDb: vi.fn().mockResolvedValue(undefined),
      saveConfig: vi.fn().mockResolvedValue(undefined),
      getSequenceArray: vi.fn().mockResolvedValue(['seq1']),
      getModes: vi.fn().mockResolvedValue({ developmentModeEnabled: true, dataSharingEnabled: true, dataCollectionEnabled: true }),
      initializeParticipantSession: vi.fn().mockResolvedValue({
        ...baseSession,
        conditions: ['condA'],
        searchParams: { condition: 'condA' },
      }),
      updateParticipantSearchParams: vi.fn().mockResolvedValue(undefined),
      updateStudyCondition: vi.fn().mockResolvedValue(undefined),
      getParticipantCompletionStatus: vi.fn().mockResolvedValue(false),
      peekCurrentParticipantId: vi.fn().mockResolvedValue(undefined),
      getAllConfigsFromHash: vi.fn().mockResolvedValue({}),
      isConnected: vi.fn().mockReturnValue(true),
      getEngine: vi.fn().mockReturnValue('firebase'),
    };

    render(<Shell globalConfig={globalConfig} />);
    await waitFor(() => expect(mockStorageEngine!.updateStudyCondition).toHaveBeenCalled(), { timeout: 3000 });
  });

  test('covers participantConfigHash mismatch → getAllConfigsFromHash', async () => {
    vi.mocked(getStudyConfig).mockResolvedValue(mockActiveConfig);

    mockStorageEngine = {
      initializeStudyDb: vi.fn().mockResolvedValue(undefined),
      saveConfig: vi.fn().mockResolvedValue(undefined),
      getSequenceArray: vi.fn().mockResolvedValue(['seq1']),
      getModes: vi.fn().mockResolvedValue({ developmentModeEnabled: false, dataSharingEnabled: false, dataCollectionEnabled: true }),
      initializeParticipantSession: vi.fn().mockResolvedValue({
        ...baseSession,
        participantConfigHash: 'differentHash', // differs from hash() mock ('abc123')
      }),
      getParticipantCompletionStatus: vi.fn().mockResolvedValue(false),
      peekCurrentParticipantId: vi.fn().mockResolvedValue(undefined),
      getAllConfigsFromHash: vi.fn().mockResolvedValue({ differentHash: mockActiveConfig }),
      isConnected: vi.fn().mockReturnValue(true),
      getEngine: vi.fn().mockReturnValue('firebase'),
    };

    render(<Shell globalConfig={globalConfig} />);
    await waitFor(() => expect(mockStorageEngine!.getAllConfigsFromHash).toHaveBeenCalled(), { timeout: 3000 });
  });

  test('covers catch block when initializeStudyDb rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    vi.mocked(getStudyConfig).mockResolvedValue(mockActiveConfig);

    mockStorageEngine = {
      initializeStudyDb: vi.fn().mockRejectedValue(new Error('db init failed')),
      isConnected: vi.fn().mockReturnValue(true),
      getEngine: vi.fn().mockReturnValue('firebase'),
      getModes: vi.fn().mockResolvedValue({ developmentModeEnabled: true, dataSharingEnabled: true, dataCollectionEnabled: true }),
      getParticipantCompletionStatus: vi.fn().mockResolvedValue(false),
      peekCurrentParticipantId: vi.fn().mockResolvedValue(undefined),
    };

    render(<Shell globalConfig={globalConfig} />);
    await waitFor(() => expect(vi.mocked(studyStoreCreator)).toHaveBeenCalled(), { timeout: 3000 });

    consoleSpy.mockRestore();
  });

  test('shows startup fallback when participant-store recovery also fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    vi.mocked(getStudyConfig).mockResolvedValue(mockActiveConfig);
    vi.mocked(studyStoreCreator).mockRejectedValueOnce(new Error('fallback store failed'));

    mockStorageEngine = {
      initializeStudyDb: vi.fn().mockRejectedValue(new Error('participant init failed')),
      isConnected: vi.fn().mockReturnValue(true),
      getEngine: vi.fn().mockReturnValue('firebase'),
      getModes: vi.fn().mockResolvedValue({
        developmentModeEnabled: false,
        dataSharingEnabled: false,
        dataCollectionEnabled: true,
      }),
      peekCurrentParticipantId: vi.fn().mockResolvedValue(undefined),
    };

    const { getByRole } = render(<Shell globalConfig={globalConfig} />);

    await waitFor(() => expect(getByRole('alert').textContent).toBe('startup fallback'));
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error initializing fallback study store:',
      expect.any(Error),
    );
  });
});
