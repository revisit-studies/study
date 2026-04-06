import { expect, test } from 'vitest';

test('parser/types module loads (covers import statement)', async () => {
  const module = await import('./types');
  expect(module).toBeDefined();
});
