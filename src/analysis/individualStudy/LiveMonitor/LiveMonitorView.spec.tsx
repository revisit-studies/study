import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, it,
} from 'vitest';
import {
  LiveMonitorView,
  getFilteredParticipantProgress,
  groupParticipantProgress,
} from './LiveMonitorView';
import { ParticipantSection } from './ParticipantSection';
import { ProgressHeatmap } from './ProgressHeatmap';

describe('LiveMonitorView helpers', () => {
  it('filters by participant status and selected stages', () => {
    const result = getFilteredParticipantProgress(
      [
        {
          participantId: 'p1',
          answered: ['a'],
          total: 2,
          completed: null,
          rejected: false,
          stage: 'S1',
          createdTime: 1,
        },
        {
          participantId: 'p2',
          answered: ['a', 'b'],
          total: 2,
          completed: 100,
          rejected: false,
          stage: 'S2',
          createdTime: 2,
        },
      ] as never,
      ['inprogress'],
      ['S1'],
    );

    expect(result).toHaveLength(1);
    expect(result[0].assignment.participantId).toBe('p1');
  });

  it('groups progress by in-progress/completed/rejected', () => {
    const grouped = groupParticipantProgress([
      { isCompleted: false, isRejected: false },
      { isCompleted: true, isRejected: false },
      { isCompleted: false, isRejected: true },
    ] as never);

    expect(grouped.inProgress).toHaveLength(1);
    expect(grouped.completed).toHaveLength(1);
    expect(grouped.rejected).toHaveLength(1);
  });
});

describe('LiveMonitorView', () => {
  it('renders monitor header and participant sections', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <LiveMonitorView
          studyConfig={{} as never}
          storageEngine={undefined}
          studyId={undefined}
          includedParticipants={['completed', 'inprogress', 'rejected']}
          selectedStages={['ALL']}
        />
      </MantineProvider>,
    );

    expect(html).toContain('Live Monitor');
    expect(html).toContain('In Progress');
    expect(html).toContain('Completed');
    expect(html).toContain('Rejected');
  });
});

function Label({ progress }: { progress: number }) {
  return <span>{`label:${Math.round(progress)}`}</span>;
}

describe('ParticipantSection', () => {
  it('renders participant row with dynamic badge and heatmap', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ParticipantSection
          title="In Progress"
          titleColor="orange"
          participants={[{
            assignment: {
              participantId: 'p1',
              isDynamic: true,
              createdTime: 1000,
              total: 4,
              answered: ['a'],
            },
            progress: 25,
            isCompleted: false,
            isRejected: false,
          }] as never}
          showProgressHeatmap
          showDynamicBadge
          progressValue={() => 25}
          progressColor="orange"
          progressLabel={Label}
        />
      </MantineProvider>,
    );

    expect(html).toContain('In Progress');
    expect(html).toContain('Participant:');
    expect(html).toContain('DYNAMIC');
    expect(html).toContain('Q1');
    expect(html).toContain('?');
    expect(html).toContain('label:25');
  });
});

describe('ProgressHeatmap', () => {
  it('returns empty output for invalid totals', () => {
    const html = renderToStaticMarkup(<ProgressHeatmap total={0} answered={[]} isDynamic={false} />);
    expect(html).toBe('');
  });

  it('renders question blocks for fixed sequences', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ProgressHeatmap total={3} answered={['A1']} isDynamic={false} />
      </MantineProvider>,
    );
    expect(html).toContain('Q1');
    expect(html).toContain('Q2');
    expect(html).toContain('Q3');
  });

  it('renders dynamic marker for dynamic sequences', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ProgressHeatmap total={5} answered={['A1', 'A2']} isDynamic />
      </MantineProvider>,
    );
    expect(html).toContain('?');
  });
});
