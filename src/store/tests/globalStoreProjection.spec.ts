import { expect, test } from 'vitest';
import { projectGlobalStoreAnswers } from '../globalStoreProjection';
import { makeStoredAnswer } from '../../tests/utils';

test('an earlier revision clears later progress and cached values while preserving static randomization', () => {
  const original = {
    A: makeStoredAnswer({
      identifier: 'A',
      trialOrder: '0',
      answer: { cost: 30 },
    }),
    B: makeStoredAnswer({
      identifier: 'B',
      trialOrder: '1',
      answer: { cost: 20 },
      globalStoreEntry: { budget: 70 },
      assetIdentifier: 'old-B-recording',
      recordingSegments: ['old-B-recording'],
      recordingSegmentRanges: [{ assetIdentifier: 'old-B-recording', startTime: 100, endTime: 200 }],
      windowEvents: [[150, 'displaystatus', 'multiple']],
      formOrder: { response: ['b', 'a'] },
    }),
    dynamic: makeStoredAnswer({
      identifier: 'dynamic',
      trialOrder: '2_0',
      answer: { cost: 5 },
      recordingSegments: ['dynamic-segment'],
      recordingChunkKeys: { 'dynamic-segment': ['dynamic-chunk'] },
      windowEvents: [[30, 'displaystatus', 'multiple']],
    }),
  };
  const revised = { ...original.A, answer: { cost: 10 } };
  const result = projectGlobalStoreAnswers(original, revised, true);
  expect(result.A.answer.cost).toBe(10);
  expect(result.B).toMatchObject({
    answer: {}, endTime: -1, startTime: 0, formOrder: { response: ['b', 'a'] },
  });
  expect(result.B.globalStoreEntry).toBeUndefined();
  expect(result.B.assetIdentifier).toBeUndefined();
  expect(result.B.recordingSegments).toEqual(['old-B-recording']);
  expect(result.B.recordingSegmentRanges).toEqual([{ assetIdentifier: 'old-B-recording', startTime: 100, endTime: 200 }]);
  expect(result.B.windowEvents).toEqual([[150, 'displaystatus', 'multiple']]);
  expect(result.dynamic).toMatchObject({
    answer: {},
    endTime: -1,
    recordingArchived: true,
    recordingSegments: ['dynamic-segment'],
    recordingChunkKeys: { 'dynamic-segment': ['dynamic-chunk'] },
    windowEvents: [[30, 'displaystatus', 'multiple']],
  });
  expect(original.B.answer.cost).toBe(20);
});
