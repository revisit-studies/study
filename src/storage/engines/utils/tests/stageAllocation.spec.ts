import { describe, expect, test } from 'vitest';
import { getStageCombinationTargets } from '../stageAllocation';

describe('getStageCombinationTargets', () => {
  test('has no targets without a stage maximum', () => {
    expect(getStageCombinationTargets(undefined, ['a', 'b'], { a: 3 })).toBeUndefined();
  });

  test('splits the maximum evenly with the remainder going to the earliest combinations', () => {
    expect(getStageCombinationTargets(10, ['a', 'b', 'c', 'd'], undefined)).toEqual({
      a: 3, b: 3, c: 2, d: 2,
    });
  });

  test('splits the maximum left after explicit targets across the other combinations', () => {
    expect(getStageCombinationTargets(10, ['a', 'b', 'c', 'd'], { a: 4, d: 1 })).toEqual({
      a: 4, b: 3, c: 2, d: 1,
    });
  });

  test('gives disabled combinations none of an even split', () => {
    expect(getStageCombinationTargets(10, ['a', 'b'], undefined, ['b'])).toEqual({ a: 10, b: 0 });
  });

  test('keeps an explicit target for a disabled combination', () => {
    expect(getStageCombinationTargets(10, ['a', 'b', 'c'], { b: 4 }, ['b'])).toEqual({ a: 3, b: 4, c: 3 });
  });

  test('never allocates a negative remainder when explicit targets exceed the maximum', () => {
    expect(getStageCombinationTargets(2, ['a', 'b'], { a: 5 })).toEqual({ a: 5, b: 0 });
  });

  test('gives every combination 0 when all of them are disabled', () => {
    expect(getStageCombinationTargets(10, ['a', 'b'], undefined, ['a', 'b'])).toEqual({ a: 0, b: 0 });
  });
});
