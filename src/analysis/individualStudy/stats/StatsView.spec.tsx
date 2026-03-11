import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, it, vi,
} from 'vitest';
import { StatsView } from './StatsView';
import { TrialVisualization } from './TrialVisualization';
import { ResponseVisualization } from './ResponseVisualization';

const mockedTrialId: string | undefined = 'trialA';

vi.mock('react-router', () => ({
  useParams: () => ({ trialId: mockedTrialId }),
}));

vi.mock('../../../components/interface/StepsPanel', () => ({
  StepsPanel: () => <div>steps-panel</div>,
}));

vi.mock('../summary/OverviewStats', () => ({
  OverviewStats: () => <div>overview-stats</div>,
}));

vi.mock('../summary/utils', () => ({
  getOverviewStats: () => ({ participantCounts: { total: 1 } }),
}));

vi.mock('../../../utils/handleComponentInheritance', () => ({
  studyComponentToIndividualComponent: (component: object) => component,
}));

vi.mock('@mantine/hooks', () => ({
  useDisclosure: () => [true, { toggle: vi.fn() }],
  useResizeObserver: () => [vi.fn(), { width: 500 }],
}));

vi.mock('react-vega', () => ({
  VegaLite: () => <div>vega-lite</div>,
}));

vi.mock('../../../utils/correctAnswer', () => ({
  responseAnswerIsCorrect: () => true,
}));

vi.mock('@mantine/core', () => ({
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Code: ({ children }: { children: ReactNode }) => <pre>{children}</pre>,
  Collapse: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Divider: () => <div>divider</div>,
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Paper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SimpleGrid: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Title: ({ children }: { children: ReactNode }) => <h4>{children}</h4>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconAdjustmentsHorizontal: () => <span>i</span>,
  IconBubbleText: () => <span>i</span>,
  IconChartGridDots: () => <span>i</span>,
  IconChevronDown: () => <span>i</span>,
  IconCodePlus: () => <span>i</span>,
  IconCopyCheck: () => <span>i</span>,
  IconDots: () => <span>i</span>,
  IconGridDots: () => <span>i</span>,
  IconHtml: () => <span>i</span>,
  IconLetterCase: () => <span>i</span>,
  IconDragDrop: () => <span>i</span>,
  IconNumber123: () => <span>i</span>,
  IconRadio: () => <span>i</span>,
  IconSelect: () => <span>i</span>,
  IconSquares: () => <span>i</span>,
}));

describe('StatsView', () => {
  it('renders no data message when participant list is empty', () => {
    const html = renderToStaticMarkup(
      <StatsView studyConfig={{} as never} visibleParticipants={[]} />,
    );
    expect(html).toContain('No data available');
  });

  it('renders trial visualization and steps panel when participant data exists', () => {
    const html = renderToStaticMarkup(
      <StatsView
        studyConfig={{
          components: {
            trialA: { response: [] },
          },
        } as never}
        visibleParticipants={[{
          participantId: 'p1',
          answers: {
            trialA_1: {
              startTime: 1,
              endTime: 2,
              answer: {},
            },
          },
        } as never]}
      />,
    );
    expect(html).toContain('steps-panel');
    expect(html).toContain('overview-stats');
    expect(html).toContain('Config and Timing');
  });
});

describe('TrialVisualization', () => {
  it('shows fallback text when no trial is selected', () => {
    const html = renderToStaticMarkup(
      <TrialVisualization participantData={[]} studyConfig={{ components: {} } as never} trialId={undefined} />,
    );
    expect(html).toContain('No trial selected');
  });

  it('renders metadata and response visualizations for selected trial', () => {
    const html = renderToStaticMarkup(
      <TrialVisualization
        participantData={[]}
        studyConfig={{
          components: {
            trialA: { response: [{ id: 'q1', type: 'radio' }] },
          },
        } as never}
        trialId="trialA"
      />,
    );
    expect(html).toContain('Config and Timing');
    expect(html).toContain('q1');
  });
});

describe('ResponseVisualization', () => {
  it('renders metadata visualization blocks', () => {
    const html = renderToStaticMarkup(
      <ResponseVisualization
        response={{ id: 'Config and Timing', type: 'metadata' }}
        participantData={[]}
        trialId="trialA"
        trialConfig={{ id: 'trialA', response: [] } as never}
      />,
    );

    expect(html).toContain('Config and Timing');
    expect(html).toContain('vega-lite');
  });

  it('renders short text response values block', () => {
    const html = renderToStaticMarkup(
      <ResponseVisualization
        response={{ id: 'q1', type: 'shortText' } as never}
        participantData={[{
          answers: {
            trialA_1: {
              startTime: 1,
              endTime: 2,
              answer: { q1: 'hello' },
            },
          },
        } as never]}
        trialId="trialA"
        trialConfig={{ id: 'trialA', response: [], correctAnswer: [] } as never}
      />,
    );

    expect(html).toContain('q1');
    expect(html).toContain('Response Values');
    expect(html).toContain('hello');
  });
});
