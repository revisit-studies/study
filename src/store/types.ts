import { BaseIndividualComponent, ContainerComponent, StudyConfig } from '../parser/types';
import { StudyStore } from './index';

export type RootState = ReturnType<StudyStore['store']['getState']>;

export interface TrialResult {
  complete: boolean;
  answer: string | object | null;
  startTime: number;
  endTime: number;
}

export type PracticeResult = TrialResult;

export type TrialRecord = Record<string, TrialResult>;

export type PracticeRecord = Record<string, PracticeResult>;

export interface Step extends BaseIndividualComponent, ContainerComponent {
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
  [name: string]: TrialRecord | StudyIdentifiers | StudyConfig | Record<string, Step>;
  studyIdentifiers: StudyIdentifiers;
  config: StudyConfig;
  steps: Record<string, Step>;
}
