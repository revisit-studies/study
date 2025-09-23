/* eslint-disable @typescript-eslint/no-explicit-any */
import { ProvenanceGraph } from '@trrack/core/graph/graph-slice';
import type {
  Answer, ConfigResponseBlockLocation, ParticipantData, ResponseBlockLocation, SkipConditions, StringOption, StudyConfig, ValueOf,
} from '../parser/types';
import { type REVISIT_MODE } from '../storage/engines/types';

/**
 * The ParticipantMetadata object contains metadata about the participant. This includes the user agent, resolution, language, and IP address. This object is used to store information about the participant that is not directly related to the study itself.
 */
export interface ParticipantMetadata {
  /** The user agent of the participant. This is a string that contains information about the participants browser and operating system. */
  userAgent: string;
  /** The resolution of the participants screen. This is an object with two keys, "width" and "height". The values are the width and height of the participants screen in pixels. */
  resolution: Record<string, string | number>;
  /** The language of the participants browser. */
  language: string;
  /** The IP address of the participant. */
  ip: string | null;
}

export type TrrackedProvenance = ProvenanceGraph<any, any>;

// timestamp, event type, event data
type FocusEvent = [number, 'focus', string];
type InputEvent = [number, 'input', string];
type KeydownEvent = [number, 'keydown', string];
type KeyupEvent = [number, 'keyup', string];
type MouseDownEvent = [number, 'mousedown', number[]];
type MouseUpEvent = [number, 'mouseup', number[]];
type MouseMoveEvent = [number, 'mousemove', number[]];
type ResizeEvent = [number, 'resize', number[]];
type ScrollEvent = [number, 'scroll', number[]];
type VisibilityEvent = [number, 'visibility', string];
export type EventType = MouseMoveEvent | MouseDownEvent | MouseUpEvent | KeydownEvent | KeyupEvent | ScrollEvent | FocusEvent | InputEvent | ResizeEvent | VisibilityEvent;

export type ValidationStatus = { valid: boolean, values: object }
export type TrialValidation = Record<
  string,
  {
    aboveStimulus: ValidationStatus;
    belowStimulus: ValidationStatus;
    sidebar: ValidationStatus;
    stimulus: ValidationStatus;
    provenanceGraph: Record<ResponseBlockLocation, TrrackedProvenance | undefined>;
  }
>;

/**
The StoredAnswer object is a data structure describing the participants interaction with an individual component. It is the data structure used as values of the `answers` object of [ParticipantData](../ParticipantData). The general structure for this is below:

```js
{
  "answer": {
    "barChart": [
      1.3
    ]
  },
  "startTime": 1711641174858,
  "endTime": 1711641178836,
  "windowEvents": [
    ...
  ]
}
```
The `answer` object here uses the "id" in the [Response](../BaseResponse) list of the component in your [StudyConfiguration](../StudyConfig) as its keys. It then contains a list of the answers given. You are also given a start and end time for the participants interaction with the component. Lastly, a set of windowEvents is given. Below is an example of the windowEvents list.

Each item in the window event is given a time, a position an event name, and some extra information for the event (for mouse events, this is the location).
*/
export interface StoredAnswer {
  /** Object whose keys are the "id"s in the Response list of the component in the StudyConfig and whose value is the inputted value from the participant. */
  answer: Record<string, string | number | boolean | string[]>;

  componentName: string;
  /** The order of the trial in the sequence. */
  trialOrder: string;
  /** Object whose keys are the "id"s in the Response list of the component in the StudyConfig and whose value is a list of incorrect inputted values from the participant. Only relevant for trials with `provideFeedback` and correct answers enabled. */
  incorrectAnswers: Record<string, { id: string, value: unknown[] }>;
  /** Time that the user began interacting with the component in epoch milliseconds. */
  startTime: number;
  /** Time that the user ended interaction with the component in epoch milliseconds. */
  endTime: number;
  /** The entire provenance graph exported from a Trrack instance from a React component. This will only be present if you are using React components and you're utilizing [Trrack](https://apps.vdl.sci.utah.edu/trrack) */
  provenanceGraph: Record<ResponseBlockLocation, TrrackedProvenance | undefined>;
  /** A list containing the time (in epoch milliseconds), the action (focus, input, kepress, mousedown, mouseup, mousemove, resize, scroll or visibility), and then either a coordinate pertaining to where the event took place on the screen or string related to such event. Below is an example of the windowEvents list.
```js
"windowEvents": [
  [
    1711641174878,
    "mousedown",
    [ 1843, 286 ]
  ],
  [
    1711641174878,
    "focus",
    "BUTTON"
  ],
  [
    1711641174935,
    "mouseup",
    [ 1843, 286 ]
  ],
  .
  .
  .
  [
    1711641178706,
    "mousemove",
    [ 1868, 728 ]
  ]
]
```
   */
  windowEvents: EventType[];
  /** A boolean value that indicates whether the participant timed out on this question. */
  timedOut: boolean;
  /** A counter indicating how many times participants opened the help tab during a task. Clicking help, or accessing the tab via answer feedback on an incorrect answer both are included in the counter. */
  helpButtonClickedCount: number;
  /** The parameters that were passed to the component. */
  parameters: Record<string, any>;
  /** The correct answer for the component. */
  correctAnswer: Answer[];
  /** The order of question options in the component. */
  optionOrders: Record<string, StringOption[]>;
  /** The order of the questions in a matrix component. */
  questionOrders: Record<string, string[]>;
  /** The order of the form elements in a base response. */
  formOrder?: Record<string, string[]>;
}

export interface JumpFunctionParameters<T> {
  answers: ParticipantData['answers'],
  customParameters: T,
  currentStep: number,
  currentBlock: string,
}

export interface JumpFunctionReturnVal {
  component: string | null,
  parameters?: Record<string, any>,
  correctAnswer?: Answer[],
}

export interface StimulusParams<T, S = never> {
  parameters: T;
  provenanceState?: S;
  answers: ParticipantData['answers'];
  setAnswer: ({ status, provenanceGraph, answers }: { status: boolean, provenanceGraph?: TrrackedProvenance, answers: StoredAnswer['answer'] }) => void
}

export interface Sequence {
  id?: string;
  orderPath: string;
  order: string;
  components: (string | Sequence)[];
  skip?: SkipConditions;
}

export type FormElementProvenance = { form: StoredAnswer['answer'] };
export interface StoreState {
  studyId: string;
  participantId: string;
  isRecording: boolean;
  answers: ParticipantData['answers'];
  sequence: Sequence;
  config: StudyConfig;
  showStudyBrowser: boolean;
  showHelpText: boolean;
  alertModal: { show: boolean, message: string };
  trialValidation: TrialValidation;
  reactiveAnswers: Record<string, ValueOf<StoredAnswer['answer']>>;
  metadata: ParticipantMetadata;
  analysisProvState: Record<ConfigResponseBlockLocation, FormElementProvenance | undefined> & { stimulus: unknown | undefined };
  analysisIsPlaying: boolean;
  analysisHasAudio: boolean;
  analysisHasScreenRecording: boolean;
  analysisCanPlayScreenRecording: boolean;
  provenanceJumpTime: number;
  analysisHasProvenance: boolean;
  modes: Record<REVISIT_MODE, boolean>;
  matrixAnswers: Record<string, Record<string, string>>;
  funcSequence: Record<string, string[]>;
}
