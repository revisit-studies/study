/** Require a whole number, then award credit based on distance from the expected value. */
export function validate(value: unknown, _values: unknown, _response: unknown, expected?: unknown): string | boolean | number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return 'Enter a whole number.';
  if (expected === undefined) return null;
  if (typeof expected !== 'number' || expected <= 0) return 0;
  if (value === expected) return true;
  if (value === 0) return false;
  return Math.max(0, 1 - Math.abs(value - expected) / expected);
}
