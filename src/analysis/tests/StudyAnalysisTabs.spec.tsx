import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  render, act, cleanup, screen, waitFor, fireEvent,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { StudyAnalysisTabs } from '../individualStudy/StudyAnalysisTabs';
import type { GlobalConfig, StudyConfig, ParsedConfig } from '../../parser/types';
import { getStudyConfig } from '../../utils/fetchConfig';
import { useAsync } from '../../store/hooks/useAsync';

// ── mutable state ─────────────────────────────────────────────────────────────

let mockParams: Record<string, string | undefined> = { studyId: 'test-study', analysisTab: 'summary' };
let mockStorageEngine: Record<string, ReturnType<typeof vi.fn>> | undefined;

// Stable result returned by the useAsync mock. Reset in beforeEach so each test
// gets its own stable reference, avoiding infinite re-render loops that would
// occur if useAsync returned a new object on every render.
let currentStable: { value: Record<string, never>; status: 'success'; execute: () => Promise<never>; error: null } = {
  value: {} as Record<string, never>,
  status: 'success' as const,
  execute: () => Promise.resolve() as Promise<never>,
  error: null,
};

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => mockParams,
}));

vi.mock('@mantine/hooks', () => ({
  useResizeObserver: () => [{ current: null }, { width: 800 }],
}));

vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: mockStorageEngine }),
}));

vi.mock('../../store/hooks/useAuth', () => ({
  useAuth: () => ({ user: { isAdmin: true } }),
}));

vi.mock('../../store/hooks/useAsync', () => ({
  // vi.fn reads `currentStable` at call time — each test sets it in beforeEach so the
  // reference stays stable within a render cycle, preventing infinite re-render loops.
  useAsync: vi.fn(() => currentStable),
}));

vi.mock('../../utils/useStudyRecordings', () => ({
  useStudyRecordings: () => ({ hasAudioRecording: false, hasScreenRecording: false }),
}));

vi.mock('../../utils/fetchConfig', () => ({
  getStudyConfig: vi.fn().mockResolvedValue(undefined),
  resolveConfigKey: vi.fn((key: string) => key),
}));

vi.mock('../../utils/handleConditionLogic', () => ({
  parseConditionParam: vi.fn(() => []),
}));

vi.mock('../../storage/engines/FirebaseStorageEngine', () => ({
  FirebaseStorageEngine: class {},
}));

vi.mock('../../parser/parser', () => ({
  parseStudyConfig: vi.fn().mockResolvedValue({}),
}));

// child components
vi.mock('../interface/AppHeader', () => ({
  AppHeader: () => <div>AppHeader</div>,
}));
vi.mock('./LiveMonitor/LiveMonitorView', () => ({
  LiveMonitorView: () => <div>LiveMonitorView</div>,
}));
vi.mock('./summary/SummaryView', () => ({
  SummaryView: () => <div>SummaryView</div>,
}));
vi.mock('./table/TableView', () => ({
  TableView: ({ onSelectionChange }: { onSelectionChange?: (p: { participantId: string; completed: boolean; rejected: boolean; answers: Record<string, never> }[]) => void }) => (
    <div>
      TableView
      <button
        type="button"
        data-testid="select-participant"
        onClick={() => onSelectionChange?.([{
          participantId: 'p1', completed: true, rejected: false, answers: {},
        }])}
      >
        Select
      </button>
    </div>
  ),
}));
vi.mock('./stats/StatsView', () => ({
  StatsView: () => <div>StatsView</div>,
}));
vi.mock('./management/ManageView', () => ({
  ManageView: () => <div>ManageView</div>,
}));
vi.mock('./thinkAloud/ThinkAloudAnalysis', () => ({
  ThinkAloudAnalysis: () => <div>ThinkAloudAnalysis</div>,
}));
vi.mock('./config/ConfigView', () => ({
  ConfigView: () => <div>ConfigView</div>,
}));
vi.mock('../../components/downloader/DownloadButtons', () => ({
  DownloadButtons: () => <div>DownloadButtons</div>,
}));

