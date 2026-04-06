import { expect, test } from 'vitest';

test('storage/types module loads (covers import statement)', async () => {
  const module = await import('./types');
  expect(module).toBeDefined();
});
