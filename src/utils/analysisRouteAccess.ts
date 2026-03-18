import { GlobalConfig } from '../parser/types';
import { StorageEngine } from '../storage/engines/types';
import { resolveConfigKey } from './fetchConfig';

export async function shouldProtectAnalysisRoute(
  studyId: string,
  globalConfig: GlobalConfig,
  storageEngine: StorageEngine | undefined,
) {
  if (!storageEngine || !storageEngine.isCloudEngine()) {
    return false;
  }

  const resolvedStudyId = resolveConfigKey(studyId, globalConfig);
  if (!resolvedStudyId) {
    return true;
  }

  const modes = await storageEngine.getModes(resolvedStudyId);
  return !modes.dataSharingEnabled;
}
