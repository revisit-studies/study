import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReactNode } from 'react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { ParticipantRejectModal } from './ParticipantRejectModal';
import { StudyAnalysisTabs } from './StudyAnalysisTabs';

let mockedParams: Record<string, string | undefined> = { studyId: undefined, analysisTab: 'summary' };
let mockedAsyncStatus: 'pending' | 'success' = 'pending';
let mockedIsAdmin = false;

vi.mock('@mantine/core', async () => {
  const actual = await vi.importActual<typeof import('@mantine/core')>('@mantine/core');
  type AppShellWithMain = {
    ({ children }: { children: ReactNode }): ReactNode;
    Main: ({ children }: { children: ReactNode }) => ReactNode;
  };
  function MockAppShell({ children }: { children: ReactNode }) {
    return <div>{children}</div>;
  }
  function MockAppShellMain({ children }: { children: ReactNode }) {
    return <div>{children}</div>;
  }
  const mockAppShellWithMain = MockAppShell as AppShellWithMain;
  mockAppShellWithMain.Main = MockAppShellMain;
  return {
    ...actual,
    AppShell: mockAppShellWithMain,
  };
});

vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => mockedParams,
  useSearchParams: () => [new URLSearchParams()],
}));

vi.mock('../interface/AppHeader', () => ({
  AppHeader: () => <div>app-header</div>,
}));
vi.mock('./LiveMonitor/LiveMonitorView', () => ({
  LiveMonitorView: () => <div>live-monitor</div>,
}));
vi.mock('./summary/SummaryView', () => ({
  SummaryView: () => <div>summary-view</div>,
}));
vi.mock('./table/TableView', () => ({
  TableView: () => <div>table-view</div>,
}));
vi.mock('./stats/StatsView', () => ({
  StatsView: () => <div>stats-view</div>,
}));
vi.mock('./management/ManageView', () => ({
  ManageView: () => <div>manage-view</div>,
}));
vi.mock('./thinkAloud/ThinkAloudAnalysis', () => ({
  ThinkAloudAnalysis: () => <div>think-aloud</div>,
}));
vi.mock('./config/ConfigView', () => ({
  ConfigView: () => <div>config-view</div>,
}));
vi.mock('../../components/downloader/DownloadButtons', () => ({
  DownloadButtons: () => <div>download-buttons</div>,
}));

vi.mock('../../utils/fetchConfig', () => ({
  getStudyConfig: async () => null,
}));
vi.mock('../../store/hooks/useAuth', () => ({
  useAuth: () => ({ user: { isAdmin: mockedIsAdmin } }),
}));
vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: undefined }),
}));
vi.mock('../../store/hooks/useAsync', () => ({
  useAsync: () => ({ value: {}, execute: vi.fn(), status: mockedAsyncStatus }),
}));
vi.mock('../../utils/useStudyRecordings', () => ({
  useStudyRecordings: () => ({ hasAudioRecording: false, hasScreenRecording: false }),
}));
vi.mock('../../parser/parser', () => ({
  parseStudyConfig: async () => null,
}));
vi.mock('../../utils/handleConditionLogic', () => ({
  parseConditionParam: () => [],
}));

describe('StudyAnalysisTabs', () => {
  it('shows study selection hint when no studyId is present', () => {
    mockedParams = { studyId: undefined, analysisTab: 'summary' };

    const html = renderToStaticMarkup(
      <MantineProvider>
        <StudyAnalysisTabs globalConfig={{ configsList: ['a'], configs: {}, $schema: '' } as never} />
      </MantineProvider>,
    );
    expect(html).toContain('Select a study from the header menu');
  });

  it('renders tab labels when studyId exists and async data is ready', () => {
    mockedParams = { studyId: 'study-a', analysisTab: 'summary' };
    mockedAsyncStatus = 'success';

    const html = renderToStaticMarkup(
      <MantineProvider>
        <StudyAnalysisTabs globalConfig={{ configsList: ['a'], configs: {}, $schema: '' } as never} />
      </MantineProvider>,
    );

    expect(html).toContain('Study Summary');
    expect(html).toContain('Participant View');
    expect(html).toContain('Trial Stats');
    expect(html).toContain('Config');
  });
});

describe('ParticipantRejectModal', () => {
  it('renders reject and undo actions with selected participant counts', () => {
    mockedIsAdmin = true;
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ParticipantRejectModal
          selectedParticipants={[
            { participantId: 'p1', rejected: false },
            { participantId: 'p2', rejected: { reason: 'bad' } },
          ] as never}
        />
      </MantineProvider>,
    );

    expect(html).toContain('Reject');
    expect(html).toContain('Undo Reject');
    expect(html).toContain('Participants (1)');
  });

  it('disables actions for non-admin users', () => {
    mockedIsAdmin = false;
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ParticipantRejectModal
          selectedParticipants={[{ participantId: 'p1', rejected: false }] as never}
        />
      </MantineProvider>,
    );
    expect(html).toContain('disabled');
  });
});
