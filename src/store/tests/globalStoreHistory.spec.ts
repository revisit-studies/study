import { expect, test } from 'vitest';
import { makeStoredAnswer } from '../../tests/utils';
import { createGlobalStoreSubmission, getGlobalStoreEntryValues } from '../globalStoreProvenance';
import { getGlobalStoreHistory, projectHistoricalGlobalStore } from '../globalStoreHistory';

const definitions = { budget: { initialValue: 100 } };
const answer = (identifier: string, trialOrder: string, cost: number) => makeStoredAnswer({
  identifier, trialOrder, componentName: 'purchase', answer: { cost }, endTime: 20,
});

test('historical replay retains each recording and the latest unchanged visit through a later edit', () => {
  const originalA = { ...answer('A', '0', 30), assetIdentifier: 'A__global_0' };
  const originalB = { ...answer('B', '1', 20), assetIdentifier: 'B__global_1' };
  const a = createGlobalStoreSubmission(undefined, definitions, originalA, { budget: 70 }, [], {});
  const b = createGlobalStoreSubmission(a.graph, definitions, originalB, { budget: 50 }, [], {});
  const revisitedA = {
    ...originalA, assetIdentifier: 'A__global_2', startTime: 30, endTime: 40,
  };
  const repeated = createGlobalStoreSubmission(b.graph, definitions, revisitedA, { budget: 70 }, [], {});
  const revisedB = { ...answer('B', '1', 15), assetIdentifier: 'B__global_3' };
  const revised = createGlobalStoreSubmission(repeated.graph, definitions, revisedB, { budget: 55 }, [], {});
  const answers = { A: revisitedA, B: revisedB };
  expect(projectHistoricalGlobalStore(revised.graph, b.nodeId, answers).answers).toEqual({ A: originalA, B: originalB });
  expect(projectHistoricalGlobalStore(revised.graph, revised.nodeId, answers).answers).toEqual(answers);
  expect(getGlobalStoreEntryValues(revised.graph, definitions, 'B').budget).toBe(70);
  const history = getGlobalStoreHistory(revised.graph);
  expect(history.map((entry) => entry.submission.answer.assetIdentifier).sort()).toEqual(['A__global_0', 'A__global_2', 'B__global_1', 'B__global_3']);
  expect(history.find((entry) => entry.nodeId === repeated.nodeId)).toMatchObject({ before: { budget: 100 }, after: { budget: 70 }, active: true });
});

test('replay reconstructs either recorded path from provenance, including invalidated answers', () => {
  const a = createGlobalStoreSubmission(undefined, definitions, answer('A', '0', 30), { budget: 70 }, [], {});
  const b = createGlobalStoreSubmission(a.graph, definitions, answer('B', '1', 20), { budget: 50 }, [], {});
  const revision = createGlobalStoreSubmission(b.graph, definitions, answer('A', '0', 10), { budget: 90 }, [], {});
  const revisedB = createGlobalStoreSubmission(revision.graph, definitions, answer('B', '1', 15), { budget: 75 }, [], {});
  const currentAnswers = { A: answer('A', '0', 10), B: answer('B', '1', 15) };
  const original = projectHistoricalGlobalStore(revisedB.graph, b.nodeId, currentAnswers);
  expect(original.answers.A.answer.cost).toBe(30);
  expect(original.answers.B.answer.cost).toBe(20);
  expect(original.graph.current).toBe(b.nodeId);
  const revised = projectHistoricalGlobalStore(revisedB.graph, revisedB.nodeId, currentAnswers);
  expect(revised.answers.A.answer.cost).toBe(10);
  expect(revised.answers.B.answer.cost).toBe(15);
  expect(revisedB.graph.current).toBe(revisedB.nodeId);
  const history = getGlobalStoreHistory(revisedB.graph);
  expect(history).toHaveLength(4);
  expect(history.filter((entry) => entry.active).map((entry) => entry.after.budget)).toEqual([90, 75]);
  expect(history.find((entry) => entry.nodeId === b.nodeId)).toMatchObject({ active: false, before: { budget: 70 }, after: { budget: 50 } });
});

