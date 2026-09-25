import { renderToStaticMarkup } from 'react-dom/server';
import * as d3 from 'd3';
import { describe, expect, test } from 'vitest';
import { TrrackedProvenance } from '../../../store/types';
import { TaskProvenanceNodes } from '../TaskProvenanceNodes';
import { ROOT_COLOR, getColorForKey } from '../provenanceColors';
import { FACE_BUTTON_COLORS, gamepadPressActionType } from '../../../utils/gamepadButtons';

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

describe('TaskProvenanceNodes with gamepad provenance', () => {
  function node(id: string, actionType: string, createdOn: number): TrrackedProvenance['nodes'][string] {
    return {
      id,
      label: actionType,
      createdOn,
      artifacts: [],
      meta: { annotation: [], bookmark: [] },
      children: [],
      state: { type: 'checkpoint', val: {} },
      level: 1,
      event: 'gamepad',
      parent: 'root',
      sideEffects: { do: [{ type: actionType }], undo: [] },
    } as TrrackedProvenance['nodes'][string];
  }

  // The action-type sequence recorded from an actual playthrough of the
  // demo-gamepad study: a target spawns, a wrong button misses, the right one hits.
  const RECORDED_SEQUENCE = [
    'gamepad-spawn-target',
    gamepadPressActionType('A'),
    gamepadPressActionType('X'),
    'gamepad-spawn-target',
    gamepadPressActionType('Y'),
    'gamepad-spawn-target',
    gamepadPressActionType('B'),
  ];

  function renderRecordedTimeline() {
    const rootNode = {
      id: 'root',
      label: 'Root',
      createdOn: 0,
      artifacts: [],
      meta: { annotation: [], bookmark: [] },
      children: [],
      state: { type: 'checkpoint', val: {} },
      level: 0,
      event: 'Root',
    } as TrrackedProvenance['nodes'][string];

    const nodes: TrrackedProvenance['nodes'] = { root: rootNode };
    RECORDED_SEQUENCE.forEach((actionType, index) => {
      nodes[`n${index}`] = node(`n${index}`, actionType, index + 1);
    });

    const xScale = d3.scaleLinear([0, 100]).domain([0, RECORDED_SEQUENCE.length + 1]);
    return renderToStaticMarkup(
      <svg>
        <TaskProvenanceNodes height={25} xScale={xScale} currentNode={null} provenance={createGraph(nodes, 'root')} />
      </svg>,
    );
  }

  test('paints each press in the color of the button that produced it', () => {
    const fills = getFills(renderRecordedTimeline());

    expect(fills).toEqual([
      ROOT_COLOR,
      getColorForKey('gamepad spawn target'),
      FACE_BUTTON_COLORS.A,
      FACE_BUTTON_COLORS.X,
      getColorForKey('gamepad spawn target'),
      FACE_BUTTON_COLORS.Y,
      getColorForKey('gamepad spawn target'),
      FACE_BUTTON_COLORS.B,
    ]);
  });

  test('non-press gamepad actions keep a hashed color, distinct from every button', () => {
    const spawnColor = getColorForKey('gamepad spawn target');
    expect(spawnColor).toMatch(/^hsl\(/);
    expect(Object.values(FACE_BUTTON_COLORS)).not.toContain(spawnColor);
  });

  test('the same button is always the same color across a session', () => {
    const first = getFills(renderRecordedTimeline());
    const second = getFills(renderRecordedTimeline());
    expect(first).toEqual(second);
  });
});
