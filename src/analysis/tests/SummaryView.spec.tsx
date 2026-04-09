import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { cleanup } from '@testing-library/react';
import { StudyConfig } from '../../parser/types';
import { ParticipantData } from '../../storage/types';
import { OverviewData } from '../types';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { useAsync } from '../../store/hooks/useAsync';
import { makeStorageEngine } from '../../tests/utils';
import { createMockStudyConfig } from './testUtils';
import { SummaryView } from '../individualStudy/summary/SummaryView';
import { OverviewStats } from '../individualStudy/summary/OverviewStats';
import { ComponentStats } from '../individualStudy/summary/ComponentStats';
import { ResponseStats } from '../individualStudy/summary/ResponseStats';

// ── capturedTableOptions: intercept MRT ─────────────────────────────────────

type MrtColumn = {
  accessorKey?: string;
  header?: string;
  Cell: ({ cell }: { cell: { getValue(): number } }) => string;
};

let capturedTableOptions: { columns: MrtColumn[] } | null = null;

vi.mock('mantine-react-table', () => ({
  MantineReactTable: () => <div>MantineReactTable</div>,
  useMantineReactTable: (options: { columns: MrtColumn[] }) => {
    capturedTableOptions = options;
    return options;
  },
}));

vi.mock('@mantine/core', () => ({
  Paper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Title: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children, label }: { children: ReactNode; label?: string }) => (
    <div title={label}>{children}</div>
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconAlertTriangle: () => <span>alert</span>,
}));

vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: vi.fn(() => ({ storageEngine: undefined })),
}));

vi.mock('../../store/hooks/useAsync', () => ({
  useAsync: vi.fn(() => ({ value: null, status: 'idle', error: null })),
}));

// ── fixture helpers ──────────────────────────────────────────────────────────

function makeOverviewData(overrides: Partial<OverviewData> = {}): OverviewData {
  return {
    participantCounts: {
      total: 10, completed: 7, inProgress: 2, rejected: 1,
    },
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-03-01'),
    avgTime: 45.3,
    avgCleanTime: 42.1,
    participantsWithInvalidCleanTimeCount: 0,
    correctness: NaN,
    ...overrides,
  };
}

const emptyConfig: StudyConfig = createMockStudyConfig({
  components: { comp1: { type: 'questionnaire', response: [] } },
  sequence: { order: 'fixed', components: ['comp1'] },
});

const noParticipants: ParticipantData[] = [];

// ── SummaryView ──────────────────────────────────────────────────────────────

describe('SummaryView', () => {
  test('renders OverviewStats, ComponentStats, and ResponseStats sections', () => {
    const html = renderToStaticMarkup(
      <SummaryView
        visibleParticipants={noParticipants}
        studyConfig={emptyConfig}
        studyId="test-study"
      />,
    );
    expect(html).toContain('Overview Statistics');
    expect(html).toContain('Component Statistics');
    expect(html).toContain('Response Statistics');
  });
});

// ── OverviewStats ────────────────────────────────────────────────────────────

