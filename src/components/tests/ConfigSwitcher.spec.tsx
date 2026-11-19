import { AriaRole, ReactNode } from 'react';
import * as Mantine from '@mantine/core';
import { MemoryRouter } from 'react-router';
import {
  render as renderComponent, act, cleanup, fireEvent, waitFor, within,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import type {
  GlobalConfig, ParsedConfig, ParserErrorWarning, StudyConfig,
} from '../../parser/types';
import {
  ConfigSwitcher, groupConfigNames, OTHER_GROUP_LABEL, slugify,
} from '../ConfigSwitcher';
import {
  makeGlobalConfig, makeSequenceAssignment, makeStorageEngine, makeStudyConfig,
} from '../../tests/utils';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { useAuth } from '../../store/hooks/useAuth';
import { getSequenceConditions } from '../../utils/handleConditionLogic';
import { StudyModes } from '../../storage/engines/types';

// ── mocks ─────────────────────────────────────────────────────────────────────

const prefixMock = vi.hoisted(() => ({ value: '/' }));
const scrollIntoViewMock = vi.fn();
const assignLocation = vi.fn();

vi.mock('@mantine/core', async () => ({
  ...await vi.importActual<typeof Mantine>('@mantine/core'),
  Anchor: ({
    children, href, target, rel, 'aria-label': ariaLabel,
  }: { children: ReactNode; href?: string; target?: string; rel?: string; 'aria-label'?: string }) => (
    <a href={href} target={target} rel={rel} aria-label={ariaLabel}>{children}</a>
  ),
  AppShell: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    { Main: ({ children }: { children: ReactNode }) => <main>{children}</main> },
  ),
  Card: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    { Section: ({ children }: { children?: ReactNode }) => <div>{children}</div> },
  ),
  Container: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CopyButton: ({ children }: { children: (props: { copied: boolean; copy: () => void }) => ReactNode }) => (
    <div>{children({ copied: false, copy: vi.fn() })}</div>
  ),
  Divider: () => <hr />,
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Image: ({ src, alt }: { src?: string; alt?: string }) => <img src={src} alt={alt} />,
  Skeleton: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  rem: (v: number) => `${v}px`,
  Text: ({ children, span, role }: { children: ReactNode; span?: boolean; role?: AriaRole }) => (
    span ? <span role={role}>{children}</span> : <p role={role}>{children}</p>
  ),
  Tooltip: ({ children, label }: { children: ReactNode; label: string }) => <div title={label}>{children}</div>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconBrandGithub: () => null,
  IconAlertTriangle: () => null,
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

vi.mock('../../utils/Prefix', () => ({ get PREFIX() { return prefixMock.value; } }));

const getStaticAssetByPathMock = vi.hoisted(() => vi.fn<(path: string) => Promise<string | undefined>>());

vi.mock('../../utils/getStaticAsset', () => ({
  getStaticAssetByPath: getStaticAssetByPathMock,
}));

// The header needs the app theme provider; render only the navigation it receives.
vi.mock('../../analysis/interface/AppHeader', () => ({
  AppHeader: ({ navigation }: { navigation?: ReactNode }) => <header>{navigation}</header>,
}));

vi.mock('../ErrorLoadingConfig', () => ({
  ErrorLoadingConfig: () => <div data-testid="error-loading-config" />,
}));

vi.mock('../../analysis/interface/ParticipantStatusBadges', () => ({
  ParticipantStatusBadges: ({ showTimeoutStatuses }: { showTimeoutStatuses?: boolean }) => (
    <div data-testid="status-badges" data-show-timeout-statuses={showTimeoutStatuses ? 'true' : 'false'} />
  ),
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

function render(ui: ReactNode, initialEntry = '/', basename = '/') {
  return renderComponent(ui, {
    wrapper: ({ children }) => (
      <Mantine.MantineProvider env="test">
        <MemoryRouter initialEntries={[initialEntry]} basename={basename}>{children}</MemoryRouter>
      </Mantine.MantineProvider>
    ),
  });
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

const makeLandingEngine = (modes: Partial<StudyModes> = {}, hidden = false) => ({
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
  prefixMock.value = '/';
  vi.clearAllMocks();
  // jsdom does not implement scrolling.
  Element.prototype.scrollIntoView = scrollIntoViewMock;
  vi.stubGlobal('location', { ...window.location, assign: assignLocation });
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
    { label: 'Go to Study', path: '/test-study', prefix: '/' },
    { label: 'Analyze & Manage', path: '/analysis/stats/test-study', prefix: '/' },
    { label: 'Go to Study', path: '/study/test-study', prefix: '/study/' },
    { label: 'Analyze & Manage', path: '/study/analysis/stats/test-study', prefix: '/study/' },
  ])('loads a fresh page for $label under $prefix', async ({ label, path, prefix }) => {
    prefixMock.value = prefix;
    const view = await act(async () => render(
      <ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigs} />,
      prefix,
      prefix,
    ));

    fireEvent.click(view.getByRole('button', { name: label }));

    expect(assignLocation).toHaveBeenCalledExactlyOnceWith(path);
  });

  test('launches the condition chosen from the Go to Study menu under a base path', async () => {
    prefixMock.value = '/study/';
    vi.mocked(getSequenceConditions).mockReturnValue(['condA']);
    const view = await act(async () => render(
      <ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigs} />,
      '/study/',
      '/study/',
    ));

    fireEvent.click(view.getByRole('button', { name: 'Go to Study' }));
    fireEvent.click(await view.findByRole('menuitem', { name: /^condA/ }));

    expect(assignLocation).toHaveBeenCalledExactlyOnceWith('/study/test-study?condition=condA');
  });

  test.each([
    { engineName: 'firebase', isAdmin: false },
    { engineName: 'supabase', isAdmin: false },
    { engineName: 'localStorage', isAdmin: true },
    { engineName: 'firebase', isAdmin: true },
    { engineName: 'supabase', isAdmin: true },
  ])('shows study status but hides private analytics and count pills: %j', async ({ engineName, isAdmin }) => {
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
    expect(view.getByRole('button', { name: 'Go to Study' })).toBeDefined();
    expect(view.queryByRole('button', { name: 'Analyze & Manage' })).toBeNull();
    expect(view.queryByTestId('status-badges')).toBeNull();
    expect(view.queryByTestId('error-loading-config')).toBeNull();
    expect(view.getByText('Collecting Data')).toBeDefined();
    expect(view.getByTitle(/Development mode/)).toBeDefined();
    expect(view.getByTitle(/Data sharing/)).toBeDefined();
    expect(view.getByTitle(/storage|Firebase|Supabase/)).toBeDefined();
    fireEvent.click(view.getByRole('button', { name: 'Go to Study' }));
    expect(await view.findByRole('menuitem', { name: 'condA' })).toBeDefined();
    expect(view.container.textContent).not.toContain('participants');
    expect(engine.getParticipantsStatusCounts).toHaveBeenCalledWith('test-study');
    expect(engine.getConditionData).not.toHaveBeenCalled();
  });

  test('treats completed-late participant data as collected data', async () => {
    const engine = makeLandingEngine();
    engine.getParticipantsStatusCounts.mockResolvedValue({
      completed: 0,
      completedLate: 1,
      inProgress: 0,
      timedOut: 0,
      rejected: 0,
      minTime: 1000,
      maxTime: 2000,
    });
    vi.mocked(useStorageEngine).mockReturnValue({
      storageEngine: makeStorageEngine(engine),
      setStorageEngine: vi.fn(),
    });

    const view = await act(async () => render(
      <ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigs} />,
    ));

    expect(view.getByText('Collecting Data')).toBeDefined();
  });

  test.each([false, true])('hides a study from public visitors independently of data sharing (%s)', async (dataSharingEnabled) => {
    const engine = makeLandingEngine({ dataSharingEnabled }, true);
    vi.mocked(useStorageEngine).mockReturnValue({ storageEngine: makeStorageEngine(engine), setStorageEngine: vi.fn() });
    vi.mocked(useAuth).mockReturnValue(makeAuthValue(false));

    const view = await act(async () => render(<ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigs} />));

    expect(view.queryByText('Test Study')).toBeNull();
    expect(view.queryByRole('button', { name: 'Go to Study' })).toBeNull();
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
    expect(view.queryByRole('button', { name: 'Go to Study' })).toBeNull();
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
    const engine = makeLandingEngine({ dataSharingEnabled: true, autoTimeoutMinutes: 60 });
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

    expect(view.getByRole('button', { name: 'Analyze & Manage' })).toBeDefined();
    expect(view.getByTestId('status-badges')).toBeDefined();
    expect(view.getByTestId('status-badges').getAttribute('data-show-timeout-statuses')).toBe('true');
    expect(view.queryByTestId('error-loading-config')).toBeNull();
    fireEvent.click(view.getByRole('button', { name: 'Show 1 warning' }));
    expect(await view.findByTestId('error-loading-config')).toBeDefined();
    expect(view.getByText(/^(Collecting Data|Ready to Collect Data|Data Collection Disabled)$/)).toBeDefined();
    expect(view.getByTitle(/Development mode/)).toBeDefined();
    expect(view.getByTitle(/Data sharing/)).toBeDefined();
    expect(view.getByTitle('Firebase enabled')).toBeDefined();
    fireEvent.click(view.getByRole('button', { name: 'Go to Study' }));
    expect(await view.findByRole('menuitem', { name: 'condA (2 participants)' })).toBeDefined();
    expect(engine.getParticipantsStatusCounts).toHaveBeenCalledWith('test-study');
    expect(engine.getConditionData).toHaveBeenCalledWith('test-study');
  });

  test.each([
    { timedOut: 0, completedLate: 0, expected: 'false' },
    { timedOut: 2, completedLate: 0, expected: 'true' },
    { timedOut: 0, completedLate: 3, expected: 'true' },
  ])('shows timeout badges after auto-timeout is disabled only when timed-out ($timedOut) or completed-late ($completedLate) participants remain', async ({ timedOut, completedLate, expected }) => {
    const engine = makeLandingEngine({ dataSharingEnabled: true });
    engine.getParticipantsStatusCounts.mockResolvedValue({
      completed: 5, inProgress: 2, rejected: 1, timedOut, completedLate, minTime: 1000, maxTime: 2000,
    });
    vi.mocked(useStorageEngine).mockReturnValue({ storageEngine: makeStorageEngine(engine), setStorageEngine: vi.fn() });

    const view = await act(async () => render(<ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigs} />));

    expect(view.getByTestId('status-badges').getAttribute('data-show-timeout-statuses')).toBe(expected);
  });

  test('hides count pills and analytics but retains status when sharing is turned off', async () => {
    const engine = makeLandingEngine({ dataSharingEnabled: true });
    vi.mocked(useStorageEngine).mockReturnValue({ storageEngine: makeStorageEngine(engine), setStorageEngine: vi.fn() });
    vi.mocked(getSequenceConditions).mockReturnValue(['condA']);
    const view = await act(async () => render(<ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigs} />));
    expect(view.getByTestId('status-badges')).toBeDefined();
    expect(view.getByTestId('status-badges').getAttribute('data-show-timeout-statuses')).toBe('false');

    engine.getModes.mockResolvedValue({ dataCollectionEnabled: true, developmentModeEnabled: false, dataSharingEnabled: false });
    await act(async () => view.rerender(<ConfigSwitcher globalConfig={{ ...globalConfig, configsList: [...globalConfig.configsList] }} studyConfigs={studyConfigs} />));

    expect(view.queryByTestId('status-badges')).toBeNull();
    expect(view.queryByRole('button', { name: 'Analyze & Manage' })).toBeNull();
    expect(view.getByText(/^(Collecting Data|Ready to Collect Data|Data Collection Disabled)$/)).toBeDefined();
    expect(view.getByTitle(/Development mode/)).toBeDefined();
    fireEvent.click(view.getByRole('button', { name: 'Go to Study' }));
    expect(await view.findByRole('menuitem', { name: 'condA' })).toBeDefined();
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
    const view = await act(async () => render(
      <ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigsWithErrors} />,
    ));
    const { container } = view;
    expect(container.textContent).toContain('test-study');
    expect(container.textContent).toContain("This study can't be used right now.");
    expect(container.textContent).toContain('Select the error badge for details.');
    // Errors are summarized by a badge, with details only in its popover.
    expect(view.queryByTestId('error-loading-config')).toBeNull();
    fireEvent.click(view.getByRole('button', { name: 'Show 1 error' }));
    expect(await view.findByTestId('error-loading-config')).toBeDefined();
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

  const tabHeadings = (view: ReturnType<typeof render>) => view.getAllByRole('heading', { level: 3 }).map((element) => element.textContent);

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

    expect(tabHeadings(view)).toEqual(['Research', 'Examples']);
    const research = within(view.getByRole('region', { name: 'Research' }));
    expect(research.getByText('Our current research.')).toBeDefined();
    expect(research.getAllByText(/^(tutorial-three|example-two)$/).map((element) => element.textContent))
      .toEqual(['tutorial-three', 'example-two']);
    expect(research.queryByText('demo-one')).toBeNull();
    expect(within(view.getByRole('region', { name: 'Examples' })).getByText('demo-one')).toBeDefined();
    expect(view.queryByText('Not displayed')).toBeNull();
    expect(view.queryByRole('tab')).toBeNull();
  });

  test('renders Markdown descriptions while keeping tab labels as plain text', async () => {
    const label = '**Research**';
    const config = makeGlobalConfig({
      ...globalConfig,
      tabs: [{ label, description: 'Our **current** research. [Guide](https://revisit.dev/docs/)\n\n- First step\n- Second step' }],
      configs: { 'test-study': { path: 'test.json', tab: label } },
    });
    const view = await act(async () => render(<ConfigSwitcher globalConfig={config} studyConfigs={studyConfigs} />));
    expect(view.getByRole('heading', { level: 3, name: label }).querySelector('strong')).toBeNull();
    const section = within(view.getByRole('region', { name: label }));
    expect(section.getByText('current').tagName).toBe('STRONG');
    expect(section.getByRole('link', { name: 'Guide' }).getAttribute('href')).toBe('https://revisit.dev/docs/');
    expect(section.getAllByRole('listitem').map((element) => element.textContent)).toEqual(['First step', 'Second step']);
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
    expect(tabHeadings(view)).toEqual(['Studies']);
    expect(within(view.getByRole('region', { name: 'Studies' })).getByText('Test Study')).toBeDefined();
    // A single section needs no navigation.
    expect(view.queryByRole('navigation', { name: 'Study navigation' })).toBeNull();
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
    expect(tabHeadings(view)).toEqual(['Studies']);
    expect(view.getByText('Available studies')).toBeDefined();
    expect(within(view.getByRole('region', { name: 'Studies' })).getAllByText('Test Study')).toHaveLength(2);
  });

  test('scrolls to the tab named in the URL and lists every tab in the side navigation', async () => {
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
      <ConfigSwitcher globalConfig={config} studyConfigs={{ ...studyConfigs, assigned: parsedStudyConfig }} />,
      `/?tab=${encodeURIComponent(label)}&source=shared`,
    ));
    expect(tabHeadings(view)).toEqual([label, 'Studies']);
    const section = view.getByRole('region', { name: label });
    await waitFor(() => expect(scrollIntoViewMock.mock.contexts).toContain(section));
    expect(view.getByRole('navigation', { name: 'Study navigation' })).toBeDefined();
  });

  test.each(['Old label', 'Empty'])('ignores a URL tab with no visible studies (%s)', async (requestedTab) => {
    const config = makeGlobalConfig({
      ...globalConfig,
      tabs: [{ label: 'Empty' }, { label: 'Current label' }],
      configs: { 'test-study': { path: 'test.json', tab: 'Current label' } },
    });
    const view = await act(async () => render(
      <ConfigSwitcher globalConfig={config} studyConfigs={studyConfigs} />,
      `/?tab=${encodeURIComponent(requestedTab)}`,
    ));
    expect(tabHeadings(view)).toEqual(['Current label']);
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
    expect(within(view.getByRole('region', { name: 'Current label' })).getByText('Test Study')).toBeDefined();
  });

  test('removes tab sections whose studies become hidden', async () => {
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
    ));
    expect(tabHeadings(view)).toEqual(['Private', 'Public']);
    vi.mocked(storageEngine.getStudyHiddenFromLandingPage).mockImplementation(async (name) => name === 'private');
    await act(async () => view.rerender(
      <ConfigSwitcher globalConfig={{ ...config, configsList: [...config.configsList] }} studyConfigs={configs} />,
    ));
    expect(tabHeadings(view)).toEqual(['Public']);
    expect(view.queryByText('Private study')).toBeNull();
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
    expect(container.textContent).not.toContain('Analyze & Manage');
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

