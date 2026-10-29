import { describe, expect, test } from 'vitest';
import { initializeTrrack } from '@trrack/core';
import { drawingHistory, drawingProvenance } from '../provenance';
import { emptyDrawing } from '../types';
import { sceneWithStroke } from './fixtures';

describe('drawing provenance', () => {
  test('records settings, intermediate states, clearing and scene restoration', () => {
    const definition = drawingProvenance({});
    const trrack = initializeTrrack({ registry: definition.registry, initialState: definition.initialState });
    const scene = sceneWithStroke();
    trrack.apply('drawing', definition.actions.scene(scene));
    const drawnNode = trrack.current;
    trrack.apply('Change Color', definition.actions.color('blue'));
    trrack.apply('Set Tool', definition.actions.tool('eraser'));
    trrack.apply('Change Pen Size', definition.actions.penSize('xl'));
    trrack.apply('clearing', definition.actions.scene(emptyDrawing()));
    expect(trrack.getState().state).toEqual(emptyDrawing());
    trrack.apply('undo', definition.actions.scene(scene));
    expect(trrack.getState()).toMatchObject({
      state: scene, tool: 'eraser', color: 'blue', penSize: 'xl',
    });
    expect(trrack.getState(drawnNode)).toMatchObject({
      state: scene, tool: 'pen', color: 'red', penSize: 'm',
    });
  });

  test('uses configurable initial state without sharing scenes between trials', () => {
    const scene = sceneWithStroke();
    expect(drawingProvenance({ initialDrawing: scene, initialColor: 'blue', initialPenSize: 'l' }).initialState).toMatchObject({ state: scene, color: 'blue', penSize: 'l' });
    expect(drawingProvenance({}).initialState.state).toBeNull();
  });
});

describe('gesture history', () => {
  test('undoes one gesture, supports redo, clear, and a new branch', () => {
    const empty = emptyDrawing();
    const first = sceneWithStroke('first');
    const next = sceneWithStroke('next');
    const history = drawingHistory(empty);
    expect(history.undo()).toBeUndefined();
    history.commit(first);
    history.commit(first);
    history.commit(empty);
    expect(history.undo()).toEqual(first);
    expect(history.undo()).toEqual(empty);
    expect(history.canUndo).toBe(false);
    expect(history.redo()).toEqual(first);
    history.commit(next);
    expect(history.canRedo).toBe(false);
    expect(history.redo()).toBeUndefined();
    expect(history.undo()).toEqual(first);
  });
});
