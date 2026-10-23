import { initializeTrrack, Registry } from '@trrack/core';
import {
  describe, expect, test, vi,
} from 'vitest';
import { initializeResumedTrrack } from '../resumeProvenance';
import { appendProvenanceTraversalEvent } from '../provenance';
import type { TrrackedProvenance } from '../types';

function setup() {
  const registry = Registry.create();
  const increment = registry.register('increment', (state: { count: number }, _payload: number) => { state.count += 1; return state; });
  return { options: { registry, initialState: { count: 0 } }, increment };
}

describe('resume provenance', () => {
  test('restores the selected node, branches, timestamps and traversal events before appending', async () => {
    const { options, increment } = setup();
    const original = initializeTrrack(options);
    let retained = appendProvenanceTraversalEvent(undefined, original.graph.backend, 100);
    original.currentChange(() => {
      retained = appendProvenanceTraversalEvent(retained, original.graph.backend, Date.now());
    });
    await original.apply('First visit', increment(1));
    await original.undo();
    await original.apply('Branch', increment(1));
    await original.undo();
    const snapshot = structuredClone(retained);
    const resumed = initializeResumedTrrack(options, retained);
    expect(resumed.getState()).toEqual({ count: 0 });
    expect(resumed.current.id).toBe(snapshot.current);
    expect(resumed.graph.backend).toEqual(snapshot);
    expect(retained).toEqual(snapshot);
    resumed.currentChange(() => {
      retained = appendProvenanceTraversalEvent(retained, resumed.graph.backend, Date.now());
    });
    await resumed.apply('Second visit', increment(1));
    Object.entries(snapshot.nodes).forEach(([id, node]) => {
      expect(retained.nodes[id]).toMatchObject({ id, createdOn: node.createdOn, state: node.state });
    });
    expect(retained.traversalEvents?.slice(0, snapshot.traversalEvents!.length)).toEqual(snapshot.traversalEvents);
    expect(resumed.getState()).toEqual({ count: 1 });
  });

  test('does not rerun recorded side effects while restoring', async () => {
    const registry = Registry.create();
    const effect = vi.fn();
    const sideEffect = registry.register('effect', effect);
    const original = initializeTrrack({ registry, initialState: { count: 1 } });
    // A saved side effect need not be registered in the new graph reader at all.
    original.record({
      label: 'Recorded effect', state: { count: 1 }, eventType: 'effect', sideEffects: { do: [sideEffect(undefined)], undo: [] },
    });
    const resumed = initializeResumedTrrack({ registry: Registry.create(), initialState: {} }, original.graph.backend);
    expect(resumed.current.id).toBe(original.current.id);
    expect(effect).not.toHaveBeenCalled();
  });

  test('rejects invalid history rather than initializing over it', () => {
    const { options } = setup();
    expect(() => initializeResumedTrrack(options, { root: 'missing', current: 'missing', nodes: {} } as TrrackedProvenance)).toThrow('invalid');
    expect(initializeResumedTrrack(options).getState()).toEqual({ count: 0 });
  });
});