describe('OverviewStats', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test('renders participant counts and stat labels', () => {
    const html = renderToStaticMarkup(
      <OverviewStats overviewData={makeOverviewData()} studyId="test-study" />,
    );
    expect(html).toContain('Total Participants');
    expect(html).toContain('Completed');
    expect(html).toContain('In Progress');
    expect(html).toContain('Rejected');
    expect(html).toContain('Average Time');
    expect(html).toContain('Average Clean Time');
    expect(html).toContain('Correctness');
  });

  test('shows mismatch alert when stored counts differ from calculated counts', () => {
    vi.mocked(useAsync).mockReturnValue({
      execute: vi.fn(), value: { completed: 3, inProgress: 5, rejected: 0 }, status: 'success', error: null,
    } as ReturnType<typeof useAsync>);
    vi.mocked(useStorageEngine).mockReturnValue({ storageEngine: makeStorageEngine(), setStorageEngine: vi.fn() });

    const html = renderToStaticMarkup(
      <OverviewStats
        overviewData={makeOverviewData({
          participantCounts: {
            total: 10, completed: 7, inProgress: 2, rejected: 1,
          },
        })}
        studyId="test-study"
      />,
    );
    // Alert triangle appears for the mismatched field
    expect(html).toContain('alert');
  });

  test('no mismatch alert when stored counts match calculated counts', () => {
    vi.mocked(useAsync).mockReturnValue({
      execute: vi.fn(), value: { completed: 7, inProgress: 2, rejected: 1 }, status: 'success', error: null,
    } as ReturnType<typeof useAsync>);
    vi.mocked(useStorageEngine).mockReturnValue({ storageEngine: makeStorageEngine(), setStorageEngine: vi.fn() });

    const html = renderToStaticMarkup(
      <OverviewStats
        overviewData={makeOverviewData()}
        studyId="test-study"
      />,
    );
    expect(html).not.toContain('alert');
  });

  test('shows excluded-participants warning when participantsWithInvalidCleanTimeCount > 0', () => {
    const html = renderToStaticMarkup(
      <OverviewStats
        overviewData={makeOverviewData({ participantsWithInvalidCleanTimeCount: 3 })}
        studyId="test-study"
      />,
    );
    expect(html).toContain('alert');
  });

  test('no excluded warning when participantsWithInvalidCleanTimeCount is 0', () => {
    const html = renderToStaticMarkup(
      <OverviewStats
        overviewData={makeOverviewData({ participantsWithInvalidCleanTimeCount: 0 })}
        studyId="test-study"
      />,
    );
    expect(html).not.toContain('alert');
  });

  test('no stored counts fetched when studyId is undefined', () => {
    renderToStaticMarkup(
      <OverviewStats overviewData={makeOverviewData()} />,
    );
    // useAsync should have been called with null as immediate (no fetch)
    expect(vi.mocked(useAsync).mock.calls[0][1]).toBeNull();
  });
});

// ── ComponentStats ───────────────────────────────────────────────────────────

describe('ComponentStats', () => {
  beforeEach(() => { capturedTableOptions = null; });

  test('renders Component Statistics title', () => {
    const html = renderToStaticMarkup(
      <ComponentStats visibleParticipants={noParticipants} studyConfig={emptyConfig} />,
    );
    expect(html).toContain('Component Statistics');
  });

  test('avgTime Cell renders formatted seconds', () => {
    renderToStaticMarkup(
      <ComponentStats visibleParticipants={noParticipants} studyConfig={emptyConfig} />,
    );
    const col = capturedTableOptions!.columns.find((c) => c.accessorKey === 'avgTime')!;
    expect(col.Cell({ cell: { getValue: () => 30 } })).toBe('30.0s');
    expect(col.Cell({ cell: { getValue: () => NaN } })).toBe('N/A');
  });

  test('avgCleanTime Cell renders formatted seconds', () => {
    renderToStaticMarkup(
      <ComponentStats visibleParticipants={noParticipants} studyConfig={emptyConfig} />,
    );
    const col = capturedTableOptions!.columns.find((c) => c.accessorKey === 'avgCleanTime')!;
    expect(col.Cell({ cell: { getValue: () => 25.5 } })).toBe('25.5s');
  });

  test('correctness Cell renders formatted percentage', () => {
    renderToStaticMarkup(
      <ComponentStats visibleParticipants={noParticipants} studyConfig={emptyConfig} />,
    );
    const col = capturedTableOptions!.columns.find((c) => c.accessorKey === 'correctness')!;
    expect(col.Cell({ cell: { getValue: () => 80 } })).toBe('80.0%');
    expect(col.Cell({ cell: { getValue: () => NaN } })).toBe('N/A');
  });
});

// ── ResponseStats ────────────────────────────────────────────────────────────

describe('ResponseStats', () => {
  beforeEach(() => { capturedTableOptions = null; });

  test('renders Response Statistics title', () => {
    const html = renderToStaticMarkup(
      <ResponseStats visibleParticipants={noParticipants} studyConfig={emptyConfig} />,
    );
    expect(html).toContain('Response Statistics');
  });

  test('correctness Cell renders formatted percentage', () => {
    renderToStaticMarkup(
      <ResponseStats visibleParticipants={noParticipants} studyConfig={emptyConfig} />,
    );
    const col = capturedTableOptions!.columns.find((c) => c.accessorKey === 'correctness')!;
    expect(col.Cell({ cell: { getValue: () => 50 } })).toBe('50.0%');
    expect(col.Cell({ cell: { getValue: () => NaN } })).toBe('N/A');
  });
});
