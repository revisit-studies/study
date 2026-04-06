import { renderHook, act } from '@testing-library/react';
import {
  describe, expect, test, vi, beforeEach,
} from 'vitest';
import { useUpdateProvenance } from './useUpdateProvenance';

// ── mocks ─────────────────────────────────────────────────────────────────────

const mockImportObject = vi.fn();
const mockGetState = vi.fn(() => ({ state: 'mocked' }));

vi.mock('@trrack/core', () => {
  const Registry = { create: vi.fn(() => ({})) };
  const initializeTrrack = vi.fn(() => ({
    importObject: mockImportObject,
    getState: mockGetState,
  }));
  const isRootNode = vi.fn((node: { parent?: unknown }) => !node.parent);
  return { Registry, initializeTrrack, isRootNode };
});

// ── helpers ───────────────────────────────────────────────────────────────────

function makeNode(id: string, parent?: string, createdOn = 0, children: string[] = []) {
  return {
    id,
    parent,
    createdOn,
    children,
    label: id,
    artifacts: [],
    meta: { annotation: [], bookmark: [] },
    state: { type: 'checkpoint' as const, val: {} },
    level: 0,
    event: parent ? 'action' : 'Root',
    sideEffects: { do: [], undo: [] },
  };
}

function makeGraph(nodes: Record<string, ReturnType<typeof makeNode>>, root: string) {
  return { nodes, root, current: root } as never;
}

describe('useUpdateProvenance', () => {
  const setCurrentNode = vi.fn();
  const saveProvenance = vi.fn();

  beforeEach(() => {
    setCurrentNode.mockReset();
    saveProvenance.mockReset();
    mockGetState.mockReturnValue({ state: 'mocked' });
  });

  test('does nothing when saveProvenance is not provided', () => {
    const graph = makeGraph({ root: makeNode('root') }, 'root');
    renderHook(() => useUpdateProvenance('sidebar', 0, graph, 'root', setCurrentNode, undefined));
    expect(setCurrentNode).not.toHaveBeenCalled();
  });

  test('clears node when provGraph is undefined and currentNode was set', () => {
    renderHook(() => useUpdateProvenance('sidebar', 0, undefined, 'root', setCurrentNode, saveProvenance));
    expect(setCurrentNode).toHaveBeenCalledWith(null, 'sidebar');
    expect(saveProvenance).toHaveBeenCalledWith({ prov: null, location: 'sidebar' });
  });

  test('does not clear node when provGraph is undefined and currentNode is undefined', () => {
    renderHook(() => useUpdateProvenance('sidebar', 0, undefined, undefined, setCurrentNode, saveProvenance));
    expect(setCurrentNode).not.toHaveBeenCalled();
  });

  test('sets root node when currentNode is not set and graph exists', () => {
    const rootNode = makeNode('root');
    const graph = makeGraph({ root: rootNode }, 'root');
    renderHook(() => useUpdateProvenance('sidebar', 0, graph, undefined, setCurrentNode, saveProvenance));
    expect(setCurrentNode).toHaveBeenCalledWith('root', 'sidebar');
  });

  test('does not change node when currentNode matches play time', () => {
    const rootNode = makeNode('root', undefined, 0, ['n1']);
    const childNode = makeNode('n1', 'root', 5000, []);
    const graph = makeGraph({ root: rootNode, n1: childNode }, 'root');
    // playTime=2500 is after root (0) but before child (5000)
    renderHook(() => useUpdateProvenance('sidebar', 2500, graph, 'root', setCurrentNode, saveProvenance));
    // currentNode 'root' matches the computed node so no update
    expect(setCurrentNode).not.toHaveBeenCalled();
  });

  test('advances to child node when playTime passes child createdOn', () => {
    const rootNode = makeNode('root', undefined, 0, ['n1']);
    const childNode = makeNode('n1', 'root', 2000, []);
    const graph = makeGraph({ root: rootNode, n1: childNode }, 'root');
    // playTime=3000 > child.createdOn=2000, so should advance to n1
    renderHook(() => useUpdateProvenance('sidebar', 3000, graph, 'root', setCurrentNode, saveProvenance));
    expect(setCurrentNode).toHaveBeenCalledWith('n1', 'sidebar');
  });

  test('retreats to parent when playTime is before current node createdOn', () => {
    const rootNode = makeNode('root', undefined, 0, ['n1']);
    const childNode = makeNode('n1', 'root', 5000, []);
    const graph = makeGraph({ root: rootNode, n1: childNode }, 'root');
    // playTime=1000 < child.createdOn=5000, should retreat to root
    renderHook(() => useUpdateProvenance('sidebar', 1000, graph, 'n1', setCurrentNode, saveProvenance));
    expect(setCurrentNode).toHaveBeenCalledWith('root', 'sidebar');
  });

  test('reacts to prop changes via re-render', async () => {
    const rootNode = makeNode('root', undefined, 0, ['n1']);
    const childNode = makeNode('n1', 'root', 2000, []);
    const graph = makeGraph({ root: rootNode, n1: childNode }, 'root');

    const { rerender } = renderHook(
      ({ playTime }: { playTime: number }) => useUpdateProvenance('sidebar', playTime, graph, 'root', setCurrentNode, saveProvenance),
      { initialProps: { playTime: 0 } },
    );

    await act(async () => { rerender({ playTime: 3000 }); });
    expect(setCurrentNode).toHaveBeenCalledWith('n1', 'sidebar');
  });
});
