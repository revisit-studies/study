import { describe, expect, it } from 'vitest';
import { generateSliderBreakValues, getDefaultSliderSpacing } from './sliderBreaks';

describe('getDefaultSliderSpacing', () => {
  it('uses largest power of 10 below the range', () => {
    expect(getDefaultSliderSpacing(1, 50)).toBe(10);
    expect(getDefaultSliderSpacing(1, 80)).toBe(10);
    expect(getDefaultSliderSpacing(1, 300)).toBe(100);
  });
});

describe('generateSliderBreakValues', () => {
  it('creates breaks for 1-50 at spacing 10', () => {
    expect(generateSliderBreakValues(1, 50)).toEqual([10, 20, 30, 40]);
  });

  it('creates breaks for 1-80 at spacing 10', () => {
    expect(generateSliderBreakValues(1, 80)).toEqual([10, 20, 30, 40, 50, 60, 70]);
  });

  it('creates breaks for 1-300 at spacing 100', () => {
    expect(generateSliderBreakValues(1, 300)).toEqual([100, 200]);
  });

  it('creates decimal breaks for 0-1', () => {
    expect(getDefaultSliderSpacing(0, 1)).toBe(0.1);
    expect(generateSliderBreakValues(0, 1)).toEqual([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]);
  });

  it('creates decimal breaks for 0.5-0.55', () => {
    expect(getDefaultSliderSpacing(0.5, 0.55)).toBe(0.01);
    expect(generateSliderBreakValues(0.5, 0.55)).toEqual([0.51, 0.52, 0.53, 0.54]);
  });

  it('handles range spanning three orders of magnitude', () => {
    expect(getDefaultSliderSpacing(1, 1000)).toBe(100);
    expect(generateSliderBreakValues(1, 1000)).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900]);
  });

  it('handles range spanning six orders of magnitude', () => {
    expect(getDefaultSliderSpacing(1, 1_000_000)).toBe(100_000);
    expect(generateSliderBreakValues(1, 1_000_000)).toEqual([100_000, 200_000, 300_000, 400_000, 500_000, 600_000, 700_000, 800_000, 900_000]);
  });

  it('handles range spanning ten orders of magnitude', () => {
    expect(getDefaultSliderSpacing(1, 10_000_000_000)).toBe(1_000_000_000);
    expect(generateSliderBreakValues(1, 10_000_000_000)).toEqual([
      1_000_000_000,
      2_000_000_000,
      3_000_000_000,
      4_000_000_000,
      5_000_000_000,
      6_000_000_000,
      7_000_000_000,
      8_000_000_000,
      9_000_000_000,
    ]);
  });

  it('supports similar range with spacing 10', () => {
    expect(generateSliderBreakValues(5, 95)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90]);
  });

  it('supports similar range with spacing 100', () => {
    expect(generateSliderBreakValues(35, 520)).toEqual([100, 200, 300, 400, 500]);
  });

  it('respects explicitly provided spacing', () => {
    expect(generateSliderBreakValues(1, 50, 5)).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45]);
  });

  it('supports negative ranges', () => {
    expect(generateSliderBreakValues(-20, 20)).toEqual([-10, 0, 10]);
  });

  it('returns empty array for invalid ranges', () => {
    expect(generateSliderBreakValues(10, 10)).toEqual([]);
    expect(generateSliderBreakValues(20, 10)).toEqual([]);
  });
});
