import { describe, expect, test } from 'vitest';
import {
  generateSliderBreakValues,
  getDefaultSliderSpacing,
  getSliderValueFromPosition,
} from '../sliderBreaks';

describe('getDefaultSliderSpacing', () => {
  test('uses largest power of 10 below the range', () => {
    expect(getDefaultSliderSpacing(1, 50)).toBe(10);
    expect(getDefaultSliderSpacing(1, 80)).toBe(10);
    expect(getDefaultSliderSpacing(1, 300)).toBe(100);
  });
});

describe('generateSliderBreakValues', () => {
  test('creates breaks for 1-50 at spacing 10', () => {
    expect(generateSliderBreakValues(1, 50)).toEqual([10, 20, 30, 40]);
  });

  test('creates breaks for 1-80 at spacing 10', () => {
    expect(generateSliderBreakValues(1, 80)).toEqual([10, 20, 30, 40, 50, 60, 70]);
  });

  test('creates breaks for 1-300 at spacing 100', () => {
    expect(generateSliderBreakValues(1, 300)).toEqual([100, 200]);
  });

  test('creates decimal breaks for 0-1', () => {
    expect(getDefaultSliderSpacing(0, 1)).toBe(0.1);
    expect(generateSliderBreakValues(0, 1)).toEqual([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]);
  });

  test('creates decimal breaks for 0.5-0.55', () => {
    expect(getDefaultSliderSpacing(0.5, 0.55)).toBe(0.01);
    expect(generateSliderBreakValues(0.5, 0.55)).toEqual([0.51, 0.52, 0.53, 0.54]);
  });

  test('handles range spanning three orders of magnitude', () => {
    expect(getDefaultSliderSpacing(1, 1000)).toBe(100);
    expect(generateSliderBreakValues(1, 1000)).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900]);
  });

  test('handles range spanning six orders of magnitude', () => {
    expect(getDefaultSliderSpacing(1, 1_000_000)).toBe(100_000);
    expect(generateSliderBreakValues(1, 1_000_000)).toEqual([100_000, 200_000, 300_000, 400_000, 500_000, 600_000, 700_000, 800_000, 900_000]);
  });

  test('handles range spanning ten orders of magnitude', () => {
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

  test('supports similar range with spacing 10', () => {
    expect(generateSliderBreakValues(5, 95)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90]);
  });

  test('supports similar range with spacing 100', () => {
    expect(generateSliderBreakValues(35, 520)).toEqual([100, 200, 300, 400, 500]);
  });

  test('respects explicitly provided spacing', () => {
    expect(generateSliderBreakValues(1, 50, 5)).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45]);
  });

  test('supports negative ranges', () => {
    expect(generateSliderBreakValues(-20, 20)).toEqual([-10, 0, 10]);
  });

  test('returns empty array for invalid ranges', () => {
    expect(generateSliderBreakValues(10, 10)).toEqual([]);
    expect(generateSliderBreakValues(20, 10)).toEqual([]);
  });
});

describe('getSliderValueFromPosition', () => {
  test('clamps positions to the configured range', () => {
    expect(getSliderValueFromPosition(-0.2, 0, 100, 5)).toBe(0);
    expect(getSliderValueFromPosition(1.2, 0, 100, 5)).toBe(100);
  });

  test('rounds candidate values using the configured step', () => {
    expect(getSliderValueFromPosition(0.78, 0, 100, 5)).toBe(80);
    expect(getSliderValueFromPosition(0.333, 0, 1, 0.01)).toBe(0.33);
  });

  test('preserves fractional minima when rounding to a step', () => {
    expect(getSliderValueFromPosition(0.3, 0.05, 1.05, 0.1)).toBe(0.35);
    expect(getSliderValueFromPosition(0, 0.05, 10.05, 1)).toBe(0.05);
  });

  test('supports steps written in scientific notation', () => {
    expect(getSliderValueFromPosition(0.5, 0, 0.000001, 1e-7)).toBe(0.0000005);
  });

  test('uses the default one-hundredth range step when none is configured', () => {
    expect(getSliderValueFromPosition(0.914, 0, 150)).toBe(136.5);
  });

  test('selects the nearest value when snapping is enabled', () => {
    expect(getSliderValueFromPosition(0.52, 0, 100, 1, [0, 25, 50, 75, 100])).toBe(50);
    expect(getSliderValueFromPosition(0.63, 0, 100, 1, [0, 25, 50, 75, 100])).toBe(75);
  });

  test('returns null for invalid input', () => {
    expect(getSliderValueFromPosition(Number.NaN, 0, 100)).toBeNull();
    expect(getSliderValueFromPosition(0.5, 10, 10)).toBeNull();
    expect(getSliderValueFromPosition(0.5, 0, 100, 0)).toBeNull();
  });
});
