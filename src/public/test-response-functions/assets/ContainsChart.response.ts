/** Require the built-in text response to contain a study-specific keyword. */
export function validate(value: unknown): string | null {
  return typeof value === 'string' && value.toLowerCase().includes('chart')
    ? null
    : 'Include the word "chart".';
}
