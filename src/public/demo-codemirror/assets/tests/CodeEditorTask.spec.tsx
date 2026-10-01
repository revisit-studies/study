import { expect, test } from 'vitest';
import { runTestCases } from '../CodeEditorTask';

test('repeated runs cannot mutate configured test inputs', () => {
  const cases = [{ args: [[1, 2, 3]], expected: 3 }];
  const source = 'function takeLast(nums) { return nums.pop(); }';

  expect(runTestCases(source, 'takeLast', cases).results[0].passed).toBe(true);
  expect(runTestCases(source, 'takeLast', cases).results[0].passed).toBe(true);
  expect(cases[0].args).toEqual([[1, 2, 3]]);
});

test('reports non-Error values thrown before and during test cases', () => {
  expect(runTestCases('throw null; function f() {}', 'f', [])).toEqual({
    results: [], runtimeError: 'Your code threw before any test ran: null',
  });
  expect(runTestCases('function f() { throw undefined; }', 'f', [{ args: [], expected: 1 }])).toEqual({
    results: [{ label: 'f() → 1', passed: false, actual: 'threw undefined' }],
    runtimeError: null,
  });
});
