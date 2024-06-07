import { sanitizeStringForUrl } from './sanitizeStringForUrl';
import { GlobalConfig, ParsedStudyConfig } from '../parser/types';
import { parseStudyConfig } from '../parser/parser';
import { PREFIX } from './Prefix';

async function fetchStudyConfig(configLocation: string) {
  const config = await (await fetch(`${PREFIX}${configLocation}`)).text();
  return parseStudyConfig(config);
}

export async function getStudyConfig(studyId: string, globalConfig: GlobalConfig) {
  const configKey = globalConfig.configsList.find(
    (c) => sanitizeStringForUrl(c) === studyId,
  );
  if (configKey) {
    const configJSON = globalConfig.configs[configKey];
    return await fetchStudyConfig(`${configJSON.path}`);
  }
  return null;
}

export async function fetchStudyConfigs(globalConfig: GlobalConfig) {
  const studyConfigs: Record<string, ParsedStudyConfig | null> = {};
  const configPromises = globalConfig.configsList
    .filter((configId) => (import.meta.env.VITE_CI === 'true' ? true : !globalConfig.configs[configId].test))
    .map(async (configId) => getStudyConfig(configId, globalConfig));

  const configs = await Promise.all(configPromises);

  globalConfig.configsList.forEach((configId, idx) => {
    studyConfigs[configId] = configs[idx];
  });
  return studyConfigs;
}
