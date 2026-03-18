import {
  describe, expect, it, vi,
} from 'vitest';
import { GlobalConfig } from '../parser/types';
import { StorageEngine } from '../storage/engines/types';
import { shouldProtectAnalysisRoute } from './analysisRouteAccess';

describe('shouldProtectAnalysisRoute', () => {
  const globalConfig: GlobalConfig = {
    $schema: '',
    configs: {
      'screening-gpt-5.2': {
        path: 'screening-gpt-5.2/config.json',
      },
    },
    configsList: ['screening-gpt-5.2'],
  };

  it('uses the canonical config key when the route uses a sanitized study slug', async () => {
    const storageEngine = {
      getModes: vi.fn().mockResolvedValue({ dataSharingEnabled: false }),
      isCloudEngine: vi.fn().mockReturnValue(true),
    } as unknown as StorageEngine;

    const result = await shouldProtectAnalysisRoute('screening-gpt-5_2', globalConfig, storageEngine);

    expect(result).toBe(true);
    expect(storageEngine.getModes).toHaveBeenCalledWith('screening-gpt-5.2');
  });

  it('protects unknown study routes without creating a modes record', async () => {
    const storageEngine = {
      getModes: vi.fn(),
      isCloudEngine: vi.fn().mockReturnValue(true),
    } as unknown as StorageEngine;

    const result = await shouldProtectAnalysisRoute('missing-study', globalConfig, storageEngine);

    expect(result).toBe(true);
    expect(storageEngine.getModes).not.toHaveBeenCalled();
  });
});
