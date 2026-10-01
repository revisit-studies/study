import { AriaRole, ReactNode } from 'react';
import * as Mantine from '@mantine/core';
import { MemoryRouter, useLocation } from 'react-router';
import {
  render as renderComponent, act, cleanup, fireEvent, waitFor, within,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import type {
  GlobalConfig, ParsedConfig, ParserErrorWarning, StudyConfig,
} from '../../parser/types';
import { ConfigSwitcher } from '../ConfigSwitcher';
import { makeGlobalConfig, makeStorageEngine, makeStudyConfig } from '../../tests/utils';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { useAuth } from '../../store/hooks/useAuth';
import { getSequenceConditions } from '../../utils/handleConditionLogic';
import { REVISIT_MODE } from '../../storage/engines/types';

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@mantine/core', async () => ({
  ...await vi.importActual<typeof Mantine>('@mantine/core'),
  Anchor: ({ children, href }: { children: ReactNode; href?: string }) => <a href={href}>{children}</a>,
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

const globalConfig = makeGlobalConfig({
  configsList: ['test-study'],
  configs: { 'test-study': { path: 'test-study/config.json' } },
});

function render(ui: ReactNode, initialEntry = '/') {
  return renderComponent(ui, {
    wrapper: ({ children }) => (
      <Mantine.MantineProvider env="test">
        <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
      </Mantine.MantineProvider>
    ),
  });
}

function LocationSearch() {
  const { search } = useLocation();
  return <output data-testid="location-search">{search}</output>;
}

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
  supabaseAuthStatus: 'loading',
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
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.mocked(useAuth).mockReturnValue(makeAuthValue(true));
  vi.mocked(useStorageEngine).mockReturnValue({ storageEngine: makeStorageEngine(makeLandingEngine({ dataSharingEnabled: true })), setStorageEngine: vi.fn() });
  vi.mocked(getSequenceConditions).mockReturnValue([]);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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
    const view = await act(async () => render(
      <ConfigSwitcher globalConfig={globalConfig} studyConfigs={{}} />,
    ));
    expect(view.getByText('Loading studies...')).toBeDefined();
    expect(view.queryByRole('tab')).toBeNull();
  });

  test('renders with empty configsList', async () => {
    const emptyConfig = makeGlobalConfig();
    const view = await act(async () => render(
      <ConfigSwitcher globalConfig={emptyConfig} studyConfigs={{}} />,
    ));
    expect(view.getByText(/No studies found/)).toBeDefined();
    expect(view.queryByRole('tab')).toBeNull();
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

  test('uses configured tab order, membership and descriptions with configsList card order', async () => {
    const config = makeGlobalConfig({
      tabs: [
        { label: 'Empty', description: 'Not displayed' },
        { label: 'Research', description: 'Our current research.' },
        { label: 'Examples', description: '' },
      ],
      configs: {
        'demo-one': { path: 'one.json', tab: 'Examples' },
        'example-two': { path: 'two.json', tab: 'Research' },
        'tutorial-three': { path: 'three.json', tab: 'Research' },
        unused: { path: 'unused.json', tab: 'Empty' },
      },
      configsList: ['tutorial-three', 'demo-one', 'example-two'],
    });
    const configs = Object.fromEntries(config.configsList.map((name) => [name, {
      ...parsedStudyConfig,
      studyMetadata: { ...parsedStudyConfig.studyMetadata, title: name },
    }]));
    const view = await act(async () => render(<ConfigSwitcher globalConfig={config} studyConfigs={configs} />));

    expect(view.getAllByRole('tab').map((element) => element.textContent)).toEqual(['Research', 'Examples']);
    expect(view.getByRole('tab', { name: 'Research' }).getAttribute('aria-selected')).toBe('true');
    const panel = view.getByRole('tabpanel');
    expect(within(panel).getByText('Our current research.')).toBeDefined();
    expect(within(panel).getAllByText(/^(tutorial-three|example-two)$/).map((element) => element.textContent))
      .toEqual(['tutorial-three', 'example-two']);
    expect(within(panel).queryByText('demo-one')).toBeNull();
    expect(view.queryByText('Not displayed')).toBeNull();

    fireEvent.click(view.getByRole('tab', { name: 'Examples' }));
    expect(within(view.getByRole('tabpanel')).getByText('demo-one')).toBeDefined();
    expect(within(view.getByRole('tabpanel')).queryByText('Our current research.')).toBeNull();
  });

  test('renders Markdown descriptions while keeping tab labels as plain text', async () => {
    const label = '**Research**';
    const config = makeGlobalConfig({
      ...globalConfig,
      tabs: [{ label, description: 'Our **current** research. [Guide](https://revisit.dev/docs/)\n\n- First step\n- Second step' }],
      configs: { 'test-study': { path: 'test.json', tab: label } },
    });
    const view = await act(async () => render(<ConfigSwitcher globalConfig={config} studyConfigs={studyConfigs} />));
    expect(view.getByRole('tab', { name: label }).querySelector('strong')).toBeNull();
    const panel = within(view.getByRole('tabpanel', { name: label }));
    expect(panel.getByText('current').tagName).toBe('STRONG');
    expect(panel.getByRole('link', { name: 'Guide' }).getAttribute('href')).toBe('https://revisit.dev/docs/');
    expect(panel.getAllByRole('listitem').map((element) => element.textContent)).toEqual(['First step', 'Second step']);
  });

  test.each([undefined, []] satisfies GlobalConfig['tabs'][])('uses Studies when tab definitions are %j', async (tabs) => {
    const config = makeGlobalConfig({
      tabs,
      configs: { 'demo-html': { path: 'demo-html/config.json' } },
      configsList: ['demo-html'],
    });
    const view = await act(async () => render(
      <ConfigSwitcher globalConfig={config} studyConfigs={{ 'demo-html': parsedStudyConfig }} />,
    ));
    expect(view.getAllByRole('tab').map((element) => element.textContent)).toEqual(['Studies']);
    expect(within(view.getByRole('tabpanel')).getByText('Test Study')).toBeDefined();
  });

  test('puts unassigned studies into the explicitly configured Studies tab without duplicating it', async () => {
    const config = makeGlobalConfig({
      tabs: [{ label: 'Studies', description: 'Available studies' }, { label: 'Unused' }],
      configs: {
        assigned: { path: 'assigned.json', tab: 'Studies' },
        unassigned: { path: 'unassigned.json' },
      },
      configsList: ['assigned', 'unassigned'],
    });
    const view = await act(async () => render(
      <ConfigSwitcher globalConfig={config} studyConfigs={{ assigned: parsedStudyConfig, unassigned: parsedStudyConfig }} />,
    ));
    expect(view.getAllByRole('tab').map((element) => element.textContent)).toEqual(['Studies']);
    expect(view.getByText('Available studies')).toBeDefined();
    expect(within(view.getByRole('tabpanel')).getAllByText('Test Study')).toHaveLength(2);
  });

  test('selects URL labels and encodes tab changes while preserving other query parameters', async () => {
    const label = 'Research & Introduction';
    const config = makeGlobalConfig({
      tabs: [{ label }],
      configs: {
        ...globalConfig.configs,
        assigned: { path: 'assigned.json', tab: label },
      },
      configsList: [...globalConfig.configsList, 'assigned'],
    });
    const view = await act(async () => render(
      <>
        <ConfigSwitcher globalConfig={config} studyConfigs={{ ...studyConfigs, assigned: parsedStudyConfig }} />
        <LocationSearch />
      </>,
      '/?tab=Studies&source=shared',
    ));
    expect(view.getByRole('tab', { name: 'Studies' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(view.getByRole('tab', { name: label }));
    const params = new URLSearchParams(view.getByTestId('location-search').textContent!);
    expect(params.get('tab')).toBe(label);
    expect(params.get('source')).toBe('shared');
    expect(view.getByRole('tab', { name: label }).getAttribute('aria-selected')).toBe('true');
    expect(within(view.getByRole('tabpanel', { name: label })).getByText('Test Study')).toBeDefined();
  });

  test.each(['Old label', 'Empty'])('falls back to the first visible tab for %s', async (requestedTab) => {
    const config = makeGlobalConfig({
      ...globalConfig,
      tabs: [{ label: 'Empty' }, { label: 'Current label' }],
      configs: { 'test-study': { path: 'test.json', tab: 'Current label' } },
    });
    const view = await act(async () => render(
      <ConfigSwitcher globalConfig={config} studyConfigs={studyConfigs} />,
      `/?tab=${encodeURIComponent(requestedTab)}`,
    ));
    expect(view.getByRole('tab', { name: 'Current label' }).getAttribute('aria-selected')).toBe('true');
    expect(view.queryByRole('tab', { name: 'Empty' })).toBeNull();
    expect(within(view.getByRole('tabpanel')).getByText('Test Study')).toBeDefined();
  });

  test('removes hidden tabs and falls back after visibility settings change', async () => {
    const config = makeGlobalConfig({
      tabs: [{ label: 'Private' }, { label: 'Public' }],
      configs: {
        private: { path: 'private.json', tab: 'Private' },
        public: { path: 'public.json', tab: 'Public' },
      },
      configsList: ['private', 'public'],
    });
    const configs = {
      private: { ...parsedStudyConfig, studyMetadata: { ...parsedStudyConfig.studyMetadata, title: 'Private study' } },
      public: parsedStudyConfig,
    };
    const storageEngine = makeStorageEngine(makeLandingEngine({ dataSharingEnabled: true }));
    vi.mocked(useStorageEngine).mockReturnValue({
      storageEngine,
      setStorageEngine: vi.fn(),
    });
    const view = await act(async () => render(
      <ConfigSwitcher globalConfig={config} studyConfigs={configs} />,
      '/?tab=Private',
    ));
    expect(view.getByRole('tab', { name: 'Private' }).getAttribute('aria-selected')).toBe('true');
    vi.mocked(storageEngine.getStudyHiddenFromLandingPage).mockImplementation(async (name) => name === 'private');
    await act(async () => view.rerender(
      <ConfigSwitcher globalConfig={{ ...config, configsList: [...config.configsList] }} studyConfigs={configs} />,
    ));
    expect(view.queryByRole('tab', { name: 'Private' })).toBeNull();
    expect(view.queryByText('Private study')).toBeNull();
    expect(view.getByRole('tab', { name: 'Public' }).getAttribute('aria-selected')).toBe('true');
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

  test('shows an unhidden Supabase study without persisted sharing modes but keeps analytics private', async () => {
    const mockEngine = {
      ...makeLandingEngine(),
      getAccessModes: vi.fn().mockResolvedValue(null),
      getEngine: vi.fn().mockReturnValue('supabase'),
    };
    vi.mocked(useAuth).mockReturnValue(makeAuthValue(false));
    vi.mocked(useStorageEngine).mockReturnValue({ storageEngine: makeStorageEngine(mockEngine), setStorageEngine: vi.fn() });
    const { container } = await act(async () => render(
      <ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigs} />,
    ));
    expect(mockEngine.getAccessModes).toHaveBeenCalledWith('test-study');
    expect(mockEngine.getModes).not.toHaveBeenCalled();
    expect(container.textContent).toContain(parsedStudyConfig.studyMetadata.title);
    expect(container.querySelector('a[href="/analysis/stats/test-study"]')).toBeNull();
    expect(container.textContent).not.toContain('Analyze & Manage Study');
    expect(container.querySelector('[data-testid="status-badges"]')).toBeNull();
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
    const multiGlobalConfig = makeGlobalConfig({
      configsList: ['healthy-study', 'failed-study'],
      configs: { 'healthy-study': { path: 'healthy.json' }, 'failed-study': { path: 'failed.json' } },
    });
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
