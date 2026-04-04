import { ParticipantData } from '../../types';

type AnsweredParticipantAnswerMetadata = {
  key: string;
  endTime: number;
};

function getAnsweredParticipantAnswerMetadata(answers: ParticipantData['answers']): AnsweredParticipantAnswerMetadata[] {
  return Object.entries(answers)
    .filter(([, answer]) => answer.endTime > -1)
    .map(([key, answer]) => ({
      key,
      endTime: answer.endTime,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function answeredParticipantAnswerMetadataMatches(
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

export function shouldPreferCachedParticipantData(
  cachedParticipantData: ParticipantData,
  remoteParticipantData: ParticipantData,
) {
  if (cachedParticipantData.completed !== remoteParticipantData.completed) {
    return cachedParticipantData.completed;
  }

  const cachedAnsweredAnswers = getAnsweredParticipantAnswerMetadata(cachedParticipantData.answers);
  const remoteAnsweredAnswers = getAnsweredParticipantAnswerMetadata(remoteParticipantData.answers);

  if (answeredParticipantAnswerMetadataMatches(cachedAnsweredAnswers, remoteAnsweredAnswers)) {
    return false;
  }

  if (cachedAnsweredAnswers.length !== remoteAnsweredAnswers.length) {
    return cachedAnsweredAnswers.length > remoteAnsweredAnswers.length;
  }

  return cachedAnsweredAnswers.some(
    (answer, index) => answer.endTime > remoteAnsweredAnswers[index].endTime,
  );
}
