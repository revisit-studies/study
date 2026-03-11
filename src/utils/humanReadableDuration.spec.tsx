import { describe, expect, it } from 'vitest';
import { youtubeReadableDuration } from './humanReadableDuration';

describe('youtubeReadableDuration', () => {
  it('returns undefined for NaN', () => {
    expect(youtubeReadableDuration(Number.NaN)).toBeUndefined();
  });

  it('returns 0s for non-positive durations', () => {
    expect(youtubeReadableDuration(0)).toBe('0s');
    expect(youtubeReadableDuration(-1000)).toBe('0s');
  });

  it('formats mm:ss and hh:mm:ss outputs', () => {
    expect(youtubeReadableDuration(65000)).toBe('01:04');
    expect(youtubeReadableDuration(3661000)).toBe('01:01:00');
  });
});
