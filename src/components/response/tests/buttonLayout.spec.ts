import { describe, expect, test } from 'vitest';
import { getButtonColumnSpans, getButtonRowSizes } from '../buttonLayout';

describe('getButtonRowSizes', () => {
  test('keeps options in one row when their labels fit', () => {
    expect(getButtonRowSizes([80, 90, 100], 300, 8)).toEqual([3]);
  });

  test.each([
    [6, [3, 3], [3, 3, 3, 3, 3, 3]],
    [7, [4, 3], [3, 3, 3, 3, 4, 4, 4]],
    [10, [5, 5], [5, 5, 5, 5, 5, 5, 5, 5, 5, 5]],
  ])('balances %i options across at most two rows', (optionCount, expectedRows, expectedSpans) => {
    expect(getButtonRowSizes(Array.from({ length: optionCount }, () => 100), 300, 8)).toEqual(expectedRows);
    expect(getButtonColumnSpans(optionCount, expectedRows)).toEqual(expectedSpans);
  });
});
