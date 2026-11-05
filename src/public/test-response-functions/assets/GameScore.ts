export function score(value: unknown): number | null {
  return typeof value === 'number' ? value / 10 : null;
}
