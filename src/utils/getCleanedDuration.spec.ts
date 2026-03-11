import { describe, expect, it } from 'vitest';
import { getCleanedDuration } from './getCleanedDuration';

describe('getCleanedDuration', () => {
  it('returns raw duration when there are no visibility events', () => {
    const result = getCleanedDuration({
      startTime: 1000,
      endTime: 6000,
      windowEvents: [],
    });

    expect(result).toBe(5000);
  });

  it('subtracts hidden intervals from duration', () => {
    const result = getCleanedDuration({
      startTime: 0,
      endTime: 10000,
      windowEvents: [
        [2000, 'visibility', 'hidden'],
        [5000, 'visibility', 'visible'],
      ],
    });

    expect(result).toBe(7000);
  });

  it('returns -1 when answer is unfinished', () => {
    const result = getCleanedDuration({
      startTime: 0,
      endTime: -1,
      windowEvents: [],
    });

    expect(result).toBe(-1);
  });
});
