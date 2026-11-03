import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  render, act, cleanup, fireEvent,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { SequenceAssignment } from '../../../../storage/engines/types';
import { ParticipantStatus } from '../../../../storage/participantStatus';
import { makeStorageEngine, makeSequenceAssignment } from '../../../../tests/utils';
import {
  getFilteredParticipantProgress,
  groupParticipantProgress,
  LiveMonitorView,
} from '../LiveMonitorView';
import { ParticipantSection } from '../ParticipantSection';
import { ProgressHeatmap } from '../ProgressHeatmap';

// ── mocks ────────────────────────────────────────────────────────────────────

vi.mock('@mantine/core', () => ({
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Title: ({ children }: { children: ReactNode }) => <h5>{children}</h5>,
  Badge: ({ children, variant }: { children: ReactNode; variant?: string }) => <span data-variant={variant}>{children}</span>,
  ActionIcon: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
  Center: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Indicator: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => <button type="button" onClick={onClick}>{children}</button>,
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Grid: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    { Col: ({ children }: { children: ReactNode }) => <div>{children}</div> },
  ),
  RingProgress: ({ label }: { label?: ReactNode }) => <div>{label}</div>,
  Collapse: ({ children, expanded: open }: { children: ReactNode; expanded?: boolean }) => (
    open ? <div>{children}</div> : null
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconCheck: () => <span>icon-check</span>,
  IconWifi: () => <span>icon-wifi</span>,
  IconWifiOff: () => <span>icon-wifioff</span>,
  IconRefresh: () => <span>icon-refresh</span>,
  IconChevronDown: () => <span>icon-chevron-down</span>,
  IconChevronRight: () => <span>icon-chevron-right</span>,
}));

vi.mock('../../../../storage/engines/FirebaseStorageEngine', () => ({
  FirebaseStorageEngine: class { },
}));

// ── fixture helpers ───────────────────────────────────────────────────────────

function makeAssignment(overrides: Partial<SequenceAssignment> = {}): SequenceAssignment {
  return makeSequenceAssignment({
    timestamp: 1_700_000_000_000,
    total: 5,
    createdTime: 1_700_000_000_000,
    ...overrides,
  });
}

// ── getFilteredParticipantProgress ────────────────────────────────────────────

describe('getFilteredParticipantProgress', () => {
  test('returns empty array when no assignments', () => {
    expect(getFilteredParticipantProgress([], ['inProgress'], ['ALL'])).toEqual([]);
  });

  test('maps progress as percentage of answered/total', () => {
    const a = makeAssignment({ answered: ['q1', 'q2'], total: 4 });
    const [result] = getFilteredParticipantProgress([a], ['inProgress'], ['ALL']);
    expect(result.progress).toBe(50);
  });

  test('progress is 0 when total is 0', () => {
    const a = makeAssignment({ answered: [], total: 0 });
    const [result] = getFilteredParticipantProgress([a], ['inProgress'], ['ALL']);
    expect(result.progress).toBe(0);
  });

  test('status is completed when completed is non-null', () => {
    const a = makeAssignment({ completed: 1_700_000_000_000 });
    const [result] = getFilteredParticipantProgress([a], ['completed'], ['ALL']);
    expect(result.status).toBe('completed');
  });

  test('status is rejected when rejected is true', () => {
    const a = makeAssignment({ rejected: true });
    const [result] = getFilteredParticipantProgress([a], ['rejected'], ['ALL']);
    expect(result.status).toBe('rejected');
  });

  test('status is timedOut for an unfinished timed-out assignment', () => {
    const a = makeAssignment({ autoTimedOutAt: 1_700_000_000_000 });
    const [result] = getFilteredParticipantProgress([a], ['timedOut'], ['ALL']);
    expect(result.status).toBe('timedOut');
  });

  test('status is completedLate when a timed-out assignment finishes', () => {
    const a = makeAssignment({ autoTimedOutAt: 1_700_000_000_000, completed: 1_700_000_100_000 });
    expect(getFilteredParticipantProgress([a], ['timedOut'], ['ALL'])).toHaveLength(0);
    const [result] = getFilteredParticipantProgress([a], ['completedLate'], ['ALL']);
    expect(result.status).toBe('completedLate');
  });

  test('a rejected assignment stays rejected even when it timed out', () => {
    const a = makeAssignment({ autoTimedOutAt: 1_700_000_000_000, rejected: true });
    const [result] = getFilteredParticipantProgress([a], ['rejected'], ['ALL']);
    expect(result.status).toBe('rejected');
  });

  test('filters out participants whose status is not in includedParticipants', () => {
    const a = makeAssignment(); // inProgress
    const result = getFilteredParticipantProgress([a], ['completed'], ['ALL']);
    expect(result).toHaveLength(0);
  });

  test('selectedStages ALL passes any stage', () => {
    const a = makeAssignment({ stage: 'STAGE_B' });
    const result = getFilteredParticipantProgress([a], ['inProgress'], ['ALL']);
    expect(result).toHaveLength(1);
  });

  test('selectedStages filters by specific stage', () => {
    const a1 = makeAssignment({ participantId: 'p1', stage: 'STAGE_A' });
    const a2 = makeAssignment({ participantId: 'p2', stage: 'STAGE_B' });
    const result = getFilteredParticipantProgress([a1, a2], ['inProgress'], ['STAGE_A']);
    expect(result).toHaveLength(1);
    expect(result[0].assignment.participantId).toBe('p1');
  });

  test('sorts by createdTime descending (newest first)', () => {
    const a1 = makeAssignment({ participantId: 'old', createdTime: 1_000 });
    const a2 = makeAssignment({ participantId: 'new', createdTime: 2_000 });
    const result = getFilteredParticipantProgress([a1, a2], ['inProgress'], ['ALL']);
    expect(result[0].assignment.participantId).toBe('new');
  });
});

