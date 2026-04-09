import { ParticipantData } from '../../types';
import {
  answeredParticipantAnswerMetadataMatches,
  getAnsweredParticipantAnswerMetadata,
} from './participantAnswerMetadata';

export function shouldPreferCachedParticipantData(
  cachedParticipantData: ParticipantData,
  remoteParticipantData: ParticipantData,
) {
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
