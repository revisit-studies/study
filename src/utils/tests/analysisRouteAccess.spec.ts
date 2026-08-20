import {
  describe, expect, it, vi,
} from 'vitest';
import { GlobalConfig } from '../../parser/types';
import { shouldProtectAnalysisRoute } from '../analysisRouteAccess';
import { makeStorageEngine } from '../../tests/utils';

describe('shouldProtectAnalysisRoute', () => {
  const globalConfig: GlobalConfig = {
    $schema: '',
    configs: {
      'test-config-1.2': {
        path: 'test-config-1.2/config.json',
      },
    },
    configsList: ['test-config-1.2'],
  };

  it('uses the canonical config key when the route uses a sanitized study slug', async () => {
    const storageEngine = makeStorageEngine({
      getModes: vi.fn().mockResolvedValue({ dataSharingEnabled: false }),
      isCloudEngine: vi.fn().mockReturnValue(true),
    });

    const result = await shouldProtectAnalysisRoute('test-config-1_2', globalConfig, storageEngine);

    expect(result).toBe(true);
    expect(storageEngine.getModes).toHaveBeenCalledWith('test-config-1.2');
  });

  it('protects unknown study routes without creating a modes record', async () => {
    const storageEngine = makeStorageEngine({
      getModes: vi.fn(),
      isCloudEngine: vi.fn().mockReturnValue(true),
    });

    const result = await shouldProtectAnalysisRoute('missing-study', globalConfig, storageEngine);

    expect(result).toBe(true);
    expect(storageEngine.getModes).not.toHaveBeenCalled();
  });
});
