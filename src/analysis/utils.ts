import { DateRangePickerValue } from '@mantine/dates';
import { Sequence, StoredAnswer } from '../store/types';
import { ParticipantData } from '../storage/types';
import { getSequenceFlatMap } from '../utils/getSequenceFlatMap';

export const flattenSequence = (seq: Sequence): string[] => {
  const result: string[] = [];

  for (const component of seq.components) {
    if (typeof component === 'string') {
      result.push(component);
    } else {
      result.push(...flattenSequence(component));
    }
  }
  return result;
};

export const isStudyCompleted = (participant: ParticipantData) => getSequenceFlatMap(participant.sequence).every((step, idx) => {
  if (step === 'end') {
    return true;
  }
  return participant.answers[`${step}_${idx}`] !== undefined;
});

export const isWithinRange = (answers: Record<string, StoredAnswer>, rangeTime: DateRangePickerValue) => {
  const timeStamps = Object.values(answers).map((ans) => [ans.startTime, ans.endTime]).flat();
  if (rangeTime[0] === null || rangeTime[1] === null) {
    return false;
  }
  return Math.min(...timeStamps) >= rangeTime[0].getTime() && Math.max(...timeStamps) <= rangeTime[1].getTime();
};

export function toDisplayData(milliseconds:number) {
  const minutes = Math.floor(milliseconds / (1000 * 60));
  const seconds = ((milliseconds % (1000 * 60)) / 1000).toFixed(2);
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function extractTrialName(trial: string) {
  const [name] = trial.split('_');
  return name;
}
