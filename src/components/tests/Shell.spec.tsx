import { ReactNode } from 'react';
import {
  render, act, cleanup, waitFor,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { useRoutes } from 'react-router';
import { Shell } from '../Shell';
import type { ParsedConfig, StudyConfig } from '../../parser/types';
import { getStudyConfig, resolveConfigKey } from '../../utils/fetchConfig';
import { makeGlobalConfig, makeStudyConfig } from '../../tests/utils';
import { studyStoreCreator } from '../../store/store';
import { parseConditionParam } from '../../utils/handleConditionLogic';
import { parseStudyConfig } from '../../parser/parser';

// ── mutable state ─────────────────────────────────────────────────────────────

let mockStudyId = 'test-study';
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

vi.mock('../../ResourceNotFound', () => ({
  ResourceNotFound: () => <div data-testid="resource-not-found" />,
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
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock('@mantine/core', () => ({
  LoadingOverlay: ({ visible }: { visible: boolean }) => (
    visible ? <div data-testid="loading-overlay" /> : null
  ),
  Title: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
}));

vi.mock('react-redux', () => ({
  Provider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../store/store', () => ({
  studyStoreCreator: vi.fn().mockResolvedValue({
    store: { getState: vi.fn(), dispatch: vi.fn(), subscribe: vi.fn() },
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
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe('Shell', () => {
  beforeEach(() => {
    mockStudyId = 'test-study';
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
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  test('shows loading overlay when routes are not yet initialized', async () => {
    const { getByTestId } = await act(async () => render(<Shell globalConfig={globalConfig} />));
    expect(getByTestId('loading-overlay')).toBeDefined();
  });

  test('shows ResourceNotFound for an invalid study ID', async () => {
    vi.mocked(resolveConfigKey).mockReturnValue(null);
    const { getByTestId } = await act(async () => render(<Shell globalConfig={globalConfig} />));
    expect(getByTestId('resource-not-found')).toBeDefined();
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
      getAllConfigsFromHash: vi.fn().mockResolvedValue({}),
    };

    render(<Shell globalConfig={globalConfig} />);
    await waitFor(() => expect(mockStorageEngine!.initializeStudyDb).toHaveBeenCalled(), { timeout: 3000 });
    await waitFor(() => expect(vi.mocked(studyStoreCreator)).toHaveBeenCalled(), { timeout: 3000 });
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
      getAllConfigsFromHash: vi.fn().mockResolvedValue({}),
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
      getAllConfigsFromHash: vi.fn().mockResolvedValue({}),
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
      getAllConfigsFromHash: vi.fn().mockResolvedValue({ differentHash: mockActiveConfig }),
    };

    render(<Shell globalConfig={globalConfig} />);
    await waitFor(() => expect(mockStorageEngine!.getAllConfigsFromHash).toHaveBeenCalled(), { timeout: 3000 });
  });

  test('covers catch block when initializeStudyDb rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    vi.mocked(getStudyConfig).mockResolvedValue(mockActiveConfig);

    mockStorageEngine = {
      initializeStudyDb: vi.fn().mockRejectedValue(new Error('db init failed')),
    };

    render(<Shell globalConfig={globalConfig} />);
    await waitFor(() => expect(vi.mocked(studyStoreCreator)).toHaveBeenCalled(), { timeout: 3000 });

    consoleSpy.mockRestore();
  });
});
