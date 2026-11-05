export function score(_value: unknown, values: Record<string, unknown>): number {
  return values.secret === 'visible' || values['secret-other'] === 'visible' ? 1 : 0;
}
