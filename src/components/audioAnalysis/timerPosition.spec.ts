import * as d3 from 'd3';
import { describe, expect, test } from 'vitest';
import { getSeekTimeFromSvgPosition } from './timerPosition';

describe('getSeekTimeFromSvgPosition', () => {
  test('uses svg-local x coordinate instead of viewport x coordinate', () => {
    const xScale = d3.scaleLinear([20, 220]).domain([0, 100]).clamp(true);
    const seekTime = getSeekTimeFromSvgPosition(160, 100, xScale);

    expect(seekTime).toBeCloseTo(20, 6);
  });

  test('normalizes to playback-relative time when domain does not start at zero', () => {
    const xScale = d3.scaleLinear([0, 200]).domain([10, 110]).clamp(true);
    const seekTime = getSeekTimeFromSvgPosition(50, 0, xScale);

    expect(seekTime).toBeCloseTo(25, 6);
  });
});
