import { ProvenanceGraph } from '@trrack/core/graph/graph-slice';
import { BaseIndividualComponent, StudyConfig } from '../parser/types';
import { StudyStore } from './store';
import { NodeId } from '@trrack/core';

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

export interface Step extends BaseIndividualComponent {
  complete: boolean;
  next: string | null;
}

export type StudyIdentifiers = {
  pid: string; // unique id for each participant
  study_id: string; // unique id for each study. Should be same for participants in the same study.
  session_id: string; // unique id for each session. Can be  unique each time link is clicked.
};

export interface TrrackedState {
  // Three identifiers given by the study platform
  studyIdentifiers: StudyIdentifiers;
  [name: string]: TrialRecord | StudyIdentifiers | StudyConfig | Record<string, Step> | string[];
  order: string[]
}


export interface StimulusParams<T> {
  parameters: T;
  trialId: string;
  updateProvenance: (graph: ProvenanceGraph<any, any, any>) => void;
  setAnswer: ({trialId, status, provenanceRoot, answers} : {trialId: string, status: boolean, provenanceRoot?: NodeId, answers: Record<string, any>}) => void
}

export type TrrackedAnswer = Record<string, unknown>;
