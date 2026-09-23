import { expect, test } from 'vitest';
import { runTestCases } from '../CodeEditorTask';

test('repeated runs cannot mutate configured test inputs', () => {
  const cases = [{ args: [[1, 2, 3]], expected: 3 }];
  const source = 'function takeLast(nums) { return nums.pop(); }';

  expect(runTestCases(source, 'takeLast', cases).results[0].passed).toBe(true);
  expect(runTestCases(source, 'takeLast', cases).results[0].passed).toBe(true);
  expect(cases[0].args).toEqual([[1, 2, 3]]);
});
