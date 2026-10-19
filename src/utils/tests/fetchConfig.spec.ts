import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { parseStudyConfig } from '../../parser/parser';
import { fetchStudyConfigs, getStudyConfig, resolveConfigKey } from '../fetchConfig';
import { makeGlobalConfig, makeStudyConfig } from '../../tests/utils';

vi.mock('../../parser/parser', () => ({
  parseStudyConfig: vi.fn(),
}));

describe('fetchConfig', () => {
  const globalConfig = makeGlobalConfig({
    configs: {
      'test-config-1.2': { path: 'test-config-1.2/config.json' },
      'plain-study': { path: 'plain-study/config.json' },
    },
    configsList: ['test-config-1.2', 'plain-study'],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ test: true }),
    });
    const parsedConfig = {
      ...makeStudyConfig({
        studyMetadata: {
          title: 'Test',
          version: '1',
          authors: [],
          date: '2026-04-08',
          description: '',
          organizations: [],
        },
        uiConfig: {
          logoPath: '',
          contactEmail: '',
          withProgressBar: true,
          withSidebar: true,
        },
        sequence: {
          order: 'fixed',
          components: [],
          skip: [],
        },
        components: {},
      }),
      errors: [],
      warnings: [],
    };
    vi.mocked(parseStudyConfig).mockResolvedValue(parsedConfig);
  });

  it('resolves both raw and sanitized study ids to a config key', () => {
    expect(resolveConfigKey('test-config-1.2', globalConfig)).toBe('test-config-1.2');
    expect(resolveConfigKey('test-config-1_2', globalConfig)).toBe('test-config-1.2');
  });

  it('returns null for unknown study ids', () => {
    expect(resolveConfigKey('missing-study', globalConfig)).toBeNull();
  });

  it('loads a study config for sanitized route ids', async () => {
    const result = await getStudyConfig('test-config-1_2', globalConfig);

    expect(result).not.toBeNull();
    expect(global.fetch).toHaveBeenCalledWith('/test-config-1.2/config.json');
    expect(parseStudyConfig).toHaveBeenCalledTimes(1);
  });

  it('loads every listed config including dotted names', async () => {
    const results = await fetchStudyConfigs(globalConfig);

    expect(results['test-config-1.2']).not.toBeNull();
    expect(results['plain-study']).not.toBeNull();
    expect(parseStudyConfig).toHaveBeenCalledTimes(2);
  });

  it('returns a config error when the config request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => '<!doctype html>',
    });

    const result = await getStudyConfig('test-config-1.2', globalConfig);

    expect(result?.errors).toEqual([expect.objectContaining({
      message: 'Unable to load study config `test-config-1.2/config.json`: 404 Not Found',
      category: 'invalid-config',
    })]);
    expect(parseStudyConfig).not.toHaveBeenCalled();
  });

  it('keeps successful configs when another config request fails', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('test-config-1.2')) {
        return {
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          text: async () => '',
        };
      }

      return {
        ok: true,
        text: async () => JSON.stringify({ test: true }),
      };
    });

    const results = await fetchStudyConfigs(globalConfig);

    expect(results['test-config-1.2']?.errors).toHaveLength(1);
    expect(results['plain-study']).toEqual(expect.objectContaining({ errors: [], warnings: [] }));
    expect(parseStudyConfig).toHaveBeenCalledTimes(1);
  });

  it('returns a config error when fetching the config rejects', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network unavailable'));

    const result = await getStudyConfig('test-config-1.2', globalConfig);

    expect(result?.errors).toEqual([expect.objectContaining({
      message: 'Unable to load study config `test-config-1.2/config.json`: network unavailable',
      category: 'invalid-config',
    })]);
  });
});
