import {
  afterEach, expect, test, vi,
} from 'vitest';
import { fetchFreshStorageObject } from '../fetchFreshStorageObject';

afterEach(() => vi.unstubAllGlobals());

test('fresh reads use unique URLs and bypass caching while preserving authorization and query parameters', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetch);
  const url = 'https://storage.example/history?token=existing';
  await fetchFreshStorageObject(url, { headers: { Authorization: 'Bearer test' } });
  await fetchFreshStorageObject(url, { headers: { Authorization: 'Bearer test' } });
  const [first, second] = fetch.mock.calls.map(([request]) => request as Request);
  expect(first.url).not.toBe(second.url);
  expect(new URL(first.url).searchParams.get('token')).toBe('existing');
  expect(first.headers.get('Authorization')).toBe('Bearer test');
  expect(fetch.mock.calls.every(([, init]) => init.cache === 'no-store')).toBe(true);
});
