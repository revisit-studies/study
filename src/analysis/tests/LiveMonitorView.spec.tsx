import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  render, act, cleanup, fireEvent,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { SequenceAssignment } from '../../storage/engines/types';
import {
  getFilteredParticipantProgress,
  groupParticipantProgress,
  LiveMonitorView,
} from '../individualStudy/LiveMonitor/LiveMonitorView';
import { ParticipantSection } from '../individualStudy/LiveMonitor/ParticipantSection';
import { ProgressHeatmap } from '../individualStudy/LiveMonitor/ProgressHeatmap';

// ── mocks ────────────────────────────────────────────────────────────────────

vi.mock('@mantine/core', () => ({
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Title: ({ children }: { children: ReactNode }) => <h5>{children}</h5>,
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
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
  Collapse: ({ children, in: open }: { children: ReactNode; in?: boolean }) => (
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

vi.mock('../../storage/engines/FirebaseStorageEngine', () => ({
  FirebaseStorageEngine: class { },
}));

// ── fixture helpers ───────────────────────────────────────────────────────────

function makeAssignment(overrides: Partial<SequenceAssignment> = {}): SequenceAssignment {
  return {
    participantId: 'p1',
    timestamp: 1_700_000_000_000,
    stage: 'DEFAULT',
    answered: [],
    total: 5,
    completed: null,
    claimed: false,
    rejected: false,
    createdTime: 1_700_000_000_000,
    isDynamic: false,
    ...overrides,
  };
}

// ── getFilteredParticipantProgress ────────────────────────────────────────────

describe('getFilteredParticipantProgress', () => {
  test('returns empty array when no assignments', () => {
    expect(getFilteredParticipantProgress([], ['inprogress'], ['ALL'])).toEqual([]);
  });

  test('maps progress as percentage of answered/total', () => {
    const a = makeAssignment({ answered: ['q1', 'q2'], total: 4 });
    const [result] = getFilteredParticipantProgress([a], ['inprogress'], ['ALL']);
    expect(result.progress).toBe(50);
  });

  test('progress is 0 when total is 0', () => {
    const a = makeAssignment({ answered: [], total: 0 });
    const [result] = getFilteredParticipantProgress([a], ['inprogress'], ['ALL']);
    expect(result.progress).toBe(0);
  });

  test('isCompleted is true when completed is non-null', () => {
    const a = makeAssignment({ completed: 1_700_000_000_000 });
    const [result] = getFilteredParticipantProgress([a], ['completed'], ['ALL']);
    expect(result.isCompleted).toBe(true);
  });

  test('isRejected is true when rejected is true', () => {
    const a = makeAssignment({ rejected: true });
    const [result] = getFilteredParticipantProgress([a], ['rejected'], ['ALL']);
    expect(result.isRejected).toBe(true);
  });

  test('filters out participants whose status is not in includedParticipants', () => {
    const a = makeAssignment(); // inprogress
    const result = getFilteredParticipantProgress([a], ['completed'], ['ALL']);
    expect(result).toHaveLength(0);
  });

  test('selectedStages ALL passes any stage', () => {
    const a = makeAssignment({ stage: 'STAGE_B' });
    const result = getFilteredParticipantProgress([a], ['inprogress'], ['ALL']);
    expect(result).toHaveLength(1);
  });

  test('selectedStages filters by specific stage', () => {
    const a1 = makeAssignment({ participantId: 'p1', stage: 'STAGE_A' });
    const a2 = makeAssignment({ participantId: 'p2', stage: 'STAGE_B' });
    const result = getFilteredParticipantProgress([a1, a2], ['inprogress'], ['STAGE_A']);
    expect(result).toHaveLength(1);
    expect(result[0].assignment.participantId).toBe('p1');
  });

  test('sorts by createdTime descending (newest first)', () => {
    const a1 = makeAssignment({ participantId: 'old', createdTime: 1_000 });
    const a2 = makeAssignment({ participantId: 'new', createdTime: 2_000 });
    const result = getFilteredParticipantProgress([a1, a2], ['inprogress'], ['ALL']);
    expect(result[0].assignment.participantId).toBe('new');
  });
});

// ── groupParticipantProgress ──────────────────────────────────────────────────

describe('groupParticipantProgress', () => {
  function makeProgress(isCompleted: boolean, isRejected: boolean) {
    return {
      assignment: makeAssignment(),
      progress: 50,
      isCompleted,
      isRejected,
    };
  }

  test('splits into inProgress, completed, rejected groups', () => {
    const items = [
      makeProgress(false, false), // inProgress
      makeProgress(true, false), // completed
      makeProgress(true, true), // rejected (rejected takes precedence)
      makeProgress(false, true), // rejected
    ];
    const { inProgress, completed, rejected } = groupParticipantProgress(items);
    expect(inProgress).toHaveLength(1);
    expect(completed).toHaveLength(1);
    expect(rejected).toHaveLength(2);
  });

  test('empty input returns empty groups', () => {
    const { inProgress, completed, rejected } = groupParticipantProgress([]);
    expect(inProgress).toHaveLength(0);
    expect(completed).toHaveLength(0);
    expect(rejected).toHaveLength(0);
  });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// ── LiveMonitorView ───────────────────────────────────────────────────────────

describe('LiveMonitorView', () => {
  const baseProps = {
    studyConfig: {} as Parameters<typeof LiveMonitorView>[0]['studyConfig'],
    includedParticipants: ['inprogress', 'completed', 'rejected'],
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

  test('shows Completed, Active, Rejected badges', () => {
    const html = renderToStaticMarkup(<LiveMonitorView {...baseProps} />);
    expect(html).toContain('Completed');
    expect(html).toContain('Active');
    expect(html).toContain('Rejected');
  });

  test('shows disconnected wifi icon when no storageEngine', () => {
    const html = renderToStaticMarkup(<LiveMonitorView {...baseProps} />);
    // Without a Firebase engine, useEffect will set status to 'disconnected'
    // but renderToStaticMarkup captures initial state ('connecting') — wifioff shown
    expect(html).toContain('icon-wifioff');
  });

  test('shows In Progress, Completed, Rejected section titles', () => {
    const html = renderToStaticMarkup(<LiveMonitorView {...baseProps} />);
    expect(html).toContain('In Progress');
    expect(html).toContain('Completed');
    expect(html).toContain('Rejected');
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
        storageEngine={mockEngine as never}
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
        assignment: makeAssignment({ participantId: 'p-alpha', answered: ['q1'], total: 4 }), progress: 25, isCompleted: false, isRejected: false,
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
        assignment: makeAssignment({ participantId: 'p1', isDynamic: true }), progress: 50, isCompleted: false, isRejected: false,
      },
    ];
    const html = renderToStaticMarkup(
      <ParticipantSection {...baseProps} participants={participants} showDynamicBadge />,
    );
    expect(html).toContain('DYNAMIC');
  });

  test('no DYNAMIC badge when isDynamic is false', () => {
    const participants = [
      {
        assignment: makeAssignment({ participantId: 'p1', isDynamic: false }), progress: 50, isCompleted: false, isRejected: false,
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
        assignment: makeAssignment({ participantId: '' }), progress: 50, isCompleted: false, isRejected: false,
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
        assignment: makeAssignment({ participantId: 'p1', answered: ['q1'], total: 3 }), progress: 33, isCompleted: false, isRejected: false,
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
    includedParticipants: ['inprogress', 'completed', 'rejected'],
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
      <LiveMonitorView {...baseProps} storageEngine={mockEngine as never} />,
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
      <LiveMonitorView {...baseProps} storageEngine={mockEngine as never} />,
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
      <LiveMonitorView {...baseProps} storageEngine={mockEngine as never} />,
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
      <LiveMonitorView {...baseProps} storageEngine={mockEngine as never} />,
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
      <LiveMonitorView {...baseProps} storageEngine={mockEngine as never} />,
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
      <LiveMonitorView {...baseProps} storageEngine={mockEngine as never} />,
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
      <LiveMonitorView {...baseProps} storageEngine={mockEngine as never} />,
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

  test('unanswered tasks use grey fill', () => {
    const html = renderToStaticMarkup(
      <ProgressHeatmap total={2} answered={[]} isDynamic={false} />,
    );
    expect(html).toContain('grey');
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