describe('ConfigSwitcher study cards', () => {
  test('shows a thumbnail under the base path and keeps the header when there is none', async () => {
    prefixMock.value = '/study/';
    const withThumbnail = {
      'test-study': {
        ...parsedStudyConfig,
        studyMetadata: { ...parsedStudyConfig.studyMetadata, thumbnail: 'test-study/assets/thumbnail.png' },
      },
    };
    const view = await act(async () => render(<ConfigSwitcher globalConfig={globalConfig} studyConfigs={withThumbnail} />, '/study/', '/study/'));

    expect(view.getByAltText('Preview of Test Study').getAttribute('src')).toBe('/study/test-study/assets/thumbnail.png');

    cleanup();
    const plain = await act(async () => render(<ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigs} />));
    expect(plain.queryByAltText(/^Preview of/)).toBeNull();
  });

  test('uses absolute thumbnail URLs as-is', async () => {
    const remote = {
      'test-study': {
        ...parsedStudyConfig,
        studyMetadata: { ...parsedStudyConfig.studyMetadata, thumbnail: 'https://example.com/thumb.png' },
      },
    };
    const view = await act(async () => render(<ConfigSwitcher globalConfig={globalConfig} studyConfigs={remote} />));

    expect(view.getByAltText('Preview of Test Study').getAttribute('src')).toBe('https://example.com/thumb.png');
  });

  test('launches the default condition without a condition parameter', async () => {
    vi.mocked(getSequenceConditions).mockReturnValue(['condA']);
    const view = await act(async () => render(<ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigs} />));

    fireEvent.click(view.getByRole('button', { name: 'Go to Study' }));
    expect(await view.findByText('Choose a condition')).toBeDefined();
    fireEvent.click(await view.findByRole('menuitem', { name: /^default/ }));

    expect(assignLocation).toHaveBeenCalledExactlyOnceWith('/test-study');
  });

  test('renders study descriptions as Markdown with links that open in a new tab', async () => {
    const markdownStudy = {
      'test-study': {
        ...parsedStudyConfig,
        studyMetadata: { ...parsedStudyConfig.studyMetadata, description: 'Uses **HTML**. See [the docs](https://revisit.dev/docs/).' },
      },
    };
    const view = await act(async () => render(<ConfigSwitcher globalConfig={globalConfig} studyConfigs={markdownStudy} />));

    expect(view.getByText('HTML').tagName).toBe('STRONG');
    const link = view.getByRole('link', { name: 'the docs' });
    expect(link.getAttribute('href')).toBe('https://revisit.dev/docs/');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  // Stage edits update `allStages`; the `currentStage` snapshot keeps only the name and color.
  const limitedStage = {
    currentStage: { stageName: 'DEFAULT', color: '#000' },
    allStages: [{ stageName: 'Earlier', color: '#111', maxParticipants: 1 }, { stageName: 'DEFAULT', color: '#000', maxParticipants: 2 }],
  };
  const renderLimited = async (dataSharingEnabled: boolean, assignments: ReturnType<typeof makeSequenceAssignment>[]) => {
    const engine = {
      ...makeLandingEngine({ dataSharingEnabled }),
      getAllSequenceAssignments: vi.fn().mockResolvedValue(assignments),
    };
    engine.getModes.mockResolvedValue({
      dataCollectionEnabled: true, developmentModeEnabled: false, dataSharingEnabled, stage: limitedStage,
    });
    vi.mocked(useStorageEngine).mockReturnValue({ storageEngine: makeStorageEngine(engine), setStorageEngine: vi.fn() });
    const view = await act(async () => render(<ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigs} />));
    return { view, engine };
  };

  test('shows the participant limit with counts when data sharing is enabled', async () => {
    const { view, engine } = await renderLimited(true, [makeSequenceAssignment({ completed: 1 })]);

    await waitFor(() => expect(view.getByText(/^Participant limit: 2/)).toBeDefined());
    expect(view.getByText(/1 enrolled \(1 completed\)/)).toBeDefined();
    expect(view.queryByText(/Study Full/i)).toBeNull();
    expect(engine.getAllSequenceAssignments).toHaveBeenCalledWith('test-study');
  });

  test('reports a full study and hides counts when data sharing is disabled', async () => {
    const { view } = await renderLimited(false, [
      makeSequenceAssignment({ completed: 1 }),
      makeSequenceAssignment({ participantId: 'p2' }),
    ]);

    await waitFor(() => expect(view.getByText('Reached Participant Limit, Study Full')).toBeDefined());
    expect(view.getByText('Study full')).toBeDefined();
    expect(view.getByText('Participant limit: 2')).toBeDefined();
    expect(view.queryByText(/enrolled/)).toBeNull();
  });

  test('does not read assignments for limits when the stage has no limit', async () => {
    const engine = { ...makeLandingEngine({ dataSharingEnabled: true }), getAllSequenceAssignments: vi.fn().mockResolvedValue([]) };
    vi.mocked(useStorageEngine).mockReturnValue({ storageEngine: makeStorageEngine(engine), setStorageEngine: vi.fn() });
    const view = await act(async () => render(<ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigs} />));

    expect(view.queryByText(/Participant limit/)).toBeNull();
    expect(engine.getAllSequenceAssignments).not.toHaveBeenCalled();
  });

  test('links the GitHub icon to the study folder in a new tab', async () => {
    const view = await act(async () => render(<ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigs} />));

    const link = view.getByRole('link', { name: 'View source on GitHub' });
    expect(link.getAttribute('href')).toBe(`${import.meta.env.VITE_REPO_URL}test-study`);
    expect(link.getAttribute('target')).toBe('_blank');
  });
});

