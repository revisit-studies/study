import { sanitizeStringForUrl } from './sanitizeStringForUrl';
import { GlobalConfig } from '../parser/types';
import { parseStudyConfig } from '../parser/parser';
import { PREFIX } from './Prefix';

export async function fetchStudyConfig(configLocation: string, configKey: string) {
  const config = await (await fetch(`${PREFIX}${configLocation}`)).text();
  return parseStudyConfig(config, configKey);
}

export async function getStudyConfig(studyId: string, globalConfig: GlobalConfig) {
  const configKey = globalConfig.configsList.find(
    (c) => sanitizeStringForUrl(c) === studyId,
  );
  if (configKey) {
    const configJSON = globalConfig.configs[configKey];
    return await fetchStudyConfig(`${configJSON.path}`, configKey);
  }
  return null;
}
