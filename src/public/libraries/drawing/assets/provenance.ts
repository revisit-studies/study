import { Registry } from '@trrack/core';
import type { Trrack } from '@trrack/core';
import { getProvenanceTraversalEvents } from '../../../../store/provenance';
import type { TrrackedProvenance } from '../../../../store/types';
import isEqual from 'lodash.isequal';
import {
  DrawingParameters, DrawingScene, DrawingState, DrawingTool, emptyDrawing,
} from './types';

/** The host's managed useTrrack hook publishes the resulting graph. */
export function drawingProvenance(parameters: DrawingParameters) {
  const registry = Registry.create();
  const scene = registry.register('drawing', (state: DrawingState, value: DrawingScene | null) => {
    state.state = value;
    return state;
  });
  const tool = registry.register('tool', (state: DrawingState, value: DrawingTool) => {
    state.tool = value;
    return state;
  });
  const color = registry.register('color', (state: DrawingState, value: string) => {
    state.color = value;
    return state;
  });
  const penSize = registry.register('penSize', (state: DrawingState, value: string) => {
    state.penSize = value;
    return state;
  });
  const initialState: DrawingState = {
    state: parameters.initialDrawing ?? null,
    tool: 'pen',
    color: parameters.initialColor ?? 'red',
    penSize: parameters.initialPenSize ?? 'm',
  };
  return {
    registry,
    initialState,
    actions: {
      scene, tool, color, penSize,
    },
  };
}

/** One undo entry per completed gesture, independent of replay sampling. */
export function drawingHistory(initial: DrawingScene) {
  let current = initial;
  const past: DrawingScene[] = [];
  const future: DrawingScene[] = [];
  return {
    commit(next: DrawingScene) {
      if (isEqual(current.elements, next.elements)) return;
      past.push(current);
      current = next;
      future.length = 0;
    },
    undo() {
      const previous = past.pop();
      if (!previous) return undefined;
      future.push(current);
      current = previous;
      return current;
    },
    redo() {
      const next = future.pop();
      if (!next) return undefined;
      past.push(current);
      current = next;
      return current;
    },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
  };
}

/** Rebuild gesture undo/redo from recorded actions rather than starting a new history on return. */
export function resumedDrawingHistory(trrack: Trrack<DrawingState, string>) {
  const graph = trrack.graph.backend as TrrackedProvenance;
  const history = drawingHistory(trrack.getState(trrack.root).state ?? emptyDrawing());
  let nodeIds = getProvenanceTraversalEvents(graph).map((event) => event.nodeId);
  if (!nodeIds.length) {
    nodeIds = [];
    let node = trrack.current;
    while ('parent' in node) {
      nodeIds.unshift(node.id);
      node = graph.nodes[node.parent];
    }
  }
  nodeIds.forEach((id) => {
    const node = graph.nodes[id];
    if (node.label === 'drawEnd' || node.label === 'clearing') {
      history.commit(trrack.getState(node).state ?? emptyDrawing());
    } else if (node.label === 'undo') {
      history.undo();
    } else if (node.label === 'redo') {
      history.redo();
    }
  });
  return history;
}