describe('groupConfigNames', () => {
  const configs: GlobalConfig['configs'] = {
    a: { path: 'a/config.json', group: 'Second' },
    b: { path: 'b/config.json', group: 'First' },
    c: { path: 'c/config.json' },
    d: { path: 'd/config.json', group: 'First' },
  };

  test('orders sections by group, keeps study order, and collects ungrouped studies last', () => {
    const sections = groupConfigNames(
      [{ label: 'First' }, { label: 'Second', description: 'Two' }, { label: 'Empty' }],
      ['a', 'b', 'c', 'd'],
      configs,
    );

    expect(sections.map(({ label, configNames }) => [label, configNames])).toEqual([
      ['First', ['b', 'd']],
      ['Second', ['a']],
      [OTHER_GROUP_LABEL, ['c']],
    ]);
    expect(sections[1].description).toBe('Two');
  });

  test('omits the Other group when every study is grouped', () => {
    expect(groupConfigNames([{ label: 'First' }], ['b', 'd'], configs).map(({ label }) => label)).toEqual(['First']);
  });
});

describe('ConfigSwitcher optional sections', () => {
  const config = makeGlobalConfig({
    tabs: [{ label: 'Snippets' }, { label: 'Tutorials' }, { label: 'Tests' }],
    configsList: ['snippet', 'tutorial', 'test'],
    configs: {
      snippet: { path: 'snippet.json', tab: 'Snippets' },
      tutorial: { path: 'tutorial.json', tab: 'Tutorials' },
      test: { path: 'test.json', tab: 'Tests' },
    },
  });
  const configs = { snippet: parsedStudyConfig, tutorial: parsedStudyConfig, test: parsedStudyConfig };
  const headings = (view: ReturnType<typeof render>) => view.getAllByRole('heading', { level: 3 }).map((element) => element.textContent);

  afterEach(() => window.localStorage.clear());

  test('hides the Tutorials and Tests sections by default', async () => {
    const view = await act(async () => render(<ConfigSwitcher globalConfig={config} studyConfigs={configs} />));
    expect(headings(view)).toEqual(['Snippets']);
  });

  test('shows each section the viewer has turned on', async () => {
    window.localStorage.setItem('revisit-landing-show-tests', 'true');
    const view = await act(async () => render(<ConfigSwitcher globalConfig={config} studyConfigs={configs} />));
    expect(headings(view)).toEqual(['Snippets', 'Tests']);
  });
});

