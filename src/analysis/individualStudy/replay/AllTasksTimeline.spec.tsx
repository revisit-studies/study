import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, test, vi,
} from 'vitest';
import * as d3 from 'd3';
import { StudyConfig } from '../../../parser/types';
import { ParticipantData } from '../../../storage/types';
import { AllTasksTimeline } from './AllTasksTimeline';
import { SingleTask } from './SingleTask';
import { SingleTaskLabelLines } from './SingleTaskLabelLines';

// ── mocks ────────────────────────────────────────────────────────────────────

vi.mock('@mantine/core', () => ({
  Center: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children, label }: { children: ReactNode; label?: ReactNode }) => (
    <div>
      <div>{label}</div>
      {children}
    </div>
  ),
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconCheck: () => <span>icon-check</span>,
  IconMicrophone: () => <span>icon-microphone</span>,
  IconProgress: () => <span>icon-progress</span>,
  IconX: () => <span>icon-x</span>,
}));

vi.mock('@mantine/hooks', () => ({
  useResizeObserver: () => [{ current: null }, { width: 60, height: 20 }],
}));

vi.mock('../../../utils/useNavigateToTrial', () => ({
  useNavigateToTrial: () => vi.fn(),
}));

vi.mock('../../../utils/correctAnswer', () => ({
  componentAnswersAreCorrect: vi.fn(() => true),
}));

vi.mock('../../../utils/handleConditionLogic', () => ({
  parseConditionParam: vi.fn(() => []),
}));

// ── fixtures ─────────────────────────────────────────────────────────────────

const t0 = 1_700_000_000_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeParticipant(overrides: Record<string, any> = {}): ParticipantData {
  return {
    participantId: 'pid-1',
    conditions: undefined,
    searchParams: {},
    answers: {
      trial1_0: {
        componentName: 'trial1',
        startTime: t0,
        endTime: t0 + 10_000,
        answer: {},
        correctAnswer: [],
        trialOrder: '0_0',
        windowEvents: [],
      },
    },
    ...overrides,
  } as unknown as ParticipantData;
}

const emptyConfig = {
  components: {},
  uiConfig: {},
  sequence: { order: 'fixed', components: [] },
} as unknown as StudyConfig;

const xScale = d3.scaleLinear([0, 500]).domain([0, 1000]);

// ── SingleTaskLabelLines ──────────────────────────────────────────────────────

describe('SingleTaskLabelLines', () => {
  test('renders a <line> element with computed coordinates', () => {
    const scale = d3.scaleLinear([0, 400]).domain([0, 100]);
    const html = renderToStaticMarkup(
      <svg>
        <SingleTaskLabelLines xScale={scale} height={100} scaleStart={50} />
      </svg>,
    );
    // scaleStart=50 → scale(50)=200; x1=x2=202; y1=100-45-0=55; y2=100-25=75
    expect(html).toContain('x1="202"');
    expect(html).toContain('x2="202"');
    expect(html).toContain('y1="55"');
    expect(html).toContain('y2="75"');
  });

  test('applies labelHeight offset to y1', () => {
    const scale = d3.scaleLinear([0, 400]).domain([0, 100]);
    const html = renderToStaticMarkup(
      <svg>
        <SingleTaskLabelLines xScale={scale} height={100} scaleStart={50} labelHeight={25} />
      </svg>,
    );
    // y1 = height - 45 - labelHeight = 100 - 45 - 25 = 30
    expect(html).toContain('y1="30"');
  });
});

// ── SingleTask ────────────────────────────────────────────────────────────────

describe('SingleTask', () => {
  const baseProps = {
    name: 'trial1_0',
    height: 100,
    xScale,
    scaleStart: 0,
    scaleEnd: 100,
    trialOrder: '0_0',
    participantId: 'pid-1',
    studyId: 'test-study',
    incomplete: false,
    isCorrect: false,
    hasCorrect: false,
    hasAudio: false,
  };

  test('renders task name', () => {
    const html = renderToStaticMarkup(<svg><SingleTask {...baseProps} /></svg>);
    expect(html).toContain('trial1_0');
  });

  test('shows check icon when hasCorrect and isCorrect', () => {
    const html = renderToStaticMarkup(
      <svg><SingleTask {...baseProps} hasCorrect isCorrect /></svg>,
    );
    expect(html).toContain('icon-check');
  });

  test('shows x icon when hasCorrect and not isCorrect', () => {
    const html = renderToStaticMarkup(
      <svg><SingleTask {...baseProps} hasCorrect isCorrect={false} /></svg>,
    );
    expect(html).toContain('icon-x');
  });

  test('shows microphone icon when hasAudio', () => {
    const html = renderToStaticMarkup(
      <svg><SingleTask {...baseProps} hasAudio /></svg>,
    );
    expect(html).toContain('icon-microphone');
  });

  test('shows progress icon when incomplete', () => {
    const html = renderToStaticMarkup(
      <svg><SingleTask {...baseProps} incomplete /></svg>,
    );
    expect(html).toContain('icon-progress');
  });

  test('no correctness icon when hasCorrect is false', () => {
    const html = renderToStaticMarkup(<svg><SingleTask {...baseProps} /></svg>);
    expect(html).not.toContain('icon-check');
    expect(html).not.toContain('icon-x');
  });
});

