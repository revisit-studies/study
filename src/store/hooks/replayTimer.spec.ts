import { describe, expect, test } from 'vitest';
import { getNextSyntheticReplayTime } from './replayTimer';

describe('getNextSyntheticReplayTime', () => {
  test('advances from current time using elapsed milliseconds and speed', () => {
    const next = getNextSyntheticReplayTime(12.5, 1000, 1100, 2);
    expect(next).toBeCloseTo(12.7, 6);
  });

  test('continues from a newly scrubbed time instead of reverting to old baseline', () => {
    let current = 2;
    let lastTick = 1000;

    current = getNextSyntheticReplayTime(current, lastTick, 1030, 1);
    lastTick = 1030;

    // Simulate a user scrub while replay is running.
    current = 10;

    current = getNextSyntheticReplayTime(current, lastTick, 1060, 1);
    expect(current).toBeCloseTo(10.03, 6);
  });
});