describe('slugify', () => {
  test.each([
    ['Example Studies', 'example-studies'],
    ['Research & Introduction', 'research-introduction'],
    ['  Café — Déjà vu! ', 'cafe-deja-vu'],
    ['***', 'section'],
  ])('turns %j into %j', (text, slug) => {
    expect(slugify(text)).toBe(slug);
  });
});

describe('ConfigSwitcher tab groups', () => {
  const groupedConfig = makeGlobalConfig({
    tabs: [{
      label: 'Demos',
      description: 'Demo **tab** description.',
      groups: [{ label: 'Stimuli', description: 'Ways to show things.' }, { label: 'Responses' }],
    }],
    configsList: ['test-study', 'other-study'],
    configs: {
      'test-study': { path: 'test-study/config.json', tab: 'Demos', group: 'Stimuli' },
      'other-study': { path: 'other-study/config.json', tab: 'Demos' },
    },
  });
  const groupedStudyConfigs = { 'test-study': parsedStudyConfig, 'other-study': parsedStudyConfig };

  test('renders group headings, skips empty groups, and lists tabs and groups in one navigation list', async () => {
    const view = await act(async () => render(<ConfigSwitcher globalConfig={groupedConfig} studyConfigs={groupedStudyConfigs} />));

    const tab = view.getByRole('region', { name: 'Demos' });
    expect(within(tab).getAllByRole('heading', { level: 4 }).map((heading) => heading.textContent)).toEqual(['Stimuli', OTHER_GROUP_LABEL]);
    expect(within(tab).getByRole('region', { name: 'Stimuli' }).textContent).toContain('Ways to show things.');
    expect(tab.textContent).toContain('Demo tab description.');
    expect(within(tab).getByText('tab').tagName).toBe('STRONG');
    expect(view.getByRole('navigation', { name: 'Study navigation' })).toBeDefined();
  });

  test('gives every tab and group a readable anchor and restores the one in the URL hash', async () => {
    const view = await act(async () => render(
      <ConfigSwitcher globalConfig={groupedConfig} studyConfigs={groupedStudyConfigs} />,
      '/#demos--stimuli',
    ));

    // Anchors live on the sections, since a tab's heading is pinned while its section scrolls by.
    const tab = view.getByRole('region', { name: 'Demos' });
    const group = view.getByRole('region', { name: 'Stimuli' });
    expect(tab.id).toBe('demos');
    expect(group.id).toBe('demos--stimuli');
    await waitFor(() => expect(scrollIntoViewMock.mock.contexts).toContain(group));
  });

  test('keeps the tab description with its section and the navigation on the right when there is an introduction', async () => {
    getStaticAssetByPathMock.mockResolvedValue('# About');
    const withIntro = { ...groupedConfig, introductionPath: 'intro.md' };
    const view = await act(async () => render(<ConfigSwitcher globalConfig={withIntro} studyConfigs={groupedStudyConfigs} />));

    const intro = view.getByRole('region', { name: 'Introduction' });
    await waitFor(() => expect(within(intro).getByRole('heading', { name: 'About' })).toBeDefined());
    expect(intro.textContent).not.toContain('description.');
    expect(within(intro).queryByRole('navigation')).toBeNull();

    const tab = view.getByRole('region', { name: 'Demos' });
    expect(tab.textContent).toContain('Demo tab description.');
    const nav = view.getByRole('navigation', { name: 'Study navigation' });
    expect(tab.compareDocumentPosition(nav)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});

describe('ConfigSwitcher introduction', () => {
  const introductionConfig = makeGlobalConfig({
    introductionPath: 'intro/about.md',
    configsList: ['test-study'],
    configs: { 'test-study': { path: 'test-study/config.json' } },
  });

  test('does not fetch an introduction or render the introduction column when none is configured', async () => {
    const view = await act(async () => render(<ConfigSwitcher globalConfig={globalConfig} studyConfigs={studyConfigs} />));

    expect(getStaticAssetByPathMock).not.toHaveBeenCalled();
    expect(view.queryByRole('region', { name: 'Introduction' })).toBeNull();
    expect(view.getByRole('button', { name: 'Go to Study' })).toBeDefined();
  });

  test('renders the configured Markdown beside the study cards', async () => {
    prefixMock.value = '/study/';
    getStaticAssetByPathMock.mockResolvedValue('# About these studies\n\nThey test **charts**.');
    const view = await act(async () => render(
      <ConfigSwitcher globalConfig={introductionConfig} studyConfigs={studyConfigs} />,
      '/study/',
      '/study/',
    ));

    const intro = view.getByRole('region', { name: 'Introduction' });
    await waitFor(() => expect(within(intro).getByRole('heading', { name: 'About these studies' })).toBeDefined());
    expect(within(intro).getByText('charts').tagName).toBe('STRONG');
    expect(getStaticAssetByPathMock).toHaveBeenCalledExactlyOnceWith('/study/intro/about.md');
    expect(view.getByRole('button', { name: 'Go to Study' })).toBeDefined();
  });

  test('fetches absolute introduction URLs without the base path', async () => {
    getStaticAssetByPathMock.mockResolvedValue('Remote intro');
    const remoteConfig = { ...introductionConfig, introductionPath: 'https://example.com/intro.md' };
    const view = await act(async () => render(<ConfigSwitcher globalConfig={remoteConfig} studyConfigs={studyConfigs} />));

    await waitFor(() => expect(view.getByText('Remote intro')).toBeDefined());
    expect(getStaticAssetByPathMock).toHaveBeenCalledExactlyOnceWith('https://example.com/intro.md');
  });

  test('reports a missing introduction while still showing the studies', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getStaticAssetByPathMock.mockResolvedValue(undefined);
    const view = await act(async () => render(<ConfigSwitcher globalConfig={introductionConfig} studyConfigs={studyConfigs} />));

    const intro = view.getByRole('region', { name: 'Introduction' });
    await waitFor(() => expect(within(intro).getByRole('alert').textContent).toContain('Unable to load the introduction from intro/about.md'));
    expect(consoleSpy).toHaveBeenCalledWith('Landing page introduction not found at intro/about.md');
    expect(view.getByRole('button', { name: 'Go to Study' })).toBeDefined();
    consoleSpy.mockRestore();
  });

  test('reports a failed introduction request', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('offline');
    getStaticAssetByPathMock.mockRejectedValue(error);
    const view = await act(async () => render(<ConfigSwitcher globalConfig={introductionConfig} studyConfigs={studyConfigs} />));

    await waitFor(() => expect(view.getByRole('alert').textContent).toContain('Unable to load the introduction'));
    expect(consoleSpy).toHaveBeenCalledWith('Failed to load landing page introduction:', error);
    consoleSpy.mockRestore();
  });

  test('ignores a stale introduction after the configured path changes', async () => {
    let resolveFirst: (text: string) => void = () => {};
    getStaticAssetByPathMock
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce('Second intro');
    const view = await act(async () => render(<ConfigSwitcher globalConfig={introductionConfig} studyConfigs={studyConfigs} />));

    const nextConfig = { ...introductionConfig, introductionPath: 'intro/second.md' };
    await act(async () => view.rerender(<ConfigSwitcher globalConfig={nextConfig} studyConfigs={studyConfigs} />));
    await waitFor(() => expect(view.getByText('Second intro')).toBeDefined());

    await act(async () => resolveFirst('First intro'));
    expect(view.queryByText('First intro')).toBeNull();
    expect(view.getByText('Second intro')).toBeDefined();
  });
});
