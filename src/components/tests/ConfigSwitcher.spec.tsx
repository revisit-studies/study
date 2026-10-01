import { AriaRole, ReactNode } from 'react';
import {
  render, act, cleanup, waitFor,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import type {
  ParsedConfig, ParserErrorWarning, StudyConfig,
} from '../../parser/types';
import { ConfigSwitcher, FACTOR_DEMO_CONFIG_NAMES } from '../ConfigSwitcher';
import { makeGlobalConfig, makeStorageEngine, makeStudyConfig } from '../../tests/utils';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { useAuth } from '../../store/hooks/useAuth';
import { getSequenceConditions } from '../../utils/handleConditionLogic';
import { REVISIT_MODE } from '../../storage/engines/types';

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@mantine/core', () => ({
  Anchor: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  AppShell: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    { Main: ({ children }: { children: ReactNode }) => <main>{children}</main> },
  ),
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({ children, onClick, href }: { children: ReactNode; onClick?: () => void; href?: string }) => (
    href ? <a href={href}>{children}</a> : <button type="button" onClick={onClick}>{children}</button>
  ),
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Container: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CopyButton: ({ children }: { children: (props: { copied: boolean; copy: () => void }) => ReactNode }) => (
    <div>{children({ copied: false, copy: vi.fn() })}</div>
  ),
  Divider: () => <hr />,
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Image: ({ src, alt }: { src?: string; alt?: string }) => <img src={src} alt={alt} />,
  MultiSelect: ({ data }: { data: { value: string; label: string }[] }) => (
    <select aria-label="Conditions">{data.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select>
  ),
  Skeleton: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  rem: (v: number) => `${v}px`,
  Tabs: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    {
      List: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Tab: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Panel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    },
  ),
  Text: ({ children, span, role }: { children: ReactNode; span?: boolean; role?: AriaRole }) => (
    span ? <span role={role}>{children}</span> : <p role={role}>{children}</p>
  ),
  Tooltip: ({ children, label }: { children: ReactNode; label: string }) => <div title={label}>{children}</div>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconBan: () => null,
  IconBrandFirebase: () => null,
  IconBrandSupabase: () => null,
  IconCamera: () => null,
  IconChartHistogram: () => null,
  IconCheck: () => null,
  IconCopy: () => null,
  IconDatabase: () => null,
  IconDeviceDesktop: () => null,
  IconExternalLink: () => null,
  IconGraph: () => null,
  IconGraphOff: () => null,
  IconListCheck: () => null,
  IconMicrophone: () => null,
  IconSchema: () => null,
  IconSchemaOff: () => null,
}));

vi.mock('firebase/firestore', () => ({
  Timestamp: { now: () => ({ toDate: () => new Date() }) },
}));

vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock('../../utils/sanitizeStringForUrl', () => ({
  sanitizeStringForUrl: (s: string) => s,
}));

vi.mock('../../utils/Prefix', () => ({ PREFIX: '/' }));

vi.mock('../ErrorLoadingConfig', () => ({
  ErrorLoadingConfig: () => <div data-testid="error-loading-config" />,
}));

vi.mock('../../analysis/interface/ParticipantStatusBadges', () => ({
  ParticipantStatusBadges: () => <div data-testid="status-badges" />,
}));

vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: vi.fn(() => ({ storageEngine: null })),
}));

vi.mock('../../store/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: { isAdmin: true, determiningStatus: false } })),
}));

vi.mock('../../utils/handleConditionLogic', () => ({
  getSequenceConditions: vi.fn(() => []),
}));

const useStudyRecordingsMock = vi.hoisted(() => vi.fn(() => ({ hasAudio: false, hasScreenRecording: false })));

vi.mock('../../utils/useStudyRecordings', () => ({
  useStudyRecordings: useStudyRecordingsMock,
}));

