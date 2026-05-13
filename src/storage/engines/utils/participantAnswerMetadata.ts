import { ParticipantData } from '../../types';

export type AnsweredParticipantAnswerMetadata = {
  key: string;
  endTime: number;
};

export function getAnsweredParticipantAnswerMetadata(
  answers: ParticipantData['answers'],
): AnsweredParticipantAnswerMetadata[] {
  return Object.entries(answers)
    .filter(([, answer]) => answer.endTime > -1)
    .map(([key, answer]) => ({
      key,
      endTime: answer.endTime,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function answeredParticipantAnswerMetadataMatches(
  localAnswers: AnsweredParticipantAnswerMetadata[],
  persistedAnswers: AnsweredParticipantAnswerMetadata[],
) {
  if (localAnswers.length !== persistedAnswers.length) {
    return false;
  }

  return localAnswers.every(
    (answer, index) => answer.key === persistedAnswers[index].key
      && answer.endTime === persistedAnswers[index].endTime,
  );
}
