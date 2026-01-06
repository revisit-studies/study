export interface ParticipantCounts {
  total: number;
  completed: number;
  inProgress: number;
  rejected: number;
}

export interface ParticipantMismatchCounts{
  completed: { stored: number; calculated: number };
  inProgress: { stored: number; calculated: number };
  rejected: { stored: number; calculated: number };
}

export interface OverviewData {
  participantCounts: ParticipantCounts;
  avgTime: number;
  avgCleanTime: number;
  participantsWithInvalidCleanTimeCount: number;
  startDate: Date | null;
  endDate: Date | null;
  correctness: number;
  mismatchInfo?: ParticipantMismatchCounts;
}

export interface ComponentData {
  component: string;
  participants: number;
  avgTime: number;
  avgCleanTime: number;
  correctness: number;
}

export interface ResponseData {
  component: string;
  type: string;
  question: string;
  options: string;
  correctness: number;
}
