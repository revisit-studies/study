export interface ParticipantCounts{
  total: number;
  completed: number;
  inProgress: number;
  rejected: number;
}

export interface OverviewData {
  participantCounts: ParticipantCounts;
  startDate: Date | null;
  endDate: Date | null;
  avgTime: number;
  avgCleanTime: number;
  correctness: number;
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
