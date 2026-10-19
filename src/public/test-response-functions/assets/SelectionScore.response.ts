/** Require two selections. */
export function validate(value: unknown): string | null {
  if (!Array.isArray(value) || value.length < 2) return 'Select at least two options.';
  return null;
}

/** Score selection overlap with the expected selection using Jaccard similarity. */
export function score(value: unknown, _values: unknown, _response: unknown, expected?: unknown): number | null {
  if (!Array.isArray(value)) return null;
  if (expected === undefined) return null;
  if (!Array.isArray(expected)) return null;

  const selected = new Set(value);
  const correct = new Set(expected);
  const union = new Set([...selected, ...correct]);
  return [...selected].filter((option) => correct.has(option)).length / union.size;
}
