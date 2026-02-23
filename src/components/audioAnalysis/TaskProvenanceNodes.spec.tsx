import { renderToStaticMarkup } from 'react-dom/server';
import * as d3 from 'd3';
import { describe, expect, test } from 'vitest';
import { TrrackedProvenance } from '../../store/types';
import { TaskProvenanceNodes } from './TaskProvenanceNodes';
import { getColorForKey } from './provenanceColors';

function getFills(markup: string): string[] {
  return [...markup.matchAll(/fill="([^"]+)"/g)].map((match) => match[1]);
}

function createGraph(nodes: TrrackedProvenance['nodes'], root: string): TrrackedProvenance {
  return {
    current: root,
    root,
    nodes,
  } as TrrackedProvenance;
}

describe('TaskProvenanceNodes', () => {
  test('uses deterministic color per canonical action key regardless of node order', () => {
    const rootNode = {
      id: 'root',
      label: 'Root',
      createdOn: 0,
      artifacts: [],
      meta: { annotation: [], bookmark: [] },
      children: ['n1'],
      state: { type: 'checkpoint', val: {} },
      level: 0,
      event: 'Root',
    } as TrrackedProvenance['nodes'][string];
    const actionNode = {
      id: 'n1',
      label: 'Some label',
      createdOn: 1,
      artifacts: [],
      meta: { annotation: [], bookmark: [] },
      children: [],
      state: { type: 'checkpoint', val: {} },
      level: 1,
      event: 'signal',
      parent: 'root',
      sideEffects: { do: [{ type: 'Signal/SetZoom' }], undo: [] },
    } as TrrackedProvenance['nodes'][string];

    const graphOne = createGraph({ root: rootNode, n1: actionNode }, 'root');
    const graphTwo = createGraph({ n1: actionNode, root: rootNode }, 'root');

    const xScale = d3.scaleLinear([0, 100]).domain([0, 5]);

    const first = renderToStaticMarkup(
      <svg>
        <TaskProvenanceNodes height={25} xScale={xScale} currentNode={null} provenance={graphOne} />
      </svg>,
    );

    const second = renderToStaticMarkup(
      <svg>
        <TaskProvenanceNodes height={25} xScale={xScale} currentNode={null} provenance={graphTwo} />
      </svg>,
    );

    expect(getFills(first).sort()).toEqual(getFills(second).sort());
    expect(getFills(first)).toContain(getColorForKey('signal setzoom'));
  });

  test('active-node overlay uses the same color as its base node', () => {
    const rootNode = {
      id: 'root',
      label: 'Root',
      createdOn: 0,
      artifacts: [],
      meta: { annotation: [], bookmark: [] },
      children: ['n1'],
      state: { type: 'checkpoint', val: {} },
      level: 0,
      event: 'Root',
    } as TrrackedProvenance['nodes'][string];
    const actionNode = {
      id: 'n1',
      label: 'Some label',
      createdOn: 1,
      artifacts: [],
      meta: { annotation: [], bookmark: [] },
      children: [],
      state: { type: 'checkpoint', val: {} },
      level: 1,
      event: 'signal',
      parent: 'root',
      sideEffects: { do: [{ type: 'Signal/SetZoom' }], undo: [] },
    } as TrrackedProvenance['nodes'][string];

    const graph = createGraph({ root: rootNode, n1: actionNode }, 'root');
    const xScale = d3.scaleLinear([0, 100]).domain([0, 5]);
    const markup = renderToStaticMarkup(
      <svg>
        <TaskProvenanceNodes height={25} xScale={xScale} currentNode="n1" provenance={graph} />
      </svg>,
    );

    const actionColor = getColorForKey('signal setzoom');
    const actionColorCount = getFills(markup).filter((fill) => fill === actionColor).length;
    expect(actionColorCount).toBe(2);
  });
});