// ── AllTasksTimeline ──────────────────────────────────────────────────────────

describe('AllTasksTimeline', () => {
  test('renders an SVG element', () => {
    const html = renderToStaticMarkup(
      <AllTasksTimeline
        participantData={makeParticipant()}
        width={600}
        studyId="test-study"
        studyConfig={emptyConfig}
        maxLength={undefined}
      />,
    );
    expect(html).toContain('<svg');
  });

  test('renders task name label in output', () => {
    const html = renderToStaticMarkup(
      <AllTasksTimeline
        participantData={makeParticipant()}
        width={600}
        studyId="test-study"
        studyConfig={emptyConfig}
        maxLength={undefined}
      />,
    );
    expect(html).toContain('trial1_0');
  });

  test('handles participant with answer values (tooltip shows answer)', () => {
    const participant = makeParticipant({
      answers: {
        trial1_0: {
          componentName: 'trial1',
          startTime: t0,
          endTime: t0 + 5_000,
          answer: { q1: 'yes' },
          correctAnswer: [],
          trialOrder: '0_0',
          windowEvents: [],
        },
      },
    });

    const html = renderToStaticMarkup(
      <AllTasksTimeline
        participantData={participant}
        width={600}
        studyId="test-study"
        studyConfig={emptyConfig}
        maxLength={undefined}
      />,
    );
    expect(html).toContain('q1');
    expect(html).toContain('yes');
  });

  test('handles participant with incomplete answer (startTime === 0)', () => {
    const participant = makeParticipant({
      answers: {
        trial1_0: {
          componentName: 'trial1',
          startTime: t0,
          endTime: t0 + 5_000,
          answer: {},
          correctAnswer: [],
          trialOrder: '0_0',
          windowEvents: [],
        },
        trial2_1: {
          componentName: 'trial2',
          startTime: 0,
          endTime: 0,
          answer: {},
          correctAnswer: [],
          trialOrder: '1_0',
          windowEvents: [],
        },
      },
    });

    const html = renderToStaticMarkup(
      <AllTasksTimeline
        participantData={participant}
        width={600}
        studyId="test-study"
        studyConfig={emptyConfig}
        maxLength={undefined}
      />,
    );
    expect(html).toContain('trial1_0');
    expect(html).toContain('trial2_1');
  });

  test('handles browsed-away window events', () => {
    const participant = makeParticipant({
      answers: {
        trial1_0: {
          componentName: 'trial1',
          startTime: t0,
          endTime: t0 + 10_000,
          answer: {},
          correctAnswer: [],
          trialOrder: '0_0',
          windowEvents: [
            [t0 + 1_000, 'visibility', 'hidden'],
            [t0 + 3_000, 'visibility', 'visible'],
          ],
        },
      },
    });

    const html = renderToStaticMarkup(
      <AllTasksTimeline
        participantData={participant}
        width={600}
        studyId="test-study"
        studyConfig={emptyConfig}
        maxLength={undefined}
      />,
    );
    // Browsed-away rect should be rendered inside a Tooltip
    expect(html).toContain('<rect');
  });

  test('respects maxLength cap on x scale', () => {
    // With maxLength set, the xScale domain is [start, start + maxLength]
    // — just verify the component renders without error
    const html = renderToStaticMarkup(
      <AllTasksTimeline
        participantData={makeParticipant()}
        width={600}
        studyId="test-study"
        studyConfig={emptyConfig}
        maxLength={5_000}
      />,
    );
    expect(html).toContain('<svg');
  });

  test('renders condition param when participant has conditions', () => {
    // parseConditionParam is mocked to return [] by default; just verify
    // the component renders without error when conditions field is set
    const participant = makeParticipant({
      conditions: 'condA,condB',
    });

    const html = renderToStaticMarkup(
      <AllTasksTimeline
        participantData={participant}
        width={600}
        studyId="test-study"
        studyConfig={emptyConfig}
        maxLength={undefined}
      />,
    );
    expect(html).toContain('<svg');
  });
});
