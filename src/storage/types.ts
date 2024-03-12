import { Sequence, StoredAnswer } from '../store/types';

export interface ParticipantData {
  participantId: string;
  participantConfigHash: string;
  sequence: Sequence;
  answers: Record<string, StoredAnswer>;
  searchParams: Record<string, string>;
}
