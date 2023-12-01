import { StoredAnswer } from '../store/types';

export interface ParticipantData {
  participantId: string;
  sequence: string[],
  answers: Record<string, StoredAnswer>,
}
