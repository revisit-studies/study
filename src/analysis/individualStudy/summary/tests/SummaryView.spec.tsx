import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { cleanup } from '@testing-library/react';
import { StudyConfig } from '../../../../parser/types';
import { ParticipantDataWithStatus } from '../../../../storage/types';
import { OverviewData } from '../../../types';
import { createMockStudyConfig } from '../../../tests/testUtils';
import { makeParticipant, makeStoredAnswer } from '../../../../tests/utils';
import { SummaryView } from '../SummaryView';
import { getComponentStats, getResponseStats } from '../utils';
import { OverviewStats } from '../OverviewStats';
import { ComponentStats } from '../ComponentStats';
import { ResponseStats } from '../ResponseStats';

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
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Tooltip: ({ children, label }: { children: ReactNode; label?: string }) => (
    <div title={label}>{children}</div>
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconAlertTriangle: () => <span>alert</span>,
}));

// ── fixture helpers ──────────────────────────────────────────────────────────

function makeOverviewData(overrides: Partial<OverviewData> = {}): OverviewData {
  return {
    participantCounts: {
      total: 10, completed: 7, inProgress: 2, rejected: 1, timedOut: 0, completedLate: 0,
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

const noParticipants: ParticipantDataWithStatus[] = [];

test('summary stats grade matrix alternatives in configured numeric row order', () => {
  const config = createMockStudyConfig({
    components: {
      trial1: {
        type: 'questionnaire',
        response: [{
          id: 'matrix', type: 'matrix-checkbox', prompt: 'Matrix', questionOptions: ['10', '2'], answerOptions: ['A', 'B'],
        }],
      },
    },
    sequence: { order: 'fixed', components: ['trial1'] },
  });
  const participant = makeParticipant({
    participantConfigHash: 'hash-1',
    answers: {
      trial1_0: makeStoredAnswer({
        componentName: 'trial1',
        startTime: 1,
        endTime: 2,
        answer: { matrix: { 10: 'A', 2: 'B' } },
        correctAnswer: [{ id: 'matrix', acceptableAnswers: [[['A'], ['B']]] }],
      }),
    },
  });

  expect(getResponseStats([participant], config, { 'hash-1': config })[0]).toMatchObject({
    correctCount: 1,
    totalQuestionCount: 1,
    correctness: 100,
  });
});

// ── SummaryView ──────────────────────────────────────────────────────────────

describe('SummaryView', () => {
  test('renders OverviewStats, ComponentStats, and ResponseStats sections', () => {
    const html = renderToStaticMarkup(
      <SummaryView
        visibleParticipants={noParticipants}
        studyConfig={emptyConfig}
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
      <OverviewStats overviewData={makeOverviewData()} />,
    );
    expect(html).toContain('Total Participants');
    expect(html).toContain('Completed');
    expect(html).toContain('In Progress');
    expect(html).toContain('Rejected');
    expect(html).toContain('Average Time');
    expect(html).toContain('Average Clean Time');
    expect(html).toContain('Correctness');
  });

  test('shows excluded-participants warning when participantsWithInvalidCleanTimeCount > 0', () => {
    const html = renderToStaticMarkup(
      <OverviewStats
        overviewData={makeOverviewData({ participantsWithInvalidCleanTimeCount: 3 })}
      />,
    );
    expect(html).toContain('alert');
  });

  test('no excluded warning when participantsWithInvalidCleanTimeCount is 0', () => {
    const html = renderToStaticMarkup(
      <OverviewStats
        overviewData={makeOverviewData({ participantsWithInvalidCleanTimeCount: 0 })}
      />,
    );
    expect(html).not.toContain('alert');
  });
});

// ── ComponentStats ───────────────────────────────────────────────────────────

describe('ComponentStats', () => {
  beforeEach(() => { capturedTableOptions = null; });

  test.each([
    ['blank', { q1: '' }],
    ['null', { q1: null }],
    ["Don't Know with the default populated", { q1: 10, 'q1-dontKnow': true }],
  ])('does not count an unanswered required answer as correct at a zero threshold (%s)', (_label, answer) => {
    const config = createMockStudyConfig({
      components: {
        comp1: {
          type: 'questionnaire',
          response: [{
            id: 'q1', type: 'numerical', prompt: '', required: true, withDontKnow: true,
          }],
          correctAnswer: [{ id: 'q1', answer: 10, correctnessThreshold: 0 }],
        },
      },
      sequence: { order: 'fixed', components: ['comp1'] },
    });
    const participant = makeParticipant({
      participantConfigHash: '',
      answers: {
        comp1_0: makeStoredAnswer({
          identifier: 'comp1_0',
          componentName: 'comp1',
          startTime: 100,
          endTime: 200,
          answer,
          correctAnswer: [{ id: 'q1', answer: 10, correctnessThreshold: 0 }],
        }),
      },
    });

    const [stats] = getComponentStats([participant], config);

    expect(stats).toMatchObject({
      correctness: 0,
      correctCount: 0,
      totalQuestionCount: 1,
    });
  });

  test('includes matching saved standalone scores when response metadata is missing', () => {
    const participant = makeParticipant({
      participantConfigHash: '',
      answers: {
        comp1_0: makeStoredAnswer({
          identifier: 'comp1_0',
          componentName: 'comp1',
          startTime: 100,
          endTime: 200,
          answer: { standalone: 2 },
          checkAnswer: {
            attemptsUsed: 0,
            correct: false,
            responses: {},
            scores: { standalone: 0.2 },
            answerSnapshot: { standalone: 2 },
          },
        }),
      },
    });

    const [stats] = getComponentStats([participant], emptyConfig);

    expect(stats).toMatchObject({
      correctness: 0,
      correctCount: 0,
      totalQuestionCount: 1,
    });
  });

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
