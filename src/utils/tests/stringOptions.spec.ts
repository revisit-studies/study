import { describe, expect, test } from 'vitest';
import { parseStringOption, parseStringOptionValue, parseStringOptions } from '../stringOptions';

describe('stringOptions', () => {
  test('fills missing option values with labels', () => {
    expect(parseStringOption({ label: 'Bar' })).toEqual({ label: 'Bar', value: 'Bar' });

    expect(parseStringOption({ label: 'Line', infoText: 'Trend chart' })).toEqual({
      label: 'Line',
      value: 'Line',
      infoText: 'Trend chart',
    });
  });

  test('preserves explicit option values', () => {
    expect(parseStringOption({ label: 'Bar', value: 'bar-value' })).toEqual({ label: 'Bar', value: 'bar-value' });
  });

  test('preserves infoText for single option normalization', () => {
    expect(parseStringOption({ label: 'Bar', infoText: 'Helpful details' })).toEqual({
      label: 'Bar',
      value: 'Bar',
      infoText: 'Helpful details',
    });
    expect(parseStringOption({ label: 'Line', value: 'line-value', infoText: 'Trend chart' })).toEqual({
      label: 'Line',
      value: 'line-value',
      infoText: 'Trend chart',
    });
  });

  test('normalizes option arrays and string values', () => {
    expect(parseStringOptions(['A', { label: 'B' }])).toEqual([
      { label: 'A', value: 'A' },
      { label: 'B', value: 'B' },
    ]);
    expect(parseStringOptionValue({ label: 'Question 1' })).toBe('Question 1');
  });

  test('preserves infoText in normalized option arrays', () => {
    expect(parseStringOptions([
      { label: 'A', infoText: 'Info A' },
      { label: 'B', value: 'b-value', infoText: 'Info B' },
    ])).toEqual([
      { label: 'A', value: 'A', infoText: 'Info A' },
      { label: 'B', value: 'b-value', infoText: 'Info B' },
    ]);
  });
});
