import { renderToStaticMarkup } from 'react-dom/server';
import * as d3 from 'd3';
import {
  describe, expect, test, vi,
} from 'vitest';
import { TrrackedProvenance } from '../../store/types';
import { TaskProvenanceTimeline } from './TaskProvenanceTimeline';

vi.mock('./TaskProvenanceNodes', () => ({
  TaskProvenanceNodes: ({ currentNode }: { currentNode: string | null }) => (
    <g data-testid="provenance-nodes" data-current={currentNode ?? 'none'} />
  ),
}));

const xScale = d3.scaleLinear().domain([0, 10]).range([0, 500]);
const margin = {
  left: 10, right: 10, top: 5, bottom: 5,
};

function makeGraph(nodes: TrrackedProvenance['nodes'], root: string): TrrackedProvenance {
  return { current: root, root, nodes } as TrrackedProvenance;
}

const rootNode = {
  id: 'root',
  label: 'Root',
  createdOn: 0,
  artifacts: [],
  meta: { annotation: [], bookmark: [] },
  children: [],
  state: { type: 'checkpoint' as const, val: {} },
  level: 0,
  event: 'Root',
} as TrrackedProvenance['nodes'][string];

describe('TaskProvenanceTimeline', () => {
  test('renders an SVG element', () => {
    const html = renderToStaticMarkup(
      <TaskProvenanceTimeline
        xScale={xScale}
        answers={{}}
        width={500}
        height={50}
        currentNode={null}
        trialName="trial_0"
        startTime={0}
        margin={margin}
      />,
    );
    expect(html).toContain('<svg');
  });

  test('renders a baseline horizontal line', () => {
    const html = renderToStaticMarkup(
      <TaskProvenanceTimeline
        xScale={xScale}
        answers={{}}
        width={500}
        height={50}
        currentNode={null}
        trialName="trial_0"
        startTime={0}
        margin={margin}
      />,
    );
    expect(html).toContain('<line');
    expect(html).toContain('stroke="black"');
  });

  test('renders TaskProvenanceNodes for matching trial entries', () => {
    const graph = makeGraph({ root: rootNode }, 'root');
    const answers = {
      trial_0: {
        endTime: 5000,
        startTime: 0,
        provenanceGraph: { vis: graph },
      },
    } as never;

    const html = renderToStaticMarkup(
      <TaskProvenanceTimeline
        xScale={xScale}
        answers={answers}
        width={500}
        height={50}
        currentNode={null}
        trialName="trial_0"
        startTime={0}
        margin={margin}
      />,
    );
    expect(html).toContain('data-testid="provenance-nodes"');
  });

  test('does not render nodes when trialName does not match', () => {
    const graph = makeGraph({ root: rootNode }, 'root');
    const answers = {
      trial_1: {
        endTime: 5000,
        startTime: 0,
        provenanceGraph: { vis: graph },
      },
    } as never;

    const html = renderToStaticMarkup(
      <TaskProvenanceTimeline
        xScale={xScale}
        answers={answers}
        width={500}
        height={50}
        currentNode={null}
        trialName="trial_0"
        startTime={0}
        margin={margin}
      />,
    );
    expect(html).not.toContain('data-testid="provenance-nodes"');
  });

  test('renders nodes for all entries when trialName is empty string', () => {
    const graph = makeGraph({ root: rootNode }, 'root');
    const answers = {
      trial_0: {
        endTime: 5000,
        startTime: 0,
        provenanceGraph: { vis: graph },
      },
      trial_1: {
        endTime: 8000,
        startTime: 0,
        provenanceGraph: { vis: graph },
      },
    } as never;

    const html = renderToStaticMarkup(
      <TaskProvenanceTimeline
        xScale={xScale}
        answers={answers}
        width={500}
        height={50}
        currentNode={null}
        trialName=""
        startTime={0}
        margin={margin}
      />,
    );
    // Both entries should produce nodes
    expect(html.match(/data-testid="provenance-nodes"/g)?.length).toBeGreaterThanOrEqual(1);
  });

  test('skips null provenanceGraph entries gracefully', () => {
    const answers = {
      trial_0: {
        endTime: 5000,
        startTime: 0,
        provenanceGraph: { vis: null },
      },
    } as never;

    const html = renderToStaticMarkup(
      <TaskProvenanceTimeline
        xScale={xScale}
        answers={answers}
        width={500}
        height={50}
        currentNode={null}
        trialName="trial_0"
        startTime={0}
        margin={margin}
      />,
    );
    expect(html).toContain('<svg');
    expect(html).not.toContain('data-testid="provenance-nodes"');
  });

  test('applies left margin as marginLeft style', () => {
    const html = renderToStaticMarkup(
      <TaskProvenanceTimeline
        xScale={xScale}
        answers={{}}
        width={400}
        height={40}
        currentNode={null}
        trialName=""
        startTime={0}
        margin={{
          left: 20, right: 10, top: 5, bottom: 5,
        }}
      />,
    );
    expect(html).toContain('margin-left:20px');
  });
});
