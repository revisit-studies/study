export function validate(value: unknown): string {
  return value === 'accepted' ? '' : 'This value is not accepted';
}
