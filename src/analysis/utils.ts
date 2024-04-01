import { sanitizeStringForUrl } from '../utils/sanitizeStringForUrl';
import { GlobalConfig } from '../parser/types';
import { parseStudyConfig } from '../parser/parser';
import { getSequenceFlatMap } from '../utils/getSequenceFlatMap';
import { Sequence, StoredAnswer } from '../store/types';

async function fetchStudyConfig(configLocation: string, configKey: string) {
  const config = await (await fetch(`/${configLocation}`)).text();
  return parseStudyConfig(config, configKey);
}
export async function getConfig(studyId:string, globalConfig:GlobalConfig) {
  const configKey = globalConfig.configsList.find(
    (c) => sanitizeStringForUrl(c) === studyId,
  );
  if (configKey) {
    const configJSON = globalConfig.configs[configKey];
    return await fetchStudyConfig(`${configJSON.path}`, configKey);
  }
  return null;
}

export const isStudyCompleted = (sequence : Sequence, answers: Record<string, StoredAnswer>) => getSequenceFlatMap(sequence).every((step, idx) => {
  if (step === 'end') {
    return true;
  }
  return answers[`${step}_${idx}`] !== undefined;
});

export const isWithinRange = (answers:Record<string, StoredAnswer>, start: number, end: number) => {
  const timeStamps = Object.values(answers).map((ans) => ans.startTime);
  return Math.min(...timeStamps) >= start && Math.max(...timeStamps) <= end;
};
