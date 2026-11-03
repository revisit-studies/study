import { ParticipantStatusCounts } from '../storage/participantStatus';

export interface ParticipantCounts extends ParticipantStatusCounts {
  total: number;
}

export interface OverviewData {
  participantCounts: ParticipantCounts;
  avgTime: number;
  avgCleanTime: number;
  participantsWithInvalidCleanTimeCount: number;
  startDate: Date | null;
  endDate: Date | null;
  correctness: number;
}

export interface ComponentData {
  configs?: string[];
  component: string;
  participants: number;
  avgTime: number;
  avgCleanTime: number;
  correctness: number;
}

export interface ResponseData {
  configs?: string[];
  component: string;
  type: string;
  question: string;
  options: string;
  correctness: number;
}
