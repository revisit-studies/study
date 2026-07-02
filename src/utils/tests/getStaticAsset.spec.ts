import {
  afterEach, describe, expect, test, vi,
} from 'vitest';
import { getJsonAssetByPath, getStaticAssetByPath } from '../getStaticAsset';

vi.mock('../Prefix', () => ({ PREFIX: '/prefix/' }));

afterEach(() => vi.restoreAllMocks());

function mockFetch(text: string) {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
    text: () => Promise.resolve(text),
    json: () => Promise.resolve(JSON.parse(text)),
  })));
}

describe('getStaticAssetByPath', () => {
  test('returns the response text for normal content', async () => {
    mockFetch('hello world');
    await expect(getStaticAssetByPath('/path/to/file.md')).resolves.toBe('hello world');
  });

  test('returns undefined when the response is the ReVISit index page', async () => {
    mockFetch('<html><head><title>ReVISit</title></head></html>');
    await expect(getStaticAssetByPath('/missing')).resolves.toBeUndefined();
  });
});

describe('getJsonAssetByPath', () => {
  test('returns parsed JSON object', async () => {
    const payload = { $schema: 'vega', marks: [] };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      json: () => Promise.resolve(payload),
    })));
    await expect(getJsonAssetByPath('chart.json')).resolves.toEqual(payload);
  });

  test('returns undefined and logs error when JSON is malformed', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      json: () => Promise.reject(new Error('SyntaxError')),
    })));
    await expect(getJsonAssetByPath('bad.json')).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
  });

  test('prepends PREFIX to the requested path', async () => {
    const fetchSpy = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({}) }));
    vi.stubGlobal('fetch', fetchSpy);
    await getJsonAssetByPath('assets/data.json');
    expect(fetchSpy).toHaveBeenCalledWith('/prefix/assets/data.json');
  });
});
