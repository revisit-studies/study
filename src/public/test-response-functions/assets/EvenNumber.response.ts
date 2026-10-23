/** Return null to accept an even number, or an error message for an odd number. */
export function validate(value: unknown): string | null {
  return typeof value === 'number' && value % 2 === 0 ? null : 'Enter an even number.';
}
