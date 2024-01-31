import { ProvenanceGraph } from '@trrack/core/graph/graph-slice';
import { StudyConfig } from '../parser/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TrrackedProvenance = ProvenanceGraph<any, any>;

// timestamp, event type, event data
type FocusEvent = [number, 'focus', string];
type InputEvent = [number, 'input', string];
type KeypressEvent = [number, 'keypress', string];
type MouseDownEvent = [number, 'mousedown', number[]];
type MouseUpEvent = [number, 'mouseup', number[]];
type MouseMoveEvent = [number, 'mousemove', number[]];
type ResizeEvent = [number, 'resize', number[]];
type ScrollEvent = [number, 'scroll', number[]];
type VisibilityEvent = [number, 'visibility', string];
export type EventType = MouseMoveEvent | MouseDownEvent | MouseUpEvent | KeypressEvent | ScrollEvent | FocusEvent | InputEvent | ResizeEvent | VisibilityEvent;

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
  windowEvents: EventType[];
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
