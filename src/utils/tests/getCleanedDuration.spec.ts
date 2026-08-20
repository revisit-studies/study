import { describe, expect, test } from 'vitest';
import type { EventType } from '../../store/types';
import { getCleanedDuration } from '../getCleanedDuration';

const makeArgs = (startTime: number, endTime: number, windowEvents: EventType[] = []) => ({
  startTime,
  endTime,
  windowEvents,
});

describe('getCleanedDuration', () => {
  test('returns -1 when endTime is -1 (in-progress)', () => {
    expect(getCleanedDuration(makeArgs(0, -1))).toBe(-1);
  });

  test('returns full duration when no visibility events', () => {
    const start = 1000;
    const end = 6000;
    expect(getCleanedDuration(makeArgs(start, end))).toBe(end - start);
  });

  test('subtracts time navigated away between hidden/visible pairs', () => {
    const start = 0;
    const end = 10000;
    const awayStart = 2000;
    const awayEnd = 5000;
    const events: EventType[] = [
      [awayStart, 'visibility', 'hidden'],
      [awayEnd, 'visibility', 'visible'],
    ];
    const expected = (end - start) - (awayEnd - awayStart);
    expect(getCleanedDuration(makeArgs(start, end, events))).toBe(expected);
  });

  test('handles multiple hidden/visible pairs', () => {
    const events: EventType[] = [
      [1000, 'visibility', 'hidden'],
      [2000, 'visibility', 'visible'],
      [4000, 'visibility', 'hidden'],
      [6000, 'visibility', 'visible'],
    ];
    const start = 0;
    const end = 10000;
    const totalAway = (2000 - 1000) + (6000 - 4000);
    expect(getCleanedDuration(makeArgs(start, end, events))).toBe(end - start - totalAway);
  });

  test('ignores trailing hidden event without a matching visible', () => {
    const events: EventType[] = [
      [3000, 'visibility', 'hidden'],
    ];
    const start = 0;
    const end = 5000;
    expect(getCleanedDuration(makeArgs(start, end, events))).toBe(end - start);
  });

  test('returns -1 when cleaned duration is negative', () => {
    // 1000ms total, but hidden for 3000ms → cleaned = -2000
    const events: EventType[] = [
      [0, 'visibility', 'hidden'],
      [3000, 'visibility', 'visible'],
    ];
    expect(getCleanedDuration(makeArgs(0, 1000, events))).toBe(-1);
  });

  test('ignores non-visibility events', () => {
    const events: EventType[] = [
      [500, 'mousemove', [100, 200]],
      [1000, 'visibility', 'hidden'],
      [2000, 'visibility', 'visible'],
    ];
    const start = 0;
    const end = 5000;
    expect(getCleanedDuration(makeArgs(start, end, events))).toBe(end - start - 1000);
  });
});
