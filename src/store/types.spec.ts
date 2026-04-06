import { expect, test } from 'vitest';

test('store/types module loads (covers import statement)', async () => {
  // Dynamic import forces module execution, covering the runtime import statement
  const module = await import('./types');
  expect(module).toBeDefined();
});