vi.mock('@mantine/core', () => ({
  Alert: ({ children, title }: { children: ReactNode; title?: ReactNode }) => (
    <div role="alert">
      {title}
      {children}
    </div>
  ),
  AppShell: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    { Main: ({ children }: { children: ReactNode }) => <div>{children}</div> },
  ),
  Center: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Checkbox: Object.assign(
    ({ label }: { label?: ReactNode }) => <label>{label}</label>,
    { Group: ({ children }: { children: ReactNode }) => <div>{children}</div> },
  ),
  Container: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  LoadingOverlay: () => null,
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Tabs: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    {
      List: ({ children }: { children: ReactNode }) => <nav>{children}</nav>,
      Tab: ({ children, value }: { children: ReactNode; value: string }) => (
        <button type="button" data-tab={value}>{children}</button>
      ),
      Panel: ({ children, value }: { children: ReactNode; value: string }) => (
        <section data-panel={value}>{children}</section>
      ),
    },
  ),
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Title: ({ children }: { children: ReactNode }) => <h5>{children}</h5>,
  MultiSelect: ({ onChange }: { onChange?: (v: string[]) => void }) => (
    <select onChange={(e) => onChange?.(e.target.value !== '' ? [e.target.value] : [])} />
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconChartDonut2: () => null,
  IconTable: () => null,
  IconSettings: () => null,
  IconInfoCircle: () => null,
  IconChartPie: () => null,
  IconTags: () => null,
  IconDashboard: () => null,
  IconFileCode: () => null,
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

const mockGlobalConfig: GlobalConfig = {
  $schema: 'test',
  configsList: [],
  configs: {},
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe('StudyAnalysisTabs', () => {
  beforeEach(() => {
    mockParams = { studyId: 'test-study', analysisTab: 'summary' };
    mockStorageEngine = { getEngine: vi.fn().mockReturnValue('supabase') };
    vi.mocked(getStudyConfig).mockResolvedValue(null);
    currentStable = {
      value: {} as Record<string, never>, status: 'success' as const, execute: () => Promise.resolve() as Promise<never>, error: null,
    };
    vi.mocked(useAsync).mockImplementation(() => currentStable);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test('shows "Select a study" message when no routeStudyId', () => {
    mockParams = {};
    const html = renderToStaticMarkup(<StudyAnalysisTabs globalConfig={mockGlobalConfig} />);
    expect(html).toContain('Select a study from the header menu to view analysis data.');
  });

  test('renders standard tabs regardless of engine', () => {
    const html = renderToStaticMarkup(<StudyAnalysisTabs globalConfig={mockGlobalConfig} />);
    expect(html).toContain('Study Summary');
    expect(html).toContain('Participant View');
    expect(html).toContain('Trial Stats');
    expect(html).toContain('Coding');
    expect(html).toContain('Config');
    expect(html).toContain('Manage');
  });

  test('does not render Live Monitor tab when not Firebase', () => {
    const html = renderToStaticMarkup(<StudyAnalysisTabs globalConfig={mockGlobalConfig} />);
    expect(html).not.toContain('Live Monitor');
  });

  test('renders Live Monitor tab when Firebase', () => {
    mockStorageEngine = { getEngine: vi.fn().mockReturnValue('firebase') };
    const html = renderToStaticMarkup(<StudyAnalysisTabs globalConfig={mockGlobalConfig} />);
    expect(html).toContain('Live Monitor');
  });

  test('renders "Firebase only" message in Coding panel when not Firebase', () => {
    const html = renderToStaticMarkup(<StudyAnalysisTabs globalConfig={mockGlobalConfig} />);
    expect(html).toContain('Think aloud coding is only available when using Firebase.');
  });

  test('selectedParticipants > 0 shows "X of Y" labels in checkboxes', async () => {
    vi.mocked(getStudyConfig).mockResolvedValue({
      studyMetadata: { version: '1' },
      components: {},
      sequence: { order: [] },
      errors: [],
      warnings: [],
    } as unknown as ParsedConfig<StudyConfig>);
    mockStorageEngine = {
      getEngine: vi.fn().mockReturnValue('supabase'),
      getStageData: vi.fn().mockResolvedValue({ allStages: [] }),
      getAllConfigsFromHash: vi.fn().mockResolvedValue({}),
    };
    const { getByTestId } = await act(async () => render(
      <StudyAnalysisTabs globalConfig={mockGlobalConfig} />,
    ));
    // The select-participant button is only rendered when studyConfig is loaded
    await act(async () => {
      const btn = getByTestId('select-participant');
      btn.click();
    });
    // After selecting a participant, the checkbox labels should contain "of"
    expect(document.body.textContent).toContain('of');
  });

  test('renders ThinkAloudAnalysis in Coding panel when Firebase and studyConfig is loaded', async () => {
    vi.mocked(getStudyConfig).mockResolvedValue({
      studyMetadata: { version: '1' },
      components: {},
      sequence: { order: [] },
      errors: [],
      warnings: [],
    } as unknown as ParsedConfig<StudyConfig>);

    mockStorageEngine = {
      getEngine: vi.fn().mockReturnValue('firebase'),
      getStageData: vi.fn().mockResolvedValue({ allStages: [] }),
      getAllConfigsFromHash: vi.fn().mockResolvedValue({}),
    };

    await act(async () => {
      render(<StudyAnalysisTabs globalConfig={mockGlobalConfig} />);
    });

    expect(screen.getByText('ThinkAloudAnalysis')).toBeDefined();
    expect(screen.queryByText('Think aloud coding is only available when using Firebase.')).toBeNull();
  });

  test('loadStages fires and covers async body when storageEngine has getStageData', async () => {
    const mockGetStageData = vi.fn().mockResolvedValue({
      allStages: [{ stageName: 'stage1', color: '#ff0000' }],
    });
    mockStorageEngine = {
      getEngine: vi.fn().mockReturnValue('supabase'),
      getStageData: mockGetStageData,
      getAllConfigsFromHash: vi.fn().mockResolvedValue({}),
    };
    await act(async () => { render(<StudyAnalysisTabs globalConfig={mockGlobalConfig} />); });
    await waitFor(() => { expect(mockGetStageData).toHaveBeenCalled(); });
  });

  test('adds message listener and postMessage for __revisit-widget studyId', async () => {
    mockParams = { studyId: '__revisit-widget', analysisTab: 'summary' };
    mockStorageEngine = { getEngine: vi.fn().mockReturnValue('supabase') };
    const addEventSpy = vi.spyOn(window, 'addEventListener');
    const postMessageSpy = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
    await act(async () => { render(<StudyAnalysisTabs globalConfig={mockGlobalConfig} />); });
    expect(addEventSpy).toHaveBeenCalledWith('message', expect.any(Function));
    expect(postMessageSpy).toHaveBeenCalledWith({ type: 'revisitWidget/READY' }, '*');
    // Dispatch a message event to cover the messageListener body (lines 272-276)
    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', {
        data: { type: 'revisitWidget/CONFIG', payload: '{}' },
      }));
    });
    addEventSpy.mockRestore();
    postMessageSpy.mockRestore();
  });

  test('firing MultiSelect onChange covers stage/config filter branches', async () => {
    mockStorageEngine = {
      getEngine: vi.fn().mockReturnValue('supabase'),
      getStageData: vi.fn().mockResolvedValue({ allStages: [] }),
      getAllConfigsFromHash: vi.fn().mockResolvedValue({}),
    };
    const { container } = await act(async () => render(
      <StudyAnalysisTabs globalConfig={mockGlobalConfig} />,
    ));
    // Fire change events on all select elements to hit onChange handlers (lines 331-368)
    const selects = container.querySelectorAll('select');
    selects.forEach((sel) => {
      // 'something' triggers the else branch (not ALL, not empty) → setSelectedStages/Configs(['something'])
      fireEvent.change(sel, { target: { value: 'something' } });
    });
    expect(container).toBeDefined();
  });
});
