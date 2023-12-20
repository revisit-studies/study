import { ProvenanceGraph } from '@trrack/core/graph/graph-slice';
import { StudyConfig } from '../parser/types';
import { StudyStore } from './store';

export type RootState = ReturnType<StudyStore['store']['getState']>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TrrackedProvenance = ProvenanceGraph<any, any>;

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

export interface StoredAnswer {
  answer: Record<string, Record<string, unknown>>;
  startTime: number;
  endTime: number;
  provenanceGraph?: TrrackedProvenance,
}

export interface StimulusParams<T> {
  parameters: T;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setAnswer: ({ status, provenanceGraph, answers }: { status: boolean, provenanceGraph?: TrrackedProvenance, answers: Record<string, any> }) => void
}


export interface StoreState {
  studyId: string;
  answers: Record<string, StoredAnswer>;
  sequence: string[]
  config: StudyConfig;
  showAdmin: boolean;
  showHelpText: boolean;
  alertModal: { show: boolean, message: string };
  trialValidation: TrialValidation;
  iframeAnswers: string[];
}

// timestamp, event type, event data
type CopyEvent = [number, 'copy', string];
type DragEvent = [number, 'drag', number[]];
type WheelEvent = [number, 'wheel', number[]];
type FocusEvent = [number, 'focus', string];
type InputEvent = [number, 'input', string];
type KeypressEvent = [number, 'keypress', string];
type ClickEvent = [number, 'click', number[]];
type SelectionEvent = [number, 'selection', string];
type MouseMoveEvent = [number, 'mousemove', number[]];
type ResizeEvent = [number, 'resize', number[]];
type ScrollEvent = [number, 'scroll', number[]];
type VisibilityEvent = [number, 'visibility', string];

export type EventType = MouseMoveEvent | ClickEvent | KeypressEvent | ScrollEvent | CopyEvent | DragEvent | WheelEvent | FocusEvent | InputEvent | SelectionEvent | ResizeEvent | VisibilityEvent;
