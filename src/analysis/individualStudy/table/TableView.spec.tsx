import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, it, vi,
} from 'vitest';
import { MetaCell } from './MetaCell';
import { TableView } from './TableView';

vi.mock('react-router', () => ({
  useParams: () => ({ studyId: 'study-a' }),
}));

const mockUseTable = vi.fn(() => ({ table: 'ok' }));
vi.mock('mantine-react-table', () => ({
  MantineReactTable: () => <div>participant-table</div>,
  useMantineReactTable: () => mockUseTable(),
}));

vi.mock('../ParticipantRejectModal', () => ({
  ParticipantRejectModal: () => <div>reject-modal</div>,
}));
vi.mock('../replay/AllTasksTimeline', () => ({
  AllTasksTimeline: () => <div>timeline</div>,
}));
vi.mock('../../../utils/participantName', () => ({
  participantName: () => 'User Name',
}));
vi.mock('../../../utils/humanReadableDuration', () => ({
  youtubeReadableDuration: () => '1m',
}));
vi.mock('../../../utils/getSequenceFlatMap', () => ({
  getSequenceFlatMap: () => [1, 2],
}));
vi.mock('../../../utils/correctAnswer', () => ({
  componentAnswersAreCorrect: () => true,
}));

describe('TableView', () => {
  it('shows no data message when participants are empty', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <TableView
          visibleParticipants={[]}
          studyConfig={{ uiConfig: {} } as never}
          refresh={vi.fn()}
          width={1000}
          stageColors={{}}
          selectedParticipants={[]}
          onSelectionChange={vi.fn()}
        />
      </MantineProvider>,
    );
    expect(html).toContain('No data available');
  });

  it('renders table when participants exist', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <TableView
          visibleParticipants={[{
            participantId: 'p1',
            participantIndex: 1,
            stage: 'DEFAULT',
            completed: false,
            rejected: false,
            sequence: [],
            answers: {
              trial_1: {
                startTime: 1,
                endTime: 2,
                trialOrder: '1_1',
                correctAnswer: [],
                answer: {},
              },
            },
          } as never]}
          studyConfig={{ uiConfig: {} } as never}
          refresh={vi.fn()}
          width={1000}
          stageColors={{}}
          selectedParticipants={[]}
          onSelectionChange={vi.fn()}
        />
      </MantineProvider>,
    );
    expect(html).toContain('participant-table');
    expect(mockUseTable.mock.calls.length).toBeGreaterThan(0);
  });
});

describe('MetaCell', () => {
  it('renders participant metadata fields', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <MetaCell
          metaData={{
            resolution: { width: 1920, height: 1080 },
            userAgent: 'UA',
            ip: '127.0.0.1',
            language: 'en-US',
          } as never}
        />
      </MantineProvider>,
    );

    expect(html).toContain('Resolution');
    expect(html).toContain('User Agent');
    expect(html).toContain('127.0.0.1');
    expect(html).toContain('en-US');
  });
});
