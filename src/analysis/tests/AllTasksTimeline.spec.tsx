import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, test, vi,
} from 'vitest';
import * as d3 from 'd3';
import { StudyConfig } from '../../parser/types';
import { ParticipantData } from '../../storage/types';
import type { StoredAnswer } from '../../store/types';
import { createMockStudyConfig } from './testUtils';
import { makeStoredAnswer, makeParticipant as _makeParticipant } from '../../tests/utils';
import { AllTasksTimeline } from '../individualStudy/replay/AllTasksTimeline';
import { SingleTask } from '../individualStudy/replay/SingleTask';
import { SingleTaskLabelLines } from '../individualStudy/replay/SingleTaskLabelLines';

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

vi.mock('../../utils/useNavigateToTrial', () => ({
  useNavigateToTrial: () => vi.fn(),
}));

vi.mock('../../utils/correctAnswer', () => ({
  componentAnswersAreCorrect: vi.fn(() => true),
}));

vi.mock('../../utils/handleConditionLogic', () => ({
  parseConditionParam: vi.fn(() => []),
}));

// ── fixtures ─────────────────────────────────────────────────────────────────

const t0 = 1_700_000_000_000;

function makeAnswer(overrides: Partial<StoredAnswer> = {}): StoredAnswer {
  return makeStoredAnswer({
    componentName: 'trial1',
    trialOrder: '0_0',
    startTime: t0,
    endTime: t0 + 10_000,
    ...overrides,
  });
}

function makeParticipant(overrides: Partial<ParticipantData> & { answers?: Record<string, StoredAnswer> } = {}) {
  return _makeParticipant({
    participantId: 'pid-1',
    participantConfigHash: 'hash-1',
    answers: { trial1_0: makeAnswer() },
    ...overrides,
  });
}

const emptyConfig: StudyConfig = createMockStudyConfig();

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
        trial1_0: makeAnswer({ startTime: t0, endTime: t0 + 5_000, answer: { q1: 'yes' } }),
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
        trial1_0: makeAnswer({ startTime: t0, endTime: t0 + 5_000 }),
        trial2_1: makeAnswer({
          componentName: 'trial2', startTime: 0, endTime: 0, trialOrder: '1_0',
        }),
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
        trial1_0: makeAnswer({
          windowEvents: [
            [t0 + 1_000, 'visibility', 'hidden'],
            [t0 + 3_000, 'visibility', 'visible'],
          ],
        }),
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

  test('handles all tracked window event types without error', () => {
    const participant = makeParticipant({
      answers: {
        trial1_0: makeAnswer({
          endTime: t0 + 20_000,
          windowEvents: [
            [t0 + 500, 'mousemove', [100, 200]],
            [t0 + 1_000, 'mousedown', [150, 250]],
            [t0 + 1_100, 'mouseup', [150, 250]],
            [t0 + 2_000, 'keydown', 'Enter'],
            [t0 + 2_100, 'keyup', 'Enter'],
            [t0 + 3_000, 'scroll', [0, 300]],
            [t0 + 4_000, 'focus', 'input#name'],
            [t0 + 5_000, 'input', 'input#name'],
            [t0 + 6_000, 'resize', [1024, 768]],
            [t0 + 7_000, 'visibility', 'hidden'],
            [t0 + 9_000, 'visibility', 'visible'],
          ],
        }),
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
    expect(html).toContain('<svg');
    // The visibility hidden→visible pair should produce a browsed-away rect
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
      conditions: ['condA', 'condB'],
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

  test('tooltip shows N/A for null answer values', () => {
    const participant = makeParticipant({
      answers: {
        trial1_0: makeAnswer({ startTime: t0, endTime: t0 + 5_000, answer: { q1: null } }),
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
    expect(html).toContain('N/A');
  });

  test('tooltip JSON.stringifies object answer values', () => {
    // Use an array so JSON.stringify produces no string-quoted keys (avoids HTML entity encoding)
    const participant = makeParticipant({
      answers: {
        trial1_0: makeAnswer({ startTime: t0, endTime: t0 + 5_000, answer: { q1: [1, 2] } }),
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
    expect(html).toContain('[1,2]');
  });

  test('sortedTaskNames comparator runs with multiple incomplete answers', () => {
    // Three incomplete answers: two share trialOrder prefix "0" (hits true branch),
    // one has prefix "1" (hits false branch of the prefix comparison)
    const participant = makeParticipant({
      answers: {
        trial1_0: makeAnswer({
          componentName: 'trial1', startTime: 0, endTime: 0, trialOrder: '0_0',
        }),
        trial2_0: makeAnswer({
          componentName: 'trial2', startTime: 0, endTime: 0, trialOrder: '0_1',
        }),
        trial3_0: makeAnswer({
          componentName: 'trial3', startTime: 0, endTime: 0, trialOrder: '1_0',
        }),
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
    expect(html).toContain('<svg');
  });
});
