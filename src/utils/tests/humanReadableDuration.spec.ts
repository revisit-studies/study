import { describe, expect, test } from 'vitest';
import { youtubeReadableDuration } from '../humanReadableDuration';

describe('youtubeReadableDuration', () => {
  test('returns undefined for NaN input', () => {
    expect(youtubeReadableDuration(NaN)).toBeUndefined();
  });

  test('returns "0s" for zero milliseconds', () => {
    expect(youtubeReadableDuration(0)).toBe('0s');
  });

  test('returns "0s" for negative milliseconds', () => {
    expect(youtubeReadableDuration(-100)).toBe('0s');
  });

  test('formats seconds only (under 1 minute)', () => {
    const thirtySeconds = 30 * 1000;
    expect(youtubeReadableDuration(thirtySeconds)).toBe('00:30');
  });

  test('formats minutes and seconds', () => {
    const ninetySeconds = 90 * 1000;
    expect(youtubeReadableDuration(ninetySeconds)).toBe('01:30');
  });

  test('formats hours, minutes and seconds', () => {
    const twoHours = 2 * 60 * 60 * 1000;
    expect(youtubeReadableDuration(twoHours)).toBe('02:00:00');
  });

  test('pads single-digit minutes and seconds with leading zero', () => {
    // 1 min 6 sec = 66 s = 66 000 ms
    const oneMinSixSec = 66 * 1000;
    expect(youtubeReadableDuration(oneMinSixSec)).toBe('01:06');
  });

  test('omits the hours segment when duration is under one hour', () => {
    const fiftyNineMinutes = 59 * 60 * 1000;
    const result = youtubeReadableDuration(fiftyNineMinutes);
    expect(result).not.toContain('00:');
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });
});
