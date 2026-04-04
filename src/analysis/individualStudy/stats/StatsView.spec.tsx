import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import { useParams } from 'react-router';
import { IndividualComponent, StudyConfig } from '../../../parser/types';
import { ParticipantData } from '../../../storage/types';
import { studyComponentToIndividualComponent } from '../../../utils/handleComponentInheritance';
import { StatsView } from './StatsView';
import { TrialVisualization } from './TrialVisualization';
import { ResponseVisualization } from './ResponseVisualization';

// ── mocks ────────────────────────────────────────────────────────────────────

vi.mock('react-router', () => ({
  useParams: vi.fn(() => ({})),
}));

vi.mock('@mantine/hooks', () => ({
  useDisclosure: () => [true, { toggle: vi.fn() }],
  useResizeObserver: () => [{ current: null }, { width: 800, height: 400 }],
}));

vi.mock('react-vega', () => ({
  VegaLite: () => <div>VegaLite</div>,
}));

vi.mock('@mantine/core', () => ({
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Divider: () => <hr />,
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Paper: ({ children, ref: _ref }: { children: ReactNode; ref?: unknown }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Title: ({ children }: { children: ReactNode }) => <h5>{children}</h5>,
  Collapse: ({ children, in: open }: { children: ReactNode; in?: boolean }) => (
    open ? <div>{children}</div> : null
  ),
  Code: ({ children }: { children: ReactNode }) => <code>{children}</code>,
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SimpleGrid: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconAdjustmentsHorizontal: () => <span>icon-slider</span>,
  IconBubbleText: () => <span>icon-text</span>,
  IconChartGridDots: () => <span>icon-matrix-cb</span>,
  IconChevronDown: () => <span>icon-chevron</span>,
  IconCodePlus: () => <span>icon-metadata</span>,
  IconCopyCheck: () => <span>icon-buttons</span>,
  IconDots: () => <span>icon-likert</span>,
  IconDragDrop: () => <span>icon-ranking</span>,
  IconGridDots: () => <span>icon-matrix-r</span>,
  IconHtml: () => <span>icon-reactive</span>,
  IconLetterCase: () => <span>icon-textOnly</span>,
  IconNumber123: () => <span>icon-numerical</span>,
  IconRadio: () => <span>icon-radio</span>,
  IconSelect: () => <span>icon-dropdown</span>,
  IconSquares: () => <span>icon-checkbox</span>,
}));

vi.mock('../../../components/interface/StepsPanel', () => ({
  StepsPanel: () => <div>StepsPanel</div>,
}));

vi.mock('../summary/OverviewStats', () => ({
  OverviewStats: () => <div>OverviewStats</div>,
}));

vi.mock('../summary/utils', () => ({
  getOverviewStats: vi.fn(() => ({
    participantCounts: {
      total: 5, completed: 3, inProgress: 1, rejected: 1,
    },
    startDate: null,
    endDate: null,
    avgTime: NaN,
    avgCleanTime: NaN,
    participantsWithInvalidCleanTimeCount: 0,
    correctness: NaN,
  })),
}));

vi.mock('../../../utils/handleComponentInheritance', () => ({
  studyComponentToIndividualComponent: vi.fn(() => ({
    type: 'questionnaire',
    response: [],
    correctAnswer: undefined,
  })),
}));

// ── fixtures ─────────────────────────────────────────────────────────────────

const emptyConfig: StudyConfig = {
  components: { trial1: { type: 'questionnaire', response: [] } as unknown as StudyConfig['components'][string] },
  sequence: { order: 'fixed', components: ['trial1'] } as unknown as StudyConfig['sequence'],
} as unknown as StudyConfig;

const mockParticipant = {
  participantId: 'p1', answers: {}, completed: true, rejected: false,
} as unknown as ParticipantData;

const mockTrialConfig = {
  type: 'questionnaire',
  response: [],
  correctAnswer: undefined,
} as unknown as IndividualComponent;

// ── StatsView ─────────────────────────────────────────────────────────────────

describe('StatsView', () => {
  beforeEach(() => {
    vi.mocked(useParams).mockReturnValue({});
  });

  test('shows "No data available" when visibleParticipants is empty', () => {
    const html = renderToStaticMarkup(
      <StatsView studyConfig={emptyConfig} visibleParticipants={[]} />,
    );
    expect(html).toContain('No data available.');
  });

  test('shows StepsPanel and TrialVisualization when participants exist', () => {
    const html = renderToStaticMarkup(
      <StatsView studyConfig={emptyConfig} visibleParticipants={[mockParticipant]} />,
    );
    expect(html).toContain('StepsPanel');
  });

  test('shows OverviewStats when trialId is set and not "end"', () => {
    vi.mocked(useParams).mockReturnValue({ trialId: 'trial1' });
    const html = renderToStaticMarkup(
      <StatsView studyConfig={emptyConfig} visibleParticipants={[mockParticipant]} studyId="my-study" />,
    );
    expect(html).toContain('OverviewStats');
  });

  test('no OverviewStats when trialId is undefined', () => {
    vi.mocked(useParams).mockReturnValue({});
    const html = renderToStaticMarkup(
      <StatsView studyConfig={emptyConfig} visibleParticipants={[mockParticipant]} />,
    );
    expect(html).not.toContain('OverviewStats');
  });

  test('no OverviewStats when trialId is "end"', () => {
    vi.mocked(useParams).mockReturnValue({ trialId: 'end' });
    const html = renderToStaticMarkup(
      <StatsView studyConfig={emptyConfig} visibleParticipants={[mockParticipant]} />,
    );
    expect(html).not.toContain('OverviewStats');
  });
});

// ── TrialVisualization ───────────────────────────────────────────────────────

describe('TrialVisualization', () => {
  test('shows "No trial selected" when trialId is undefined', () => {
    const html = renderToStaticMarkup(
      <TrialVisualization participantData={[]} studyConfig={emptyConfig} />,
    );
    expect(html).toContain('No trial selected');
  });

  test('shows end-component message when trialId is "end"', () => {
    const html = renderToStaticMarkup(
      <TrialVisualization participantData={[]} studyConfig={emptyConfig} trialId="end" />,
    );
    expect(html).toContain('The end component has no data.');
  });

  test('renders ResponseVisualization items when trialId matches a component', () => {
    vi.mocked(studyComponentToIndividualComponent).mockReturnValue({
      type: 'questionnaire',
      response: [{ type: 'radio', id: 'q1', prompt: 'Pick one' } as IndividualComponent['response'][number]],
      correctAnswer: undefined,
    } as unknown as IndividualComponent);

    const html = renderToStaticMarkup(
      <TrialVisualization participantData={[]} studyConfig={emptyConfig} trialId="trial1" />,
    );
    // Config and Timing metadata block + q1 response block
    expect(html).toContain('Config and Timing');
    expect(html).toContain('q1');
  });
});

// ── ResponseVisualization ────────────────────────────────────────────────────

describe('ResponseVisualization', () => {
  const baseProps = {
    participantData: [] as ParticipantData[],
    trialId: 'trial1',
    trialConfig: mockTrialConfig,
  };

  test('metadata type: shows icon and config JSON code block', () => {
    const html = renderToStaticMarkup(
      <ResponseVisualization
        {...baseProps}
        response={{ id: 'Config and Timing', type: 'metadata' }}
      />,
    );
    expect(html).toContain('icon-metadata');
    expect(html).toContain('Config and Timing');
    // JSON of trialConfig rendered in Code block (quotes are HTML-entity encoded)
    expect(html).toContain('questionnaire');
  });

  test('metadata type: renders VegaLite timing histogram in right panel', () => {
    const html = renderToStaticMarkup(
      <ResponseVisualization
        {...baseProps}
        response={{ id: 'Config and Timing', type: 'metadata' }}
      />,
    );
    expect(html).toContain('VegaLite');
  });

  test('shortText type: shows text icon and Response Values section', () => {
    const html = renderToStaticMarkup(
      <ResponseVisualization
        {...baseProps}
        response={{ type: 'shortText', id: 'q1', prompt: 'Enter text' } as unknown as Parameters<typeof ResponseVisualization>[0]['response']}
      />,
    );
    expect(html).toContain('icon-text');
    expect(html).toContain('Response Values');
  });

  test('textOnly type: shows N/A for response values', () => {
    const html = renderToStaticMarkup(
      <ResponseVisualization
        {...baseProps}
        response={{ type: 'textOnly', id: 'q1', prompt: '' } as unknown as Parameters<typeof ResponseVisualization>[0]['response']}
      />,
    );
    expect(html).toContain('N/A');
  });

  test('radio type: shows radio icon and VegaLite chart', () => {
    const html = renderToStaticMarkup(
      <ResponseVisualization
        {...baseProps}
        response={{
          type: 'radio', id: 'q1', prompt: 'Pick one', options: ['A', 'B'],
        } as unknown as Parameters<typeof ResponseVisualization>[0]['response']}
      />,
    );
    expect(html).toContain('icon-radio');
    expect(html).toContain('VegaLite');
  });

  test('numerical type: shows numerical icon and VegaLite chart', () => {
    const html = renderToStaticMarkup(
      <ResponseVisualization
        {...baseProps}
        response={{ type: 'numerical', id: 'q1', prompt: 'Enter number' } as unknown as Parameters<typeof ResponseVisualization>[0]['response']}
      />,
    );
    expect(html).toContain('icon-numerical');
    expect(html).toContain('VegaLite');
  });

  test('slider type: shows slider icon and VegaLite chart', () => {
    const html = renderToStaticMarkup(
      <ResponseVisualization
        {...baseProps}
        response={{
          type: 'slider', id: 'q1', prompt: 'Rate', options: [{ label: 'Lo', value: 0 }, { label: 'Hi', value: 100 }],
        } as unknown as Parameters<typeof ResponseVisualization>[0]['response']}
      />,
    );
    expect(html).toContain('icon-slider');
    expect(html).toContain('VegaLite');
  });

  test('likert type: shows likert icon and VegaLite chart', () => {
    const html = renderToStaticMarkup(
      <ResponseVisualization
        {...baseProps}
        response={{
          type: 'likert', id: 'q1', prompt: 'Rate', numItems: 5,
        } as unknown as Parameters<typeof ResponseVisualization>[0]['response']}
      />,
    );
    expect(html).toContain('icon-likert');
    expect(html).toContain('VegaLite');
  });

  test('matrix-radio type: shows matrix icon and VegaLite chart', () => {
    const html = renderToStaticMarkup(
      <ResponseVisualization
        {...baseProps}
        response={{
          type: 'matrix-radio', id: 'q1', prompt: 'Matrix', questionOptions: ['Q1'], answerOptions: ['A', 'B'],
        } as unknown as Parameters<typeof ResponseVisualization>[0]['response']}
      />,
    );
    expect(html).toContain('icon-matrix-r');
    expect(html).toContain('VegaLite');
  });

  test('matrix-checkbox type: shows matrix-cb icon and VegaLite chart', () => {
    const html = renderToStaticMarkup(
      <ResponseVisualization
        {...baseProps}
        response={{
          type: 'matrix-checkbox', id: 'q1', prompt: 'Matrix', questionOptions: ['Q1'], answerOptions: ['A', 'B'],
        } as unknown as Parameters<typeof ResponseVisualization>[0]['response']}
      />,
    );
    expect(html).toContain('icon-matrix-cb');
    expect(html).toContain('VegaLite');
  });

  test('shows Response Specification JSON for non-metadata types', () => {
    const html = renderToStaticMarkup(
      <ResponseVisualization
        {...baseProps}
        response={{
          type: 'radio', id: 'q1', prompt: 'Pick one', options: ['A'],
        } as unknown as Parameters<typeof ResponseVisualization>[0]['response']}
      />,
    );
    expect(html).toContain('Response Specification');
  });

  test('shows Correct Answer block when trialConfig has a matching correctAnswer', () => {
    const trialConfigWithAnswer = {
      ...mockTrialConfig,
      correctAnswer: [{ id: 'q1', answer: 'A' }],
    } as unknown as IndividualComponent;

    const html = renderToStaticMarkup(
      <ResponseVisualization
        participantData={[]}
        trialId="trial1"
        trialConfig={trialConfigWithAnswer}
        response={{
          type: 'radio', id: 'q1', prompt: 'Pick one', options: ['A', 'B'],
        } as unknown as Parameters<typeof ResponseVisualization>[0]['response']}
      />,
    );
    expect(html).toContain('Correct Answer');
  });
});
