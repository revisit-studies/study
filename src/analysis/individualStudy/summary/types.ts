export interface ParticipantCounts{
  total: number;
  completed: number;
  inProgress: number;
  rejected: number;
}

export interface ComponentData {
  component: string;
  participants: number;
  avgTime: string;
  avgCleanTime: string;
  correctness: string;
}

export interface ResponseData {
  component: string;
  type: string;
  question: string;
  options: string;
  correctness: string;
}

export interface OverviewData {
  participantCounts: ParticipantCounts;
  avgTime: number
  avgCleanTime: number;
  startDate: Date | null;
  endDate: Date | null;
  correctnessStats: number;
  componentData: ComponentData[];
  responseData: ResponseData[];
}
