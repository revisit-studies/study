import { ProvenanceGraph } from '@trrack/core/graph/graph-slice';
import { StudyConfig } from '../parser/types';
import { StudyStore } from './store';

export type RootState = ReturnType<StudyStore['store']['getState']>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TrrackedProvenance = ProvenanceGraph<any, any, any>;

export type ValidationStatus = { valid: boolean, values: object }
export type TrialValidation = Record<
  string,
  {
    aboveStimulus: ValidationStatus;
    belowStimulus: ValidationStatus;
    sidebar: ValidationStatus;
    provenanceGraph?: TrrackedProvenance;
  }
>;

export interface TrrackedState {
  studyId: string;
  answers: Record<string, StoredAnswer>;
  sequence: string[]
}

export interface StoredAnswer {
  answer: Record<string, Record<string, unknown>>;
  startTime: number;
  endTime: number;
  provenanceGraph?: TrrackedProvenance,
}

export interface StimulusParams<T> {
  parameters: T;
  setAnswer: ({ status, provenanceGraph, answers }: { status: boolean, provenanceGraph?: TrrackedProvenance, answers: Record<string, any> }) => void
}


export interface UnTrrackedState {
  config: StudyConfig;
  showAdmin: boolean;
  showHelpText: boolean;
  trialValidation: TrialValidation;
  trrackExists: boolean;
  iframeAnswers: string[];
}
