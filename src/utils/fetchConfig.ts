import { sanitizeStringForUrl } from './sanitizeStringForUrl';
import { GlobalConfig, ParsedConfig, StudyConfig } from '../parser/types';
import { parseStudyConfig } from '../parser/parser';
import { PREFIX } from './Prefix';

function createConfigLoadError(message: string): ParsedConfig<StudyConfig> {
  return {
    errors: [{
      message,
      instancePath: 'root',
      params: { action: 'Check that the config path exists and the deployment is serving it' },
      category: 'invalid-config',
    }],
    warnings: [],
  } as unknown as ParsedConfig<StudyConfig>;
}

async function fetchStudyConfig(configLocation: string): Promise<ParsedConfig<StudyConfig>> {
  let configText: string;

  try {
    const response = await fetch(`${PREFIX}${configLocation}`);
    if (!response.ok) {
      return createConfigLoadError(
        `Unable to load study config \`${configLocation}\`: ${response.status} ${response.statusText || 'Request failed'}`,
      );
    }

    configText = await response.text();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return createConfigLoadError(`Unable to load study config \`${configLocation}\`: ${detail}`);
  }

  return await parseStudyConfig(configText);
}

function sanitizeStringForUrlLegacy(fileName: string) {
  const groups = fileName.split('/') || [];
  const last = groups[groups.length - 1];
  return last
    .replace(/\.[^.]+$/, '')
    .replace('.', '_')
    .replace(' ', '_')
    .replace('/', '_');
}

export function resolveConfigKey(studyId: string, globalConfig: GlobalConfig): string | null {
  if (Object.prototype.hasOwnProperty.call(globalConfig.configs, studyId)) {
    return studyId;
  }

  return globalConfig.configsList.find(
    (configName) => sanitizeStringForUrl(configName) === studyId || sanitizeStringForUrlLegacy(configName) === studyId,
  ) || null;
}

export async function getStudyConfig(studyId: string, globalConfig: GlobalConfig) {
  const configKey = resolveConfigKey(studyId, globalConfig);
  if (configKey) {
    const configJSON = globalConfig.configs[configKey];
    return await fetchStudyConfig(`${configJSON.path}`);
  }
  return null;
}

export async function fetchStudyConfigs(globalConfig: GlobalConfig) {
  const studyConfigs: Record<string, ParsedConfig<StudyConfig> | null> = {};
  const configPromises = globalConfig.configsList
    .map(async (configId) => getStudyConfig(configId, globalConfig));

  const configs = await Promise.all(configPromises);

  globalConfig.configsList.forEach((configId, idx) => {
    studyConfigs[configId] = configs[idx];
  });

  return studyConfigs;
}
