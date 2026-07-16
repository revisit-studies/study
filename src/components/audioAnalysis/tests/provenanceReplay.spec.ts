import { describe, expect, test } from 'vitest';
import type { TrrackedProvenance } from '../../../store/types';
import { getReplayNodeId, getReplaySelection, type ProvenanceTraversalEvent } from '../provenanceReplay';

function makeNode(id: string, createdOn: number, children: string[], parent?: string) {
  return {
    id,
    createdOn,
    children,
    parent,
  } as TrrackedProvenance['nodes'][string];
}

function makeGraph(traversalEvents?: ProvenanceTraversalEvent[]) {
  return {
    root: 'root',
    current: 'branch',
    nodes: {
      root: makeNode('root', 1000, ['two']),
      two: makeNode('two', 2000, ['three', 'branch'], 'root'),
      three: makeNode('three', 3000, [], 'two'),
      branch: makeNode('branch', 5000, [], 'two'),
    },
    traversalEvents,
  } as TrrackedProvenance;
}

describe('getReplayNodeId', () => {
  test('replays undo and redo traversal events in chronological order', () => {
    const graph = makeGraph([
      { nodeId: 'root', createdOn: 1000 },
      { nodeId: 'two', createdOn: 2000 },
      { nodeId: 'three', createdOn: 3000 },
      { nodeId: 'two', createdOn: 4000 },
      { nodeId: 'three', createdOn: 4500 },
    ]);

    expect(getReplayNodeId(graph, 1500)).toBe('root');
    expect(getReplayNodeId(graph, 2500)).toBe('two');
    expect(getReplayNodeId(graph, 3500)).toBe('three');
    expect(getReplayNodeId(graph, 4250)).toBe('two');
    expect(getReplayNodeId(graph, 4750)).toBe('three');
    expect(getReplaySelection(graph, 4250)).toEqual({
      nodeId: 'two',
      createdOn: 4000,
      fromTraversal: true,
    });
  });

  test('replays a new branch after undo instead of the abandoned redo state', () => {
    const graph = makeGraph([
      { nodeId: 'root', createdOn: 1000 },
      { nodeId: 'two', createdOn: 2000 },
      { nodeId: 'three', createdOn: 3000 },
      { nodeId: 'two', createdOn: 4000 },
      { nodeId: 'branch', createdOn: 5000 },
    ]);

    expect(getReplayNodeId(graph, 3500)).toBe('three');
    expect(getReplayNodeId(graph, 4500)).toBe('two');
    expect(getReplayNodeId(graph, 5500)).toBe('branch');
  });

  test('falls back to the existing first-child replay for historical graphs', () => {
    const graph = makeGraph();

    expect(getReplayNodeId(graph, 1500, 'three')).toBe('root');
    expect(getReplayNodeId(graph, 2500, 'root')).toBe('two');
    expect(getReplayNodeId(graph, 3500, 'two')).toBe('three');
  });

  test('ignores malformed traversal events', () => {
    const graph = {
      ...makeGraph(),
      traversalEvents: [{ nodeId: 'missing', createdOn: 4000 }],
    } as TrrackedProvenance;

    expect(getReplayNodeId(graph, 3500, 'two')).toBe('three');
  });
});
