import isEqual from 'lodash.isequal';
import type { ValueCondition } from '../parser/types';

/** Compare values without converting strings to numbers. */
export function compareResponseValues(
  value: unknown,
  expected: unknown,
  comparison: ValueCondition['comparison'],
  options: { ignoreArrayOrder?: boolean } = {},
): boolean {
  if (comparison === 'equals' || comparison === 'doesNotEqual') {
    const equal = Array.isArray(value) && Array.isArray(expected) && options.ignoreArrayOrder
      ? isEqual([...value].sort(), [...expected].sort())
      : isEqual(value, expected);
    return comparison === 'equals' ? equal : !equal;
  }

  if (comparison === 'contains' || comparison === 'doesNotContain' || comparison === 'matchesRegex') {
    if (typeof value !== 'string' || typeof expected !== 'string') return false;
    if (comparison === 'contains') return value.includes(expected);
    if (comparison === 'doesNotContain') return !value.includes(expected);
    try {
      return new RegExp(expected).test(value);
    } catch {
      return false;
    }
  }

  if (typeof value !== 'number' || typeof expected !== 'number'
    || !Number.isFinite(value) || !Number.isFinite(expected)) return false;
  switch (comparison) {
    case 'lessThan': return value < expected;
    case 'lessThanOrEqual': return value <= expected;
    case 'greaterThan': return value > expected;
    case 'greaterThanOrEqual': return value >= expected;
    default: return false;
  }
}
