import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { PREFIX } from './Prefix';
import { getJsonAssetByPath, getStaticAssetByPath } from './getStaticAsset';

describe('getStaticAsset', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    vi.restoreAllMocks();
  });

  it('returns undefined when fetched html is the app shell', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: () => Promise.resolve('<html><title>ReVISit</title></html>'),
    });

    const result = await getStaticAssetByPath('/assets/file.txt');

    expect(result).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith('/assets/file.txt');
  });

  it('returns fetched text when content is not the app shell', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: () => Promise.resolve('asset-content'),
    });

    const result = await getStaticAssetByPath('/assets/file.txt');

    expect(result).toBe('asset-content');
  });

  it('returns parsed json data for json assets', async () => {
    const payload = { key: 'value' };
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve(payload),
    });

    const result = await getJsonAssetByPath('study/config.json');

    expect(global.fetch).toHaveBeenCalledWith(`${PREFIX}study/config.json`);
    expect(result).toEqual(payload);
  });

  it('returns undefined and logs when json parsing fails', async () => {
    const error = new Error('bad json');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.reject(error),
    });

    const result = await getJsonAssetByPath('study/config.json');

    expect(result).toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith('Invalid JSON:', error);
  });
});
