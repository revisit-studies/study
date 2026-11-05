/** Require a whole number. */
export function validate(value: unknown): string | null {
  const numericValue = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof numericValue !== 'number' || !Number.isInteger(numericValue)) return 'Enter a whole number.';
  return null;
}

/** Award credit according to the selected slider value. */
export function score(value: unknown): number | null {
  const numericValue = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof numericValue !== 'number' || !Number.isInteger(numericValue)) return null;
  if (numericValue >= 10) return 1;
  if (numericValue >= 7) return 0.8;
  if (numericValue >= 5) return 0.6;
  if (numericValue === 4) return 0.2;
  return 0;
}
