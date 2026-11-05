import { describe, expect, test } from 'vitest';
import { initializeTrrack, Registry } from '@trrack/core';
import {
  createGlobalStoreSubmission, getActiveGlobalStoreSubmissions, getGlobalStoreEntryValues, getGlobalStoreNodeState,
} from '../globalStoreProvenance';
import type { GlobalStoreProvenanceState } from '../globalStoreProvenance';
import type { StoredAnswer } from '../types';

function answer(identifier: string, cost: number): StoredAnswer {
  return {
    identifier,
    componentName: 'purchase',
    trialOrder: identifier === 'A' ? '0' : '1',
    answer: { cost },
    startTime: 1,
    endTime: 10,
    incorrectAnswers: {},
    windowEvents: [],
    timedOut: false,
    helpButtonClickedCount: 0,
    parameters: {},
    correctAnswer: [],
    optionOrders: {},
    questionOrders: {},
  };
}

describe('global store submission provenance', () => {
  const definitions = { budget: { initialValue: 100, min: 0 } };
  test('entry snapshots and changed earlier submissions retain the original branch', () => {
    const a = createGlobalStoreSubmission(undefined, definitions, answer('A', 30), { budget: 70 }, [], {});
    const b = createGlobalStoreSubmission(a.graph, definitions, answer('B', 20), { budget: 50 }, [], {});
    expect(getGlobalStoreEntryValues(b.graph, definitions, 'A')).toEqual({ budget: 100 });
    expect(getGlobalStoreEntryValues(b.graph, definitions, 'B')).toEqual({ budget: 70 });
    expect(getGlobalStoreEntryValues(b.graph, definitions, 'C')).toEqual({ budget: 50 });
    const revised = createGlobalStoreSubmission(b.graph, definitions, answer('A', 10), { budget: 90 }, [], {});
    expect(revised.invalidated).toEqual(['B']);
    expect(getActiveGlobalStoreSubmissions(revised.graph).map((entry) => entry.submission.answer.identifier)).toEqual(['A']);
    expect(getGlobalStoreNodeState(revised.graph, a.nodeId).values.budget).toBe(70);
    expect(getGlobalStoreNodeState(revised.graph, b.nodeId).submission?.answer.answer.cost).toBe(20);
    expect(getGlobalStoreNodeState(revised.graph).submission?.replaces).toBe(a.nodeId);
    expect(getGlobalStoreNodeState(b.graph).values.budget).toBe(50);
  });

  test('an unchanged resubmission retains later active progress and records its boundary', () => {
    const a = createGlobalStoreSubmission(undefined, definitions, answer('A', 30), { budget: 70 }, [], {});
    const b = createGlobalStoreSubmission(a.graph, definitions, answer('B', 20), { budget: 50 }, [], {});
    const repeated = createGlobalStoreSubmission(b.graph, definitions, answer('A', 30), { budget: 70 }, [], {});
    expect(repeated.unchanged).toBe(true);
    expect(repeated.invalidated).toEqual([]);
    expect(getActiveGlobalStoreSubmissions(repeated.graph).map((entry) => entry.submission.answer.identifier)).toEqual(['A', 'B']);
    expect(getGlobalStoreNodeState(repeated.graph).values.budget).toBe(50);
    expect(repeated.graph.traversalEvents).toHaveLength(3);
  });

  test('unchanged answers retain the latest accepted stimulus and recording without clearing later progress', () => {
    const stimulus = initializeTrrack({ registry: Registry.create(), initialState: { zoom: 1 } });
    const original = { ...answer('A', 30), assetIdentifier: 'A__global_0' };
    const a = createGlobalStoreSubmission(undefined, definitions, original, { budget: 70 }, [], { stimulus: stimulus.graph.backend });
    const b = createGlobalStoreSubmission(a.graph, definitions, answer('B', 20), { budget: 50 }, [], {});
    stimulus.record({
      label: 'Zoom', state: { zoom: 2 }, eventType: 'zoom', sideEffects: { do: [], undo: [] },
    });
    const revisited = {
      ...original, assetIdentifier: 'A__global_2', startTime: 30, endTime: 40,
    };
    const repeated = createGlobalStoreSubmission(b.graph, definitions, revisited, { budget: 70 }, [], { stimulus: stimulus.graph.backend });
    const active = getActiveGlobalStoreSubmissions(repeated.graph);
    expect(active.map((entry) => entry.submission.answer.identifier)).toEqual(['A', 'B']);
    expect(active[0].submission.answer).toEqual(revisited);
    expect(active[0].submission.sourceNodes.stimulus.current).toBe(stimulus.graph.current.id);
    expect(active[0].values.budget).toBe(70);
    expect(active[1].nodeId).toBe(b.nodeId);
    expect(getGlobalStoreNodeState(repeated.graph).values.budget).toBe(50);
    expect(getGlobalStoreEntryValues(repeated.graph, definitions, 'A').budget).toBe(100);
    expect(getGlobalStoreEntryValues(repeated.graph, definitions, 'B').budget).toBe(70);
    expect(getGlobalStoreEntryValues(repeated.graph, definitions, 'C').budget).toBe(50);
    expect(getGlobalStoreNodeState(repeated.graph, a.nodeId).submission?.answer).toEqual(original);
  });

  test('a new accepted answer records a boundary even without changing global values', () => {
    const initial = createGlobalStoreSubmission(undefined, definitions, answer('A', 0), { budget: 100 }, [], {});
    const next = createGlobalStoreSubmission(initial.graph, definitions, answer('B', 0), { budget: 100 }, [], {});
    expect(getActiveGlobalStoreSubmissions(next.graph)).toHaveLength(2);
    expect(next.graph.traversalEvents).toHaveLength(2);
  });

  test('saved graphs without visit metadata can accept a new unchanged visit', () => {
    const legacy = initializeTrrack<GlobalStoreProvenanceState, string>({
      registry: Registry.create(), initialState: { values: { budget: 100 }, submission: null },
    });
    [answer('A', 30), answer('B', 20)].forEach((saved, index) => legacy.record({
      label: 'Submit trial',
      eventType: 'global-store-submit',
      sideEffects: { do: [], undo: [] },
      state: {
        values: { budget: index === 0 ? 70 : 50 },
        submission: {
          answer: saved, sourceNodes: {}, operations: [], replaces: null, invalidated: [],
        },
      },
    }));
    const revisited = { ...answer('A', 30), assetIdentifier: 'A__global_2' };
    const resumed = createGlobalStoreSubmission(legacy.exportObject(), definitions, revisited, { budget: 70 }, [], {});
    expect(getActiveGlobalStoreSubmissions(resumed.graph).map((entry) => entry.submission.answer)).toEqual([revisited, answer('B', 20)]);
    expect(getGlobalStoreEntryValues(resumed.graph, definitions, 'A').budget).toBe(100);
    expect(getGlobalStoreEntryValues(resumed.graph, definitions, 'B').budget).toBe(70);
    expect(getGlobalStoreNodeState(resumed.graph).values.budget).toBe(50);
  });
});
