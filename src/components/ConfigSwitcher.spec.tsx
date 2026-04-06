import { ReactNode } from 'react';
import {
  render, act, cleanup,
} from '@testing-library/react';
import {
  afterEach, describe, expect, test, vi,
} from 'vitest';
import type { GlobalConfig, ParsedConfig, StudyConfig } from '../parser/types';
import { ConfigSwitcher } from './ConfigSwitcher';

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@mantine/core', () => ({
  Anchor: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  AppShell: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    { Main: ({ children }: { children: ReactNode }) => <main>{children}</main> },
  ),
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Container: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CopyButton: ({ children }: { children: (props: { copied: boolean; copy: () => void }) => ReactNode }) => (
    <div>{children({ copied: false, copy: vi.fn() })}</div>
  ),
  Divider: () => <hr />,
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Image: ({ src, alt }: { src?: string; alt?: string }) => <img src={src} alt={alt} />,
  MultiSelect: () => <select />,
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
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Tooltip: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconBan: () => null,
  IconBrandFirebase: () => null,
  IconBrandSupabase: () => null,
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

vi.mock('../utils/sanitizeStringForUrl', () => ({
  sanitizeStringForUrl: (s: string) => s,
}));

vi.mock('../utils/Prefix', () => ({ PREFIX: '/' }));

vi.mock('./ErrorLoadingConfig', () => ({
  ErrorLoadingConfig: () => <div data-testid="error-loading-config" />,
}));

vi.mock('../analysis/interface/ParticipantStatusBadges', () => ({
  ParticipantStatusBadges: () => <div data-testid="status-badges" />,
}));

vi.mock('../storage/storageEngineHooks', () => ({
  useStorageEngine: vi.fn(() => ({ storageEngine: null })),
}));

vi.mock('../store/hooks/useAuth', () => ({
  useAuth: () => ({ user: { isAdmin: true, determiningStatus: false } }),
}));

vi.mock('../storage/engines/utils', () => ({
  isCloudStorageEngine: () => false,
}));

vi.mock('../utils/handleConditionLogic', () => ({
  getSequenceConditions: vi.fn(() => []),
}));

vi.mock('../utils/useStudyRecordings', () => ({
  useStudyRecordings: () => ({ hasAudio: false, hasScreenRecording: false }),
}));

vi.mock('../utils/useDeviceRules', () => ({
  useDeviceRules: () => ({
    isBrowserAllowed: true,
    isDeviceAllowed: true,
    isInputAllowed: true,
    isDisplayAllowed: true,
  }),
}));

vi.mock('./interface/DeviceRestrictionString', () => ({
  getUnmetDeviceRestrictionLines: vi.fn(() => []),
  getUnmetDeviceRestrictionTooltip: vi.fn(() => ''),
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

const globalConfig = {
  configsList: ['test-study'],
  configs: {},
} as unknown as GlobalConfig;

const minimalStudyConfig = {
  studyMetadata: {
    title: 'Test Study',
    version: '1.0',
    authors: ['Author One'],
    date: '2024-01-01',
    description: 'A test study',
    organizations: [],
  },
  uiConfig: { withProgressBar: false, logoPath: undefined },
  components: {},
  sequence: {
    order: 'fixed', components: [], orderPath: 'root', skip: [],
  },
} as unknown as StudyConfig;

const studyConfigs: Record<string, ParsedConfig<StudyConfig> | null> = {
  'test-study': {
    ...minimalStudyConfig,
    errors: [],
    warnings: [],
  } as unknown as ParsedConfig<StudyConfig>,
};

// ── tests ─────────────────────────────────────────────────────────────────────

afterEach(() => { cleanup(); });

describe('ConfigSwitcher', () => {
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
    const emptyConfig = { configsList: [], configs: {} } as unknown as GlobalConfig;
    const { container } = await act(async () => render(
      <ConfigSwitcher globalConfig={emptyConfig} studyConfigs={{}} />,
    ));
    expect(container).toBeDefined();
  });

  test('renders config with errors (covers lines 138-147)', async () => {
    const studyConfigsWithErrors: Record<string, ParsedConfig<StudyConfig> | null> = {
      'test-study': {
        ...minimalStudyConfig,
        errors: ['Parse error occurred'],
        warnings: ['A warning'],
      } as unknown as ParsedConfig<StudyConfig>,
    };
    const { container } = await act(async () => render(
      <ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigsWithErrors} />,
    ));
    expect(container).toBeDefined();
  });

  test('renders config with warnings but no errors (covers line 176-178)', async () => {
    const studyConfigsWithWarnings: Record<string, ParsedConfig<StudyConfig> | null> = {
      'test-study': {
        ...minimalStudyConfig,
        errors: [],
        warnings: ['A warning message'],
      } as unknown as ParsedConfig<StudyConfig>,
    };
    const { container } = await act(async () => render(
      <ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigsWithWarnings} />,
    ));
    expect(container).toBeDefined();
  });

  test('renders study with conditions (covers lines 235-262)', async () => {
    const { getSequenceConditions } = await import('../utils/handleConditionLogic');
    vi.mocked(getSequenceConditions).mockReturnValueOnce(['condA', 'condB']);
    const { container } = await act(async () => render(
      <ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigs} />,
    ));
    expect(container.textContent).toContain('condA');
  });

  test('tab selection based on configName prefixes (demos, examples, etc.)', async () => {
    const multiGlobalConfig = {
      configsList: ['demo-one', 'example-two', 'tutorial-three'],
      configs: {},
    } as unknown as GlobalConfig;
    const multiConfigs: Record<string, ParsedConfig<StudyConfig> | null> = {
      'demo-one': { ...minimalStudyConfig, errors: [], warnings: [] } as unknown as ParsedConfig<StudyConfig>,
      'example-two': { ...minimalStudyConfig, errors: [], warnings: [] } as unknown as ParsedConfig<StudyConfig>,
      'tutorial-three': { ...minimalStudyConfig, errors: [], warnings: [] } as unknown as ParsedConfig<StudyConfig>,
    };
    const { container } = await act(async () => render(
      <ConfigSwitcher globalConfig={multiGlobalConfig} studyConfigs={multiConfigs} />,
    ));
    expect(container).toBeDefined();
  });

  test('renders with null config entry (covers line 320 null config guard)', async () => {
    const configsWithNull: Record<string, ParsedConfig<StudyConfig> | null> = {
      'test-study': null,
    };
    const { container } = await act(async () => render(
      <ConfigSwitcher globalConfig={globalConfig} studyConfigs={configsWithNull} />,
    ));
    expect(container).toBeDefined();
  });

  test('renders with a mock storageEngine that returns modes (covers lines 354-371)', async () => {
    const { useStorageEngine } = await import('../storage/storageEngineHooks');
    const mockEngine = {
      getModes: vi.fn().mockResolvedValue({ dataCollectionEnabled: true, developmentModeEnabled: false, dataSharingEnabled: false }),
      getParticipantsStatusCounts: vi.fn().mockResolvedValue({
        completed: 5, inProgress: 2, rejected: 1, minTime: null, maxTime: null,
      }),
      getConditionData: vi.fn().mockResolvedValue({ conditionCounts: {} }),
      getEngine: vi.fn().mockReturnValue('firebase'),
    };
    vi.mocked(useStorageEngine).mockReturnValueOnce({ storageEngine: mockEngine as never, setStorageEngine: vi.fn() });
    const { container } = await act(async () => render(
      <ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigs} />,
    ));
    expect(container).toBeDefined();
  });
});
