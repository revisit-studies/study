import { StudyComponent, StudyConfig } from '../parser/types';
import { studyStoreCreator } from './index';

export type RootState = ReturnType<
  ReturnType<typeof studyStoreCreator>['store']['getState']
>;

export interface TrialResult {
  complete: boolean;
  answer: string | object | null;
}

export type PracticeResult = TrialResult;

export type TrialRecord = Record<string, TrialResult>;

export type PracticeRecord = Record<string, PracticeResult>;

export interface Step extends StudyComponent {
  complete: boolean;
  next: string | null;
}

export type StudyIdentifiers = {
  pid: string; // unique id for each participant
  study_id: string; // unique id for each study. Should be same for participants in the same study.
  session_id: string; // unique id for each session. Can be unique each time link is clicked.
};

export interface State {
  // Three identifiers given by the study platform
  studyIdentifiers: StudyIdentifiers;
  config: StudyConfig;
  consent?: { signature: string; timestamp: number };
  steps: Record<string, Step>;
  practice: Record<string, TrialRecord>;
  trials: Record<string, TrialRecord>;
  survey?: Record<string, string | number>;
  isStudyComplete: boolean;
  isStudyEnded: boolean;
}
