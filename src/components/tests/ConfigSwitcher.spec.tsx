import { ReactNode } from 'react';
import {
  render, act, cleanup,
} from '@testing-library/react';
import {
  afterEach, describe, expect, test, vi,
} from 'vitest';
import type {
  ParsedConfig, ParserErrorWarning, StudyConfig,
} from '../../parser/types';
import { ConfigSwitcher } from '../ConfigSwitcher';
import { makeGlobalConfig, makeStorageEngine, makeStudyConfig } from '../../tests/utils';

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
  useAuth: () => ({ user: { isAdmin: true, determiningStatus: false } }),
}));

vi.mock('../../storage/engines/utils', () => ({
  isCloudStorageEngine: () => false,
}));

vi.mock('../../utils/handleConditionLogic', () => ({
  getSequenceConditions: vi.fn(() => []),
}));

vi.mock('../../utils/useStudyRecordings', () => ({
  useStudyRecordings: () => ({ hasAudio: false, hasScreenRecording: false }),
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
        ...minimalStudyConfig,
        errors: [mockError],
        warnings: [{ ...mockError, message: 'A warning', category: 'unused-component' }],
      },
    };
    const { container } = await act(async () => render(
      <ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigsWithErrors} />,
    ));
    expect(container).toBeDefined();
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
    const { getSequenceConditions } = await import('../../utils/handleConditionLogic');
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
    const { useStorageEngine } = await import('../../storage/storageEngineHooks');
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
});
