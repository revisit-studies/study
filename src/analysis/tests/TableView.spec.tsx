import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import { useParams } from 'react-router';
import { StudyConfig } from '../../parser/types';
import { ParticipantDataWithStatus } from '../../storage/types';
import { createMockStudyConfig } from './testUtils';
import { makeParticipant as _makeParticipant } from '../../tests/utils';
import { TableView } from '../individualStudy/table/TableView';
import { MetaCell } from '../individualStudy/table/MetaCell';

// ── capturedTableOptions ─────────────────────────────────────────────────────

type MrtColumn = {
  header: string;
  Cell: ({ cell }: { cell: { getValue(): unknown } }) => ReactNode;
};

let capturedTableOptions: { columns: MrtColumn[] } | null = null;

vi.mock('mantine-react-table', () => ({
  MantineReactTable: () => <div>MantineReactTable</div>,
  useMantineReactTable: (opts: { columns: MrtColumn[] }) => { capturedTableOptions = opts; return opts; },
}));

vi.mock('react-router', () => ({
  useParams: vi.fn(() => ({ studyId: 'test-study' })),
}));

vi.mock('@mantine/core', () => ({
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Space: () => <div />,
  Tooltip: ({ children, label }: { children: ReactNode; label?: ReactNode }) => <div title={String(label)}>{children}</div>,
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  RingProgress: ({ sections }: { sections: { value: number }[] }) => <div>{sections[0]?.value}</div>,
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ActionIcon: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => <button type="button" onClick={onClick}>{children}</button>,
  Spoiler: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconCheck: () => <span>check</span>,
  IconHourglassEmpty: () => <span>hourglass</span>,
  IconX: () => <span>x-icon</span>,
  IconCopy: () => <span>copy</span>,
}));

vi.mock('../individualStudy/replay/AllTasksTimeline', () => ({
  AllTasksTimeline: () => <div>AllTasksTimeline</div>,
}));

vi.mock('../individualStudy/ParticipantRejectModal', () => ({
  ParticipantRejectModal: () => <div>ParticipantRejectModal</div>,
}));

vi.mock('../../utils/getSequenceFlatMap', () => ({
  getSequenceFlatMap: vi.fn(() => ['intro', 'trial1', 'trial2', 'end']),
}));

vi.mock('../../utils/participantName', () => ({
  participantName: () => 'Test User',
}));

// ── fixtures ─────────────────────────────────────────────────────────────────

const emptyConfig: StudyConfig = createMockStudyConfig();

function makeParticipant(overrides: Partial<ParticipantDataWithStatus> = {}) {
  return _makeParticipant({
    participantId: 'pid-1',
    participantIndex: 1,
    participantConfigHash: 'hash1',
    completed: true,
    metadata: {
      userAgent: 'test-agent',
      resolution: { width: 1920, height: 1080 },
      language: 'en-US',
      ip: '1.2.3.4',
    },
    sequence: {
      orderPath: 'root', order: 'fixed', components: ['trial1'], skip: [],
    },
    ...overrides,
  });
}

const defaultProps = {
  studyConfig: emptyConfig,
  allConfigs: {} as Record<string, StudyConfig>,
  refresh: async () => [] as ParticipantDataWithStatus[],
  width: 800,
  stageColors: { DEFAULT: '#F05A30' },
  selectedParticipants: [] as ParticipantDataWithStatus[],
  onSelectionChange: vi.fn<(participants: ParticipantDataWithStatus[]) => void>(),
};

beforeEach(() => {
  capturedTableOptions = null;
  vi.mocked(useParams).mockReturnValue({ studyId: 'test-study' });
  Object.defineProperty(window.navigator, 'clipboard', {
    value: { writeText: vi.fn() },
    configurable: true,
  });
});

// ── TableView ─────────────────────────────────────────────────────────────────

