import { ReactNode } from 'react';
import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { ComponentStats } from './ComponentStats';
import { OverviewStats } from './OverviewStats';
import { ResponseStats } from './ResponseStats';
import { SummaryView } from './SummaryView';

let mockedStorageEngine:
  | {
    getParticipantsStatusCounts: (studyId: string) => Promise<{ completed: number; inProgress: number; rejected: number }>;
  }
  | undefined;
const mockUseTable = vi.fn(() => ({ table: 'ok' }));

vi.mock('react-router', () => ({
  useParams: () => ({ studyId: 'study-a' }),
}));

vi.mock('../../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: mockedStorageEngine }),
}));

vi.mock('../../../store/hooks/useAsync', () => ({
  useAsync: () => ({
    value: {
      completed: 9,
      inProgress: 4,
      rejected: 2,
    },
  }),
}));

vi.mock('mantine-react-table', () => ({
  MantineReactTable: () => <div>table</div>,
  useMantineReactTable: () => mockUseTable(),
}));

vi.mock('./utils', () => ({
  getOverviewStats: () => ({
    participantCounts: {
      total: 15,
      completed: 10,
      inProgress: 4,
      rejected: 1,
    },
    startDate: 1,
    endDate: 2,
    avgTime: 3,
    avgCleanTime: 4,
    correctness: 80,
    participantsWithInvalidCleanTimeCount: 1,
  }),
  getComponentStats: () => [{
    component: 'trialA', participants: 3, avgTime: 1, avgCleanTime: 1, correctness: 100,
  }],
  getResponseStats: () => [{
    component: 'trialA',
    type: 'radio',
    question: 'q1',
    options: 'A|B',
    correctness: 90,
  }],
  convertNumberToString: (value: number) => `v:${value}`,
}));

vi.mock('@mantine/core', () => ({
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  MantineProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Paper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Title: ({ children }: { children: ReactNode }) => <h4>{children}</h4>,
  Tooltip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconAlertTriangle: () => <span>alert</span>,
}));

describe('SummaryView', () => {
  beforeEach(() => {
    mockUseTable.mockClear();
    mockedStorageEngine = {
      getParticipantsStatusCounts: async (studyId: string) => ({
        completed: studyId === 'study-a' ? 9 : 0,
        inProgress: 4,
        rejected: 2,
      }),
    };
  });

  it('renders overview, component, and response stats sections', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <SummaryView visibleParticipants={[]} studyConfig={{} as never} />
      </MantineProvider>,
    );

    expect(html).toContain('Overview Statistics');
    expect(html).toContain('Component Statistics');
    expect(html).toContain('Response Statistics');
  });
});

describe('ComponentStats', () => {
  beforeEach(() => {
    mockUseTable.mockClear();
  });

  it('renders table section and initializes mantine table', () => {
    const html = renderToStaticMarkup(
      <ComponentStats visibleParticipants={[]} studyConfig={{} as never} />,
    );

    expect(html).toContain('Component Statistics');
    expect(html).toContain('table');
    expect(mockUseTable).toHaveBeenCalledTimes(1);
  });
});

describe('ResponseStats', () => {
  beforeEach(() => {
    mockUseTable.mockClear();
  });

  it('renders table section and initializes mantine table', () => {
    const html = renderToStaticMarkup(
      <ResponseStats visibleParticipants={[]} studyConfig={{} as never} />,
    );

    expect(html).toContain('Response Statistics');
    expect(html).toContain('table');
    expect(mockUseTable).toHaveBeenCalledTimes(1);
  });
});

describe('OverviewStats', () => {
  it('renders key overview statistics', () => {
    const html = renderToStaticMarkup(
      <OverviewStats
        overviewData={{
          participantCounts: {
            total: 15,
            completed: 10,
            inProgress: 4,
            rejected: 1,
          },
          startDate: 1,
          endDate: 2,
          avgTime: 3,
          avgCleanTime: 4,
          correctness: 80,
          participantsWithInvalidCleanTimeCount: 1,
        } as never}
      />,
    );

    expect(html).toContain('Overview Statistics');
    expect(html).toContain('Total Participants');
    expect(html).toContain('Completed');
    expect(html).toContain('Average Clean Time');
    expect(html).toContain('alert');
  });
});
