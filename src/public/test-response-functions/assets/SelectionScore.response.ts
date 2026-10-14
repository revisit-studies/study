/** Require two selections, then score their overlap with the expected selection using Jaccard similarity. */
export function validate(value: unknown, _values: unknown, _response: unknown, expected?: unknown): string | number | null {
  if (!Array.isArray(value) || value.length < 2) return 'Select at least two options.';
  if (expected === undefined) return null;
  if (!Array.isArray(expected)) return 0;

  const selected = new Set(value);
  const correct = new Set(expected);
  const union = new Set([...selected, ...correct]);
  return [...selected].filter((option) => correct.has(option)).length / union.size;
}
