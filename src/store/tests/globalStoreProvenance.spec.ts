import { describe, expect, test } from 'vitest';
import {
  createGlobalStoreSubmission, getActiveGlobalStoreSubmissions, getGlobalStoreEntryValues, getGlobalStoreNodeState,
} from '../globalStoreProvenance';
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
    expect(repeated.graph.current).toBe(b.graph.current);
    expect(getGlobalStoreNodeState(repeated.graph).values.budget).toBe(50);
    expect(repeated.graph.traversalEvents).toHaveLength(3);
  });

  test('a new accepted answer records a boundary even without changing global values', () => {
    const initial = createGlobalStoreSubmission(undefined, definitions, answer('A', 0), { budget: 100 }, [], {});
    const next = createGlobalStoreSubmission(initial.graph, definitions, answer('B', 0), { budget: 100 }, [], {});
    expect(getActiveGlobalStoreSubmissions(next.graph)).toHaveLength(2);
    expect(next.graph.traversalEvents).toHaveLength(2);
  });
});