test('historical replay merges late chunk keys only for segments retained by that submission', () => {
  const retainedSegment = 'A__global_0';
  const currentOnlySegment = 'A__global_2';
  const originalA = {
    ...answer('A', '0', 30),
    assetIdentifier: retainedSegment,
    recordingSegments: [retainedSegment],
    recordingChunkKeys: { [retainedSegment]: ['chunk-0'] },
  };
  const a = createGlobalStoreSubmission(undefined, definitions, originalA, { budget: 70 }, [], {});
  const b = createGlobalStoreSubmission(a.graph, definitions, answer('B', '1', 20), { budget: 50 }, [], {});
  const currentA = {
    ...answer('A', '0', 10),
    assetIdentifier: currentOnlySegment,
    recordingSegments: [retainedSegment, currentOnlySegment],
    recordingChunkKeys: {
      [retainedSegment]: ['chunk-0', 'chunk-1'],
      [currentOnlySegment]: ['new-visit-chunk'],
    },
  };

  const historical = projectHistoricalGlobalStore(b.graph, a.nodeId, { A: currentA, B: answer('B', '1', 20) });

  expect(historical.answers.A.answer).toEqual({ cost: 30 });
  expect(historical.answers.A.assetIdentifier).toBe(retainedSegment);
  expect(historical.answers.A.recordingChunkKeys).toEqual({ [retainedSegment]: ['chunk-0', 'chunk-1'] });
});

test('historical replay clears later-task recording metadata outside the selected path', () => {
  const aAnswer = {
    ...answer('A', '0', 30),
    assetIdentifier: 'A__segment',
    recordingSegments: ['A__segment'],
    recordingSegmentRanges: [{ assetIdentifier: 'A__segment', startTime: 1, endTime: 20 }],
    recordingSegmentTimes: { A__segment: { startTime: 1, endTime: 20 } },
    recordingChunkKeys: { A__segment: ['a-chunk'] },
    recordingEndTime: 20,
    recordingStartTime: 1,
  };
  const bAnswer = {
    ...answer('B', '1', 20),
    assetIdentifier: 'B__segment',
    recordingSegments: ['B__segment'],
    recordingSegmentRanges: [{ assetIdentifier: 'B__segment', startTime: 21, endTime: 40 }],
    recordingSegmentTimes: { B__segment: { startTime: 21, endTime: 40 } },
    recordingChunkKeys: { B__segment: ['b-chunk'] },
    recordingEndTime: 40,
    recordingStartTime: 21,
  };
  const cAnswer = {
    ...answer('C', '2', 10),
    assetIdentifier: 'C__segment',
    recordingSegments: ['C__segment'],
    recordingSegmentRanges: [{ assetIdentifier: 'C__segment', startTime: 41, endTime: 60 }],
    recordingSegmentTimes: { C__segment: { startTime: 41, endTime: 60 } },
    recordingChunkKeys: { C__segment: ['c-chunk'] },
    recordingEndTime: 60,
    recordingStartTime: 41,
  };
  const a = createGlobalStoreSubmission(undefined, definitions, aAnswer, { budget: 70 }, [], {});
  const b = createGlobalStoreSubmission(a.graph, definitions, bAnswer, { budget: 50 }, [], {});
  const c = createGlobalStoreSubmission(b.graph, definitions, cAnswer, { budget: 40 }, [], {});
  const laterCurrentAnswers = { A: aAnswer, B: bAnswer, C: cAnswer };

  const historicalA = projectHistoricalGlobalStore(c.graph, a.nodeId, laterCurrentAnswers).answers;
  expect(historicalA.A).toMatchObject({ answer: { cost: 30 }, recordingChunkKeys: { A__segment: ['a-chunk'] } });
  ['B', 'C'].forEach((identifier) => {
    expect(historicalA[identifier]).toMatchObject({ answer: {}, startTime: 0, endTime: -1 });
    expect(historicalA[identifier]).not.toHaveProperty('assetIdentifier');
    expect(historicalA[identifier]).not.toHaveProperty('recordingSegments');
    expect(historicalA[identifier]).not.toHaveProperty('recordingSegmentRanges');
    expect(historicalA[identifier]).not.toHaveProperty('recordingSegmentTimes');
    expect(historicalA[identifier]).not.toHaveProperty('recordingChunkKeys');
    expect(historicalA[identifier]).not.toHaveProperty('recordingEndTime');
    expect(historicalA[identifier]).not.toHaveProperty('recordingStartTime');
  });

  const historicalB = projectHistoricalGlobalStore(c.graph, b.nodeId, laterCurrentAnswers).answers;
  expect(historicalB.B).toMatchObject({ answer: { cost: 20 }, recordingChunkKeys: { B__segment: ['b-chunk'] } });
  expect(historicalB.C).not.toHaveProperty('recordingSegments');
});