// ── groupParticipantProgress ──────────────────────────────────────────────────

describe('groupParticipantProgress', () => {
  function makeProgress(status: ParticipantStatus) {
    return { assignment: makeAssignment(), progress: 50, status };
  }

  test('splits into one group per status', () => {
    const items = [
      makeProgress('inProgress'),
      makeProgress('completed'),
      makeProgress('rejected'),
      makeProgress('rejected'),
      makeProgress('timedOut'),
      makeProgress('completedLate'),
    ];
    const groups = groupParticipantProgress(items);
    expect(groups.inProgress).toHaveLength(1);
    expect(groups.completed).toHaveLength(1);
    expect(groups.rejected).toHaveLength(2);
    expect(groups.timedOut).toHaveLength(1);
    expect(groups.completedLate).toHaveLength(1);
  });

  test('a completed-late participant is grouped as neither completed nor timed out', () => {
    const groups = groupParticipantProgress([makeProgress('completedLate')]);
    expect(groups.completed).toHaveLength(0);
    expect(groups.timedOut).toHaveLength(0);
    expect(groups.completedLate).toHaveLength(1);
  });

  test('empty input returns empty groups', () => {
    const groups = groupParticipantProgress([]);
    expect(groups.inProgress).toHaveLength(0);
    expect(groups.completed).toHaveLength(0);
    expect(groups.rejected).toHaveLength(0);
    expect(groups.timedOut).toHaveLength(0);
    expect(groups.completedLate).toHaveLength(0);
  });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// ── LiveMonitorView ───────────────────────────────────────────────────────────

describe('LiveMonitorView', () => {
  const baseProps = {
    studyConfig: {} as Parameters<typeof LiveMonitorView>[0]['studyConfig'],
    includedParticipants: ['inProgress', 'completed', 'rejected', 'timedOut', 'completedLate'],
    selectedStages: ['ALL'],
  };

  test('renders Live Monitor heading', () => {
    const html = renderToStaticMarkup(<LiveMonitorView {...baseProps} />);
    expect(html).toContain('Live Monitor');
  });

  test('shows 0 counts when no storageEngine provided', () => {
    const html = renderToStaticMarkup(<LiveMonitorView {...baseProps} />);
    // All participant counts are 0 since no assignments
    expect(html).toContain('0');
  });

  test('shows a badge for every participant status', () => {
    const html = renderToStaticMarkup(<LiveMonitorView {...baseProps} />);
    expect(html).toContain('Completed');
    expect(html).toContain('Active');
    expect(html).toContain('Rejected');
    expect(html).toContain('Timed Out');
    expect(html).toContain('Completed Late');
  });

  test('shows disconnected wifi icon when no storageEngine', () => {
    const html = renderToStaticMarkup(<LiveMonitorView {...baseProps} />);
    // Without a Firebase engine, useEffect will set status to 'disconnected'
    // but renderToStaticMarkup captures initial state ('connecting') — wifioff shown
    expect(html).toContain('icon-wifioff');
  });

  test('shows a section title for every participant status', () => {
    const html = renderToStaticMarkup(<LiveMonitorView {...baseProps} />);
    expect(html).toContain('In Progress');
    expect(html).toContain('Completed');
    expect(html).toContain('Rejected');
    expect(html).toContain('Timed Out');
    expect(html).toContain('Completed Late');
  });

  test('sets connectionStatus to disconnected when no storageEngine after effect', async () => {
    const { container } = await act(async () => render(
      <LiveMonitorView {...baseProps} />,
    ));
    // After effects run, status is 'disconnected' → icon-wifioff shown
    expect(container.textContent).toContain('icon-wifioff');
  });

  test('sets connectionStatus to connected when listener returns a function', async () => {
    const mockUnsubscribe = vi.fn();
    const mockEngine = {
      initializeStudyDb: vi.fn(),
      getAllSequenceAssignments: vi.fn().mockResolvedValue([]),
      _setupSequenceAssignmentListener: vi.fn((_studyId: string, _cb: (assignments: SequenceAssignment[]) => void) => mockUnsubscribe),
    };
    const { container } = await act(async () => render(
      <LiveMonitorView
        {...baseProps}
        storageEngine={makeStorageEngine(mockEngine)}
        studyId="test-study"
      />,
    ));
    // With a valid listener returning a function, status becomes 'connected' → icon-wifi shown
    expect(container.textContent).toContain('icon-wifi');
  });
});

// ── ParticipantSection ────────────────────────────────────────────────────────

describe('ParticipantSection', () => {
  function ProgressLabel({ progress, assignment: _assignment }: { assignment: SequenceAssignment; progress: number }) {
    return <span>{Math.round(progress)}</span>;
  }

  const baseProps = {
    title: 'In Progress',
    titleColor: 'orange',
    progressValue: (_: SequenceAssignment, progress: number) => progress,
    progressColor: 'orange',
    progressLabel: ProgressLabel,
  };

  test('renders section title with participant count', () => {
    const html = renderToStaticMarkup(
      <ParticipantSection {...baseProps} participants={[]} />,
    );
    expect(html).toContain('In Progress');
    expect(html).toContain('(0)');
  });

  test('renders each participant card with participantId', () => {
    const participants = [
      {
        assignment: makeAssignment({ participantId: 'p-alpha', answered: ['q1'], total: 4 }), progress: 25, status: 'inProgress' as const,
      },
    ];
    const html = renderToStaticMarkup(
      <ParticipantSection {...baseProps} participants={participants} />,
    );
    expect(html).toContain('p-alpha');
  });

  test('shows DYNAMIC badge when showDynamicBadge and assignment.isDynamic', () => {
    const participants = [
      {
        assignment: makeAssignment({ participantId: 'p1', isDynamic: true }), progress: 50, status: 'inProgress' as const,
      },
    ];
    const html = renderToStaticMarkup(
      <ParticipantSection {...baseProps} participants={participants} showDynamicBadge />,
    );
    expect(html).toContain('DYNAMIC');
    expect(html).toContain('data-variant="light">DYNAMIC');
  });

  test('no DYNAMIC badge when isDynamic is false', () => {
    const participants = [
      {
        assignment: makeAssignment({ participantId: 'p1', isDynamic: false }), progress: 50, status: 'inProgress' as const,
      },
    ];
    const html = renderToStaticMarkup(
      <ParticipantSection {...baseProps} participants={participants} showDynamicBadge />,
    );
    expect(html).not.toContain('DYNAMIC');
  });

  test('uses "#N" fallback when participantId is empty', () => {
    const participants = [
      {
        assignment: makeAssignment({ participantId: '' }), progress: 50, status: 'inProgress' as const,
      },
    ];
    const html = renderToStaticMarkup(
      <ParticipantSection {...baseProps} participants={participants} />,
    );
    expect(html).toContain('#1');
  });

  test('renders ProgressHeatmap when showProgressHeatmap is true', () => {
    const participants = [
      {
        assignment: makeAssignment({ participantId: 'p1', answered: ['q1'], total: 3 }), progress: 33, status: 'inProgress' as const,
      },
    ];
    const html = renderToStaticMarkup(
      <ParticipantSection {...baseProps} participants={participants} showProgressHeatmap />,
    );
    // ProgressHeatmap renders an SVG
    expect(html).toContain('<svg');
  });
});

// ── LiveMonitorView interactive ───────────────────────────────────────────────

describe('LiveMonitorView interactive', () => {
  const baseProps = {
    studyConfig: {} as Parameters<typeof LiveMonitorView>[0]['studyConfig'],
    includedParticipants: ['inProgress', 'completed', 'rejected', 'timedOut', 'completedLate'],
    selectedStages: ['ALL'],
    studyId: 'test-study',
  };

  beforeEach(() => { vi.clearAllMocks(); });

  test('listener callback covers handleDataUpdate + InProgressLabel', async () => {
    const mockEngine = {
      initializeStudyDb: vi.fn(),
      getAllSequenceAssignments: vi.fn().mockResolvedValue([]),
      _setupSequenceAssignmentListener: vi.fn((_id: string, cb: (a: SequenceAssignment[]) => void) => {
        cb([makeAssignment({ participantId: 'p-active', answered: ['q1'], total: 4 })]);
        return vi.fn();
      }),
    };
    const { container } = await act(async () => render(
      <LiveMonitorView {...baseProps} storageEngine={makeStorageEngine(mockEngine)} />,
    ));
    expect(container.textContent).toContain('p-active');
  });

  test('CompletedLabel and RejectedLabel rendered with completed/rejected assignments', async () => {
    const mockEngine = {
      initializeStudyDb: vi.fn(),
      getAllSequenceAssignments: vi.fn().mockResolvedValue([]),
      _setupSequenceAssignmentListener: vi.fn((_id: string, cb: (a: SequenceAssignment[]) => void) => {
        cb([
          makeAssignment({
            participantId: 'p-done', completed: 1_700_000_000_000, answered: ['q1', 'q2', 'q3', 'q4', 'q5'], total: 5,
          }),
          makeAssignment({
            participantId: 'p-rej', rejected: true, answered: ['q1'], total: 5,
          }),
        ]);
        return vi.fn();
      }),
    };
    const { container } = await act(async () => render(
      <LiveMonitorView {...baseProps} storageEngine={makeStorageEngine(mockEngine)} />,
    ));
    expect(container.textContent).toContain('p-done');
    expect(container.textContent).toContain('p-rej');
  });

  test('sets connectionStatus to disconnected when listener returns undefined', async () => {
    const mockEngine = {
      initializeStudyDb: vi.fn(),
      getAllSequenceAssignments: vi.fn().mockResolvedValue([]),
      _setupSequenceAssignmentListener: vi.fn(() => undefined),
    };
    const { container } = await act(async () => render(
      <LiveMonitorView {...baseProps} storageEngine={makeStorageEngine(mockEngine)} />,
    ));
    expect(container.textContent).toContain('icon-wifioff');
  });

  test('Reconnect button click covers handleReconnect success path', async () => {
    const mockEngine = {
      initializeStudyDb: vi.fn(),
      getAllSequenceAssignments: vi.fn().mockResolvedValue([makeAssignment({ participantId: 'p-new' })]),
      _setupSequenceAssignmentListener: vi.fn(() => undefined),
    };
    const { getAllByRole } = await act(async () => render(
      <LiveMonitorView {...baseProps} storageEngine={makeStorageEngine(mockEngine)} />,
    ));
    const reconnectBtn = getAllByRole('button').find((b) => b.textContent?.includes('Reconnect'));
    expect(reconnectBtn).toBeDefined();
    await act(async () => { fireEvent.click(reconnectBtn!); });
    expect(mockEngine.getAllSequenceAssignments).toHaveBeenCalled();
  });

  test('Reconnect button click covers handleReconnect error path', async () => {
    const mockEngine = {
      initializeStudyDb: vi.fn(),
      getAllSequenceAssignments: vi.fn().mockRejectedValue(new Error('conn failed')),
      _setupSequenceAssignmentListener: vi.fn(() => undefined),
    };
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    const { getAllByRole } = await act(async () => render(
      <LiveMonitorView {...baseProps} storageEngine={makeStorageEngine(mockEngine)} />,
    ));
    const reconnectBtn = getAllByRole('button').find((b) => b.textContent?.includes('Reconnect'));
    expect(reconnectBtn).toBeDefined();
    await act(async () => { fireEvent.click(reconnectBtn!); });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('window offline event covers handleOffline', async () => {
    const mockEngine = {
      initializeStudyDb: vi.fn(),
      getAllSequenceAssignments: vi.fn().mockResolvedValue([]),
      _setupSequenceAssignmentListener: vi.fn((_id: string, cb: (a: SequenceAssignment[]) => void) => {
        cb([]);
        return vi.fn();
      }),
    };
    await act(async () => render(
      <LiveMonitorView {...baseProps} storageEngine={makeStorageEngine(mockEngine)} />,
    ));
    act(() => { window.dispatchEvent(new Event('offline')); });
  });

  test('window online event covers handleOnline when disconnected', async () => {
    const mockEngine = {
      initializeStudyDb: vi.fn(),
      getAllSequenceAssignments: vi.fn().mockResolvedValue([]),
      _setupSequenceAssignmentListener: vi.fn(() => undefined),
    };
    await act(async () => render(
      <LiveMonitorView {...baseProps} storageEngine={makeStorageEngine(mockEngine)} />,
    ));
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect(mockEngine.getAllSequenceAssignments).toHaveBeenCalled();
  });
});

// ── ProgressHeatmap ───────────────────────────────────────────────────────────

describe('ProgressHeatmap', () => {
  test('returns null when total is 0', () => {
    const html = renderToStaticMarkup(
      <ProgressHeatmap total={0} answered={[]} isDynamic={false} />,
    );
    expect(html).toBe('');
  });

  test('returns null when total is NaN', () => {
    const html = renderToStaticMarkup(
      <ProgressHeatmap total={NaN} answered={[]} isDynamic={false} />,
    );
    expect(html).toBe('');
  });

  test('renders SVG with Q labels for each task', () => {
    const html = renderToStaticMarkup(
      <ProgressHeatmap total={3} answered={['comp1']} isDynamic={false} />,
    );
    expect(html).toContain('Q1');
    expect(html).toContain('Q2');
    expect(html).toContain('Q3');
  });

  test('answered tasks use green fill', () => {
    const html = renderToStaticMarkup(
      <ProgressHeatmap total={2} answered={['comp1']} isDynamic={false} />,
    );
    expect(html).toContain('green');
  });

  test('unanswered tasks pair a dark grey fill with white labels', () => {
    const html = renderToStaticMarkup(
      <ProgressHeatmap total={2} answered={[]} isDynamic={false} />,
    );
    expect(html.match(/fill="var\(--mantine-color-gray-7\)"/g)).toHaveLength(2);
    expect(html.match(/stroke="var\(--mantine-color-gray-8\)"/g)).toHaveLength(2);
    expect(html.match(/fill="white"/g)).toHaveLength(2);
  });

  test('dynamic mode uses teal fill and shows ? indicator', () => {
    const html = renderToStaticMarkup(
      <ProgressHeatmap total={2} answered={['comp1', 'comp2']} isDynamic />,
    );
    expect(html).toContain('teal');
    expect(html).toContain('?');
  });

  test('no ? indicator when isDynamic but answered is empty', () => {
    const html = renderToStaticMarkup(
      // isDynamic with no answers → totalTasks=0 → returns null
      <ProgressHeatmap total={3} answered={[]} isDynamic />,
    );
    // totalTasks = answered.length = 0, total check: total=3 > 0 so renders
    // but totalTasks=0, so loop doesn't run and no ? added (isDynamic && totalTasks > 0 is false)
    expect(html).not.toContain('?');
  });
});
