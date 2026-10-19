/** Require a whole number before accepting the response. */
export function validate(value: unknown): string | null {
  const numericValue = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof numericValue !== 'number' || !Number.isInteger(numericValue)) return 'Enter a whole number.';
  return null;
}

/** Award credit based on distance from the expected value. */
export function score(value: unknown, _values: unknown, _response: unknown, expected?: unknown): boolean | number | null {
  const numericValue = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof numericValue !== 'number' || !Number.isInteger(numericValue)) return null;
  if (expected === undefined) return null;
  if (typeof expected !== 'number' || expected <= 0) return 0;
  if (numericValue === expected) return true;
  if (numericValue === 0) return false;
  return Math.max(0, 1 - Math.abs(numericValue - expected) / expected);
}
