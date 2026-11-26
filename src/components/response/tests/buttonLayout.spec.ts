import { describe, expect, test } from 'vitest';
import { getButtonRowSizes } from '../buttonLayout';

describe('getButtonRowSizes', () => {
  test('keeps options in one row when their labels fit', () => {
    expect(getButtonRowSizes([80, 90, 100], 320, 8)).toEqual([3]);
  });

  test('wraps when the widest label does not fit in a row', () => {
    expect(getButtonRowSizes([40, 40, 160], 300, 8)).toEqual([1, 1, 1]);
  });

  test('lets short labels use a smaller content-based minimum', () => {
    expect(getButtonRowSizes(Array(10).fill(12), 800, 8, 24)).toEqual([10]);
  });

  test.each([
    [6, 300, [2, 2, 2]],
    [7, 500, [4, 3]],
    [10, 800, [7, 3]],
    [14, 500, [4, 4, 4, 2]],
  ])('fills rows for %i options based on available width', (optionCount, availableWidth, expectedRows) => {
    expect(getButtonRowSizes(Array.from({ length: optionCount }, () => 100), availableWidth, 8)).toEqual(expectedRows);
  });
});
