import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as d3 from 'd3';
import {
  describe, expect, it, vi,
} from 'vitest';
import { AllTasksTimeline } from './AllTasksTimeline';
import { SingleTask } from './SingleTask';
import { SingleTaskLabelLines } from './SingleTaskLabelLines';

vi.mock('../../../utils/correctAnswer', () => ({
  componentAnswersAreCorrect: () => true,
}));

vi.mock('../../../utils/handleConditionLogic', () => ({
  parseConditionParam: () => ['A'],
}));

vi.mock('@mantine/hooks', () => ({
  useResizeObserver: () => [vi.fn(), { width: 60 }],
}));

vi.mock('../../../utils/useNavigateToTrial', () => ({
  useNavigateToTrial: () => vi.fn(),
}));

vi.mock('@mantine/core', () => ({
  Center: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Tooltip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconCheck: () => <span>check</span>,
  IconProgress: () => <span>progress</span>,
  IconX: () => <span>x</span>,
}));

describe('AllTasksTimeline', () => {
  it('renders svg timeline with task labels', () => {
    const participantData = {
      participantId: 'p-1',
      conditions: 'A',
      answers: {
        trial_1: {
          trialOrder: '1_1',
          startTime: 10,
          endTime: 20,
          answer: { q1: 'a' },
          correctAnswer: [],
        },
      },
    };

    const html = renderToStaticMarkup(
      <AllTasksTimeline
        participantData={participantData as never}
        width={600}
        studyId="study-a"
        studyConfig={{ components: {} } as never}
        maxLength={undefined}
      />,
    );

    expect(html).toContain('<svg');
    expect(html).toContain('trial_1');
  });
});

describe('SingleTask', () => {
  it('renders task name and incomplete icon', () => {
    const scale = d3.scaleLinear([0, 100]).domain([0, 10]);
    const html = renderToStaticMarkup(
      <svg>
        <SingleTask
          xScale={scale}
          name="trial_1"
          height={120}
          isCorrect={false}
          hasCorrect
          scaleStart={1}
          scaleEnd={2}
          incomplete
          trialOrder="1_1"
          participantId="p1"
          studyId="s1"
        />
      </svg>,
    );

    expect(html).toContain('trial_1');
    expect(html).toContain('progress');
  });
});

describe('SingleTaskLabelLines', () => {
  it('renders a connector line using provided scale and coordinates', () => {
    const scale = d3.scaleLinear([0, 100]).domain([0, 10]);
    const html = renderToStaticMarkup(
      <svg>
        <SingleTaskLabelLines xScale={scale} height={120} labelHeight={10} scaleStart={5} />
      </svg>,
    );

    expect(html).toContain('<line');
    expect(html).toContain('stroke="gray"');
  });
});