vi.mock('../../utils/useDeviceRules', () => ({
  useDeviceRules: () => ({
    isBrowserAllowed: true,
    isDeviceAllowed: true,
    isInputAllowed: true,
    isDisplayAllowed: true,
  }),
}));

vi.mock('../interface/DeviceRestrictionString', () => ({
  getUnmetDeviceRestrictionLines: vi.fn(() => []),
  getUnmetDeviceRestrictionTooltip: vi.fn(() => ''),
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

const globalConfig = makeGlobalConfig({ configsList: ['test-study'] });

const minimalStudyConfig = makeStudyConfig();

const parsedStudyConfig: ParsedConfig<StudyConfig> = {
  ...minimalStudyConfig,
  errors: [],
  warnings: [],
};

const studyConfigs: Record<string, ParsedConfig<StudyConfig> | null> = {
  'test-study': parsedStudyConfig,
};

const makeAuthValue = (isAdmin: boolean): ReturnType<typeof useAuth> => ({
  user: {
    user: isAdmin ? { email: 'admin@example.com', uid: 'admin' } : null,
    determiningStatus: false,
    isAdmin,
    adminVerification: false,
  },
  logout: async () => {},
  triggerAuth: () => {},
  verifyAdminStatus: async () => false,
});

const makeLandingEngine = (modes: Partial<Record<REVISIT_MODE, boolean>> = {}, hidden = false) => ({
  getModes: vi.fn().mockResolvedValue({
    dataCollectionEnabled: true,
    developmentModeEnabled: false,
    dataSharingEnabled: false,
    ...modes,
  }),
  getStudyHiddenFromLandingPage: vi.fn().mockResolvedValue(hidden),
  getParticipantsStatusCounts: vi.fn().mockResolvedValue({
    completed: 5, inProgress: 2, rejected: 1, minTime: 1000, maxTime: 2000,
  }),
  getConditionData: vi.fn().mockResolvedValue({ conditionCounts: { default: 5, condA: 2 } }),
  getEngine: vi.fn().mockReturnValue('firebase'),
});

// ── tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(makeAuthValue(true));
  vi.mocked(useStorageEngine).mockReturnValue({ storageEngine: makeStorageEngine(makeLandingEngine({ dataSharingEnabled: true })), setStorageEngine: vi.fn() });
  vi.mocked(getSequenceConditions).mockReturnValue([]);
});
afterEach(() => {
  cleanup();
  vi.mocked(useAuth).mockImplementation(() => makeAuthValue(true));
});

describe('ConfigSwitcher', () => {
  test.each([
    { engineName: 'firebase', isAdmin: false },
    { engineName: 'supabase', isAdmin: false },
    { engineName: 'localStorage', isAdmin: true },
    { engineName: 'firebase', isAdmin: true },
    { engineName: 'supabase', isAdmin: true },
  ])('shows study status and activity but hides private analytics and count pills: %j', async ({ engineName, isAdmin }) => {
    const engine = makeLandingEngine();
    engine.getEngine.mockReturnValue(engineName);
    vi.mocked(useStorageEngine).mockReturnValue({ storageEngine: makeStorageEngine(engine), setStorageEngine: vi.fn() });
    vi.mocked(useAuth).mockReturnValue(makeAuthValue(isAdmin));
    vi.mocked(getSequenceConditions).mockReturnValue(['condA']);
    const configs = {
      'test-study': {
        ...parsedStudyConfig,
        warnings: [{
          instancePath: '', message: 'Private warning', params: {}, category: 'unused-component',
        } as ParserErrorWarning],
      },
    };

    const view = await act(async () => render(<ConfigSwitcher globalConfig={globalConfig} studyConfigs={configs} />));

    expect(view.getByText('Test Study')).toBeDefined();
    expect(view.getByRole('link', { name: 'Go to Study' }).getAttribute('href')).toBe('/test-study');
    expect(view.queryByRole('link', { name: 'Analyze & Manage Study' })).toBeNull();
    expect(view.queryByTestId('status-badges')).toBeNull();
    expect(view.queryByTestId('error-loading-config')).toBeNull();
    expect(view.getByText(/Study Status:/).textContent).toContain('Collecting Data');
    expect(view.getByTitle(/Development mode/)).toBeDefined();
    expect(view.getByTitle(/Data sharing/)).toBeDefined();
    expect(view.getByTitle(/storage|Firebase|Supabase/)).toBeDefined();
    expect(view.getByText(/Activity:/)).toBeDefined();
    expect(view.getByRole('option', { name: 'condA' })).toBeDefined();
    expect(view.container.textContent).not.toContain('participants');
    expect(engine.getParticipantsStatusCounts).toHaveBeenCalledWith('test-study');
    expect(engine.getConditionData).not.toHaveBeenCalled();
  });

  test.each([false, true])('hides a study from public visitors independently of data sharing (%s)', async (dataSharingEnabled) => {
    const engine = makeLandingEngine({ dataSharingEnabled }, true);
    vi.mocked(useStorageEngine).mockReturnValue({ storageEngine: makeStorageEngine(engine), setStorageEngine: vi.fn() });
    vi.mocked(useAuth).mockReturnValue(makeAuthValue(false));

    const view = await act(async () => render(<ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigs} />));

    expect(view.queryByText('Test Study')).toBeNull();
    expect(view.queryByRole('link', { name: 'Go to Study' })).toBeNull();
    expect(engine.getParticipantsStatusCounts).not.toHaveBeenCalled();
    expect(engine.getConditionData).not.toHaveBeenCalled();
  });

  test.each(['localStorage', 'firebase', 'supabase'])('hides the entire study card from administrators using %s', async (engineName) => {
    const engine = makeLandingEngine({ dataSharingEnabled: true }, true);
    engine.getEngine.mockReturnValue(engineName);
    vi.mocked(useStorageEngine).mockReturnValue({ storageEngine: makeStorageEngine(engine), setStorageEngine: vi.fn() });
    vi.mocked(useAuth).mockReturnValue(makeAuthValue(true));

    const view = await act(async () => render(<ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigs} />));

    expect(view.queryByText('Test Study')).toBeNull();
    expect(view.queryByRole('link', { name: 'Go to Study' })).toBeNull();
    expect(engine.getParticipantsStatusCounts).not.toHaveBeenCalled();
    expect(engine.getConditionData).not.toHaveBeenCalled();
  });

  test.each([false, true])('reports the failed study without rendering its card when visibility cannot be loaded (admin: %s)', async (isAdmin) => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const engine = makeLandingEngine({ dataSharingEnabled: true });
    engine.getStudyHiddenFromLandingPage.mockRejectedValue(new Error('Visibility unavailable'));
    vi.mocked(useStorageEngine).mockReturnValue({ storageEngine: makeStorageEngine(engine), setStorageEngine: vi.fn() });
    vi.mocked(useAuth).mockReturnValue(makeAuthValue(isAdmin));

    const view = await act(async () => render(<ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigs} />));

    expect(view.getByRole('alert').textContent).toBe('Unable to load study visibility for: test-study. Check the storage connection and try again.');
    expect(view.queryByText('Test Study')).toBeNull();
    expect(engine.getParticipantsStatusCounts).not.toHaveBeenCalled();
    expect(engine.getConditionData).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test.each([false, true])('shows analytics when data sharing is enabled (admin: %s)', async (isAdmin) => {
    const engine = makeLandingEngine({ dataSharingEnabled: true });
    vi.mocked(useStorageEngine).mockReturnValue({ storageEngine: makeStorageEngine(engine), setStorageEngine: vi.fn() });
    vi.mocked(useAuth).mockReturnValue(makeAuthValue(isAdmin));
    vi.mocked(getSequenceConditions).mockReturnValue(['condA']);
    const configs = {
      'test-study': {
        ...parsedStudyConfig,
        warnings: [{
          instancePath: '', message: 'A warning', params: {}, category: 'unused-component',
        } as ParserErrorWarning],
      },
    };

    const view = await act(async () => render(<ConfigSwitcher globalConfig={globalConfig} studyConfigs={configs} />));

    expect(view.getByRole('link', { name: 'Analyze & Manage Study' }).getAttribute('href')).toBe('/analysis/stats/test-study');
    expect(view.getByTestId('status-badges')).toBeDefined();
    expect(view.getByTestId('error-loading-config')).toBeDefined();
    expect(view.getByText(/Study Status:/)).toBeDefined();
    expect(view.getByTitle(/Development mode/)).toBeDefined();
    expect(view.getByTitle(/Data sharing/)).toBeDefined();
    expect(view.getByTitle('Firebase enabled')).toBeDefined();
    expect(view.getByText(/Activity:/)).toBeDefined();
    expect(view.getByRole('option', { name: 'condA (2 participants)' })).toBeDefined();
    expect(engine.getParticipantsStatusCounts).toHaveBeenCalledWith('test-study');
    expect(engine.getConditionData).toHaveBeenCalledWith('test-study');
  });

  test('hides count pills and analytics but retains status and activity when sharing is turned off', async () => {
    const engine = makeLandingEngine({ dataSharingEnabled: true });
    vi.mocked(useStorageEngine).mockReturnValue({ storageEngine: makeStorageEngine(engine), setStorageEngine: vi.fn() });
    vi.mocked(getSequenceConditions).mockReturnValue(['condA']);
    const view = await act(async () => render(<ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigs} />));
    expect(view.getByTestId('status-badges')).toBeDefined();

    engine.getModes.mockResolvedValue({ dataCollectionEnabled: true, developmentModeEnabled: false, dataSharingEnabled: false });
    await act(async () => view.rerender(<ConfigSwitcher globalConfig={{ ...globalConfig, configsList: [...globalConfig.configsList] }} studyConfigs={studyConfigs} />));

    expect(view.queryByTestId('status-badges')).toBeNull();
    expect(view.getByText(/Activity:/)).toBeDefined();
    expect(view.queryByRole('link', { name: 'Analyze & Manage Study' })).toBeNull();
    expect(view.getByText(/Study Status:/)).toBeDefined();
    expect(view.getByTitle(/Development mode/)).toBeDefined();
    expect(view.getByRole('option', { name: 'condA' })).toBeDefined();
    expect(engine.getParticipantsStatusCounts).toHaveBeenCalledWith('test-study');
    expect(engine.getConditionData).toHaveBeenCalledTimes(1);
  });

  test('does not expose parser errors for a study with private analytics', async () => {
    const engine = makeLandingEngine();
    vi.mocked(useStorageEngine).mockReturnValue({ storageEngine: makeStorageEngine(engine), setStorageEngine: vi.fn() });
    vi.mocked(useAuth).mockReturnValue(makeAuthValue(false));
    const configs = {
      'test-study': {
        errors: [{
          instancePath: '', message: 'Parse error', params: {}, category: 'invalid-config',
        }],
        warnings: [],
      } as unknown as ParsedConfig<StudyConfig>,
    };

    const view = await act(async () => render(<ConfigSwitcher globalConfig={globalConfig} studyConfigs={configs} />));

    expect(view.getByText('test-study')).toBeDefined();
    expect(view.queryByTestId('error-loading-config')).toBeNull();
    expect(getSequenceConditions).not.toHaveBeenCalled();
  });

  test('renders without crashing', async () => {
    const { container } = await act(async () => render(
      <ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigs} />,
    ));
    expect(container).toBeDefined();
  });

  test('renders with empty studyConfigs', async () => {
    const { container } = await act(async () => render(
      <ConfigSwitcher globalConfig={globalConfig} studyConfigs={{}} />,
    ));
    expect(container).toBeDefined();
  });

  test('renders with empty configsList', async () => {
    const emptyConfig = makeGlobalConfig();
    const { container } = await act(async () => render(
      <ConfigSwitcher globalConfig={emptyConfig} studyConfigs={{}} />,
    ));
    expect(container).toBeDefined();
  });

  test('renders config with errors', async () => {
    const mockError: ParserErrorWarning = {
      instancePath: '', message: 'Parse error occurred', params: {}, category: 'invalid-config',
    };
    const studyConfigsWithErrors: Record<string, ParsedConfig<StudyConfig> | null> = {
      'test-study': {
        errors: [mockError],
        warnings: [],
      } as unknown as ParsedConfig<StudyConfig>,
    };
    const { container } = await act(async () => render(
      <ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigsWithErrors} />,
    ));
    expect(container.textContent).toContain('test-study');
    expect(container.querySelector('[data-testid="error-loading-config"]')).not.toBeNull();
    expect(vi.mocked(getSequenceConditions)).not.toHaveBeenCalled();
    expect(useStudyRecordingsMock).not.toHaveBeenCalled();
  });

  test('renders config with warnings but no errors', async () => {
    const mockWarning: ParserErrorWarning = {
      instancePath: '', message: 'A warning message', params: {}, category: 'unused-component',
    };
    const studyConfigsWithWarnings: Record<string, ParsedConfig<StudyConfig> | null> = {
      'test-study': {
        ...minimalStudyConfig,
        errors: [],
        warnings: [mockWarning],
      },
    };
    const { container } = await act(async () => render(
      <ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigsWithWarnings} />,
    ));
    expect(container).toBeDefined();
  });

  test('renders study with conditions', async () => {
    vi.mocked(getSequenceConditions).mockReturnValueOnce(['condA', 'condB']);
    const { container } = await act(async () => render(
      <ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigs} />,
    ));
    expect(container.textContent).toContain('condA');
  });

  test('tab selection based on configName prefixes (demos, examples, etc.)', async () => {
    const multiGlobalConfig = makeGlobalConfig({
      configsList: ['demo-one', 'example-two', 'tutorial-three'],
    });
    const multiConfigs: Record<string, ParsedConfig<StudyConfig> | null> = {
      'demo-one': parsedStudyConfig,
      'example-two': parsedStudyConfig,
      'tutorial-three': parsedStudyConfig,
    };
    const { container } = await act(async () => render(
      <ConfigSwitcher globalConfig={multiGlobalConfig} studyConfigs={multiConfigs} />,
    ));
    expect(container).toBeDefined();
  });

  test('lists factor studies, including incentives-corr, in their own tab', async () => {
    expect(FACTOR_DEMO_CONFIG_NAMES).toEqual(new Set([
      'demo-factors',
      'demo-markdown-factors',
      'demo-stroop-factors',
      'demo-max-study2',
      'demo-ffl-study',
      'demo-dsf-study',
      'demo-calvi-study',
      'incentives-corr',
    ]));

    const factorDemoConfig = makeGlobalConfig({
      configsList: ['incentives-corr', 'demo-factors', 'demo-html'],
    });
    const factorDemoStudyConfigs: Record<string, ParsedConfig<StudyConfig> | null> = {
      'incentives-corr': parsedStudyConfig,
      'demo-factors': parsedStudyConfig,
      'demo-html': parsedStudyConfig,
    };
    const { container } = await act(async () => render(
      <ConfigSwitcher globalConfig={factorDemoConfig} studyConfigs={factorDemoStudyConfigs} />,
    ));

    expect(container.textContent).toContain('Factor-demos');
    expect(container.textContent).toContain('factors configuration language');
    expect(container.textContent).not.toContain('Your Studies');
  });

  test('renders with null config entry', async () => {
    const configsWithNull: Record<string, ParsedConfig<StudyConfig> | null> = {
      'test-study': null,
    };
    const { container } = await act(async () => render(
      <ConfigSwitcher globalConfig={globalConfig} studyConfigs={configsWithNull} />,
    ));
    expect(container).toBeDefined();
  });

  test('renders with a mock storageEngine that returns modes', async () => {
    const mockEngine = {
      getModes: vi.fn().mockResolvedValue({ dataCollectionEnabled: true, developmentModeEnabled: false, dataSharingEnabled: false }),
      getParticipantsStatusCounts: vi.fn().mockResolvedValue({
        completed: 5, inProgress: 2, rejected: 1, minTime: null, maxTime: null,
      }),
      getConditionData: vi.fn().mockResolvedValue({ conditionCounts: {} }),
      getEngine: vi.fn().mockReturnValue('firebase'),
    };
    vi.mocked(useStorageEngine).mockReturnValueOnce({ storageEngine: makeStorageEngine(mockEngine), setStorageEngine: vi.fn() });
    const { container } = await act(async () => render(
      <ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigs} />,
    ));
    expect(container).toBeDefined();
  });

  test('settles visibility loading and reports a failed mode lookup', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockEngine = {
      getModes: vi.fn((studyId: string) => (
        studyId === 'failed-study'
          ? Promise.reject(new Error('Firestore unavailable'))
          : Promise.resolve({ dataCollectionEnabled: true, developmentModeEnabled: true, dataSharingEnabled: true })
      )),
      getParticipantsStatusCounts: vi.fn().mockResolvedValue({
        completed: 0, inProgress: 0, rejected: 0, minTime: null, maxTime: null,
      }),
      isCloudEngine: vi.fn().mockReturnValue(true),
      getEngine: vi.fn().mockReturnValue('firebase'),
    };
    const multiGlobalConfig = makeGlobalConfig({ configsList: ['healthy-study', 'failed-study'] });
    const configs = {
      'healthy-study': parsedStudyConfig,
      'failed-study': {
        ...parsedStudyConfig,
        studyMetadata: { ...parsedStudyConfig.studyMetadata, title: 'Failed Study' },
      },
    };
    vi.mocked(useAuth).mockReturnValue(makeAuthValue(false));
    vi.mocked(useStorageEngine).mockReturnValue({ storageEngine: makeStorageEngine(mockEngine), setStorageEngine: vi.fn() });

    const { container } = await act(async () => render(
      <ConfigSwitcher globalConfig={multiGlobalConfig} studyConfigs={configs} />,
    ));

    await waitFor(() => expect(container.textContent).toContain('Unable to load study visibility for: failed-study. Check the storage connection and try again.'));
    expect(container.textContent).toContain('Test Study');
    expect(container.textContent).toContain('Ready to Collect Data');
    expect(container.textContent).not.toContain('Failed Study');
    expect(mockEngine.getModes).toHaveBeenCalledTimes(2);
    consoleSpy.mockRestore();
  });

  test('reports all failed mode lookups after loading settles', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockEngine = {
      getModes: vi.fn().mockRejectedValue(new Error('Firestore unavailable')),
      isCloudEngine: vi.fn().mockReturnValue(true),
      getEngine: vi.fn().mockReturnValue('firebase'),
    };
    const multiGlobalConfig = makeGlobalConfig({ configsList: ['failed-study-a', 'failed-study-b'] });
    const configs = { 'failed-study-a': null, 'failed-study-b': null };
    vi.mocked(useAuth).mockReturnValue(makeAuthValue(true));
    vi.mocked(useStorageEngine).mockReturnValue({ storageEngine: makeStorageEngine(mockEngine), setStorageEngine: vi.fn() });

    const { container } = await act(async () => render(
      <ConfigSwitcher globalConfig={multiGlobalConfig} studyConfigs={configs} />,
    ));

    await waitFor(() => {
      expect(container.textContent).toContain('failed-study-a');
      expect(container.textContent).toContain('failed-study-b');
    });
    expect(container.textContent).not.toContain('No studies found.');
    expect(mockEngine.getModes).toHaveBeenCalledTimes(2);
    consoleSpy.mockRestore();
  });
});