describe('TableView', () => {
  test('shows "No data available" when visibleParticipants is empty', () => {
    const html = renderToStaticMarkup(
      <TableView {...defaultProps} visibleParticipants={[]} />,
    );
    expect(html).toContain('No data available');
  });

  test('renders MantineReactTable and captures column options when participants exist', () => {
    const html = renderToStaticMarkup(
      <TableView {...defaultProps} visibleParticipants={[makeParticipant()]} />,
    );
    expect(html).toContain('MantineReactTable');
    expect(capturedTableOptions).not.toBeNull();
  });

  // ── Status column ──────────────────────────────────────────────────────────

  test('Status Cell: rejected participant shows x-icon and reason', () => {
    renderToStaticMarkup(
      <TableView {...defaultProps} visibleParticipants={[makeParticipant()]} />,
    );
    const col = capturedTableOptions!.columns.find((c) => c.header === 'Status')!;
    const html = renderToStaticMarkup(col.Cell({
      cell: { getValue: () => ({ rejected: { reason: 'spam' }, completed: false, percent: 0 }) },
    }));
    expect(html).toContain('x-icon');
    expect(html).toContain('spam');
  });

  test('Status Cell: completed participant shows check icon', () => {
    renderToStaticMarkup(
      <TableView {...defaultProps} visibleParticipants={[makeParticipant()]} />,
    );
    const col = capturedTableOptions!.columns.find((c) => c.header === 'Status')!;
    const html = renderToStaticMarkup(col.Cell({
      cell: { getValue: () => ({ rejected: false, completed: true, percent: 1 }) },
    }));
    expect(html).toContain('check');
  });

  test('Status Cell: in-progress participant shows RingProgress percent', () => {
    renderToStaticMarkup(
      <TableView {...defaultProps} visibleParticipants={[makeParticipant()]} />,
    );
    const col = capturedTableOptions!.columns.find((c) => c.header === 'Status')!;
    const html = renderToStaticMarkup(col.Cell({
      cell: { getValue: () => ({ rejected: false, completed: false, percent: 0.5 }) },
    }));
    expect(html).toContain('50'); // 0.5 * 100
  });

  // ── Stage column ───────────────────────────────────────────────────────────

  test('Stage Cell: empty stage shows N/A badge', () => {
    renderToStaticMarkup(
      <TableView {...defaultProps} visibleParticipants={[makeParticipant()]} />,
    );
    const col = capturedTableOptions!.columns.find((c) => c.header === 'Stage')!;
    const html = renderToStaticMarkup(col.Cell({ cell: { getValue: () => '' } }));
    expect(html).toContain('N/A');
  });

  test('Stage Cell: named stage renders stage name', () => {
    renderToStaticMarkup(
      <TableView {...defaultProps} visibleParticipants={[makeParticipant()]} />,
    );
    const col = capturedTableOptions!.columns.find((c) => c.header === 'Stage')!;
    const html = renderToStaticMarkup(col.Cell({ cell: { getValue: () => 'DEFAULT' } }));
    expect(html).toContain('DEFAULT');
  });

  // ── Duration column ────────────────────────────────────────────────────────

  test('Duration Cell: valid duration shows formatted time', () => {
    renderToStaticMarkup(
      <TableView {...defaultProps} visibleParticipants={[makeParticipant()]} />,
    );
    const col = capturedTableOptions!.columns.find((c) => c.header === 'Duration')!;
    const html = renderToStaticMarkup(col.Cell({ cell: { getValue: () => new Date(90_000) } }));
    expect(html).toContain('01:30'); // 90 seconds
  });

  test('Duration Cell: NaN date shows "N/A" (youtubeReadableDuration fallback)', () => {
    renderToStaticMarkup(
      <TableView {...defaultProps} visibleParticipants={[makeParticipant()]} />,
    );
    const col = capturedTableOptions!.columns.find((c) => c.header === 'Duration')!;
    // new Date(NaN) is a Date object; Number.isNaN(DateObject) === false → truthy branch
    // +new Date(NaN) === NaN → youtubeReadableDuration(NaN) falsy → 'N/A' shown
    const html = renderToStaticMarkup(col.Cell({ cell: { getValue: () => new Date(NaN) } }));
    expect(html).toContain('N/A');
  });

  // ── Start Time column ──────────────────────────────────────────────────────

  test('Start Time Cell: epoch-0 date shows "None"', () => {
    renderToStaticMarkup(
      <TableView {...defaultProps} visibleParticipants={[makeParticipant()]} />,
    );
    const col = capturedTableOptions!.columns.find((c) => c.header === 'Start Time')!;
    const html = renderToStaticMarkup(col.Cell({ cell: { getValue: () => new Date(0) } }));
    expect(html).toContain('None');
  });

  test('Start Time Cell: valid date shows locale string', () => {
    renderToStaticMarkup(
      <TableView {...defaultProps} visibleParticipants={[makeParticipant()]} />,
    );
    const col = capturedTableOptions!.columns.find((c) => c.header === 'Start Time')!;
    const d = new Date(2026, 0, 15, 10, 30);
    const html = renderToStaticMarkup(col.Cell({ cell: { getValue: () => d } }));
    expect(html).toContain(d.toLocaleDateString([], { hour: '2-digit', minute: '2-digit' }));
  });

  // ── Correct Answers column ─────────────────────────────────────────────────

  test('Correct Answers Cell: shows correct and incorrect counts', () => {
    renderToStaticMarkup(
      <TableView {...defaultProps} visibleParticipants={[makeParticipant()]} />,
    );
    const col = capturedTableOptions!.columns.find((c) => c.header === 'Correct Answers')!;
    // 2 correct, 1 incorrect
    const html = renderToStaticMarkup(col.Cell({ cell: { getValue: () => [true, true, false] } }));
    expect(html).toContain('2'); // correct count
    expect(html).toContain('1'); // incorrect count
  });

  // ── Metadata column ────────────────────────────────────────────────────────

  test('Metadata Cell: renders MetaCell with participant metadata', () => {
    renderToStaticMarkup(
      <TableView {...defaultProps} visibleParticipants={[makeParticipant()]} />,
    );
    const col = capturedTableOptions!.columns.find((c) => c.header === 'Metadata')!;
    const html = renderToStaticMarkup(col.Cell({
      cell: {
        getValue: () => ({
          userAgent: 'Mozilla/5.0',
          resolution: { width: 1920, height: 1080 },
          ip: '1.2.3.4',
          language: 'en-US',
        }),
      },
    }));
    expect(html).toContain('Mozilla/5.0');
    expect(html).toContain('1.2.3.4');
  });

  // ── Optional columns ──────────────────────────────────────────────────────

  test('includes Name column when studyConfig has participantNameField', () => {
    const configWithName: StudyConfig = {
      ...emptyConfig,
      uiConfig: { ...emptyConfig.uiConfig, participantNameField: 'name' },
    };
    renderToStaticMarkup(
      <TableView {...defaultProps} studyConfig={configWithName} visibleParticipants={[makeParticipant()]} />,
    );
    expect(capturedTableOptions!.columns.find((c) => c.header === 'Name')).toBeDefined();
  });

  test('includes Condition column when any participant has a condition', () => {
    const participantWithCondition = makeParticipant({ searchParams: { condition: 'condA' } });
    renderToStaticMarkup(
      <TableView {...defaultProps} visibleParticipants={[participantWithCondition]} />,
    );
    expect(capturedTableOptions!.columns.find((c) => c.header === 'Condition')).toBeDefined();
  });
});

// ── MetaCell ─────────────────────────────────────────────────────────────────

describe('MetaCell', () => {
  test('renders all metadata fields', () => {
    const html = renderToStaticMarkup(
      <MetaCell
        metaData={{
          userAgent: 'TestAgent/1.0',
          resolution: { width: 2560, height: 1440 },
          ip: '10.0.0.1',
          language: 'fr-FR',
        }}
      />,
    );
    expect(html).toContain('TestAgent/1.0');
    expect(html).toContain('2560');
    expect(html).toContain('10.0.0.1');
    expect(html).toContain('fr-FR');
  });

  test('renders gracefully when metaData is undefined', () => {
    const html = renderToStaticMarkup(<MetaCell metaData={undefined} />);
    expect(html).toContain('Resolution');
    expect(html).toContain('User Agent');
  });
});
