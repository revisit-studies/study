import { describe, expect, test } from 'vitest';
import { getButtonRowSizes } from '../buttonLayout';

describe('getButtonRowSizes', () => {
  test('keeps options in one row when their labels fit', () => {
    expect(getButtonRowSizes([80, 90, 100], 320, 8)).toEqual([3]);
  });

  test('uses two rows when unequal labels would not fit equal-width buttons', () => {
    expect(getButtonRowSizes([40, 40, 160], 300, 8)).toEqual([2, 1]);
  });

  test('lets short labels use a smaller content-based minimum', () => {
    expect(getButtonRowSizes(Array(10).fill(12), 800, 8, 24)).toEqual([10]);
  });

  test.each([
    [6, [3, 3]],
    [7, [4, 3]],
    [10, [5, 5]],
  ])('balances %i options across at most two rows', (optionCount, expectedRows) => {
    expect(getButtonRowSizes(Array.from({ length: optionCount }, () => 100), 300, 8)).toEqual(expectedRows);
  });
});
