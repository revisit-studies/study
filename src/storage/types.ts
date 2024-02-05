import { StoredAnswer } from '../store/types';

export interface ParticipantData {
  participantId: string;
  participantConfigHash: string;
  sequence: string[],
  answers: Record<string, StoredAnswer>,
  searchParams: Record<string, string>,
}
