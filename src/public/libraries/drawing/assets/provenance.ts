import { Registry } from '@trrack/core';
import isEqual from 'lodash.isequal';
import {
  DrawingParameters, DrawingScene, DrawingState, DrawingTool,
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
