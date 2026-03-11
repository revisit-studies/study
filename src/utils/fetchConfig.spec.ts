import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { GlobalConfig } from '../parser/types';
import { parseStudyConfig } from '../parser/parser';
import { PREFIX } from './Prefix';
import { fetchStudyConfigs, getStudyConfig } from './fetchConfig';

vi.mock('../parser/parser', () => ({
  parseStudyConfig: vi.fn(),
}));

describe('fetchConfig utils', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    vi.clearAllMocks();
  });

  it('getStudyConfig returns parsed config when study id matches sanitized config key', async () => {
    const globalConfig: GlobalConfig = {
      $schema: 'schema',
      configsList: ['My Study.json'],
      configs: {
        'My Study.json': {
          path: 'my-study/config.json',
        },
      },
    };
    const parsed = { components: {}, errors: [] };
    vi.mocked(parseStudyConfig).mockResolvedValue(parsed as never);
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: () => Promise.resolve('{"studyMetadata":{}}'),
    });

    const result = await getStudyConfig('My_Study', globalConfig);

    expect(global.fetch).toHaveBeenCalledWith(`${PREFIX}my-study/config.json`);
    expect(parseStudyConfig).toHaveBeenCalledWith('{"studyMetadata":{}}');
    expect(result).toEqual(parsed);
  });

  it('getStudyConfig returns null when no matching study id exists', async () => {
    const globalConfig: GlobalConfig = {
      $schema: 'schema',
      configsList: ['alpha'],
      configs: {
        alpha: {
          path: 'alpha/config.json',
        },
      },
    };

    const result = await getStudyConfig('missing', globalConfig);

    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(parseStudyConfig).not.toHaveBeenCalled();
  });

  it('fetchStudyConfigs returns a map keyed by configsList order', async () => {
    const globalConfig: GlobalConfig = {
      $schema: 'schema',
      configsList: ['alpha', 'beta'],
      configs: {
        alpha: { path: 'alpha/config.json' },
        beta: { path: 'beta/config.json' },
      },
    };
    vi.mocked(parseStudyConfig)
      .mockResolvedValueOnce({ id: 'alpha' } as never)
      .mockResolvedValueOnce({ id: 'beta' } as never);
    (global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ text: () => Promise.resolve('alpha-config') })
      .mockResolvedValueOnce({ text: () => Promise.resolve('beta-config') });

    const result = await fetchStudyConfigs(globalConfig);

    expect(global.fetch).toHaveBeenNthCalledWith(1, `${PREFIX}alpha/config.json`);
    expect(global.fetch).toHaveBeenNthCalledWith(2, `${PREFIX}beta/config.json`);
    expect(parseStudyConfig).toHaveBeenNthCalledWith(1, 'alpha-config');
    expect(parseStudyConfig).toHaveBeenNthCalledWith(2, 'beta-config');
    expect(result).toEqual({
      alpha: { id: 'alpha' },
      beta: { id: 'beta' },
    });
  });
});
