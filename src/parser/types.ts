// Global config types
export interface GlobalConfig {
  configs: {
    [key: string]: {
      path: string;
    };
  };
  configsList: string[];
}

// Study config types
export interface StudyMetadata {
  title: string;
  version: string;
  authors: string[];
  date: string;
  description: string;
  organizations: string[];
}

export type UIConfig = {
  contactEmail: string;
  helpTextPath?: string;
  logoPath: string;
  withProgressBar: boolean;
  autoDownloadStudy?: boolean;
  autoDownloadTime?: number;
  studyEndMsg?: string;
  sidebar: boolean;
};

export interface Option {
  label: string;
  value: string | number;
}

interface BaseResponse {
  // Required fields for all responses
  id: string;
  prompt: string;
  required: boolean;
  location: ResponseBlockLocation;
}

export interface NumericalResponse extends BaseResponse {
  type: 'numerical';
  placeholder?: string;
  min?: number;
  max?: number;
}

export interface ShortTextResponse extends BaseResponse {
  type: 'shortText';
  placeholder?: string;
}

export interface LongTextResponse extends BaseResponse {
  type: 'longText';
  placeholder?: string;
}

export interface LikertResponse extends BaseResponse {
  type: 'likert';
  preset: number;
  desc?: string;
  rightLabel?: string;
  leftLabel?: string;
}

export interface DropdownResponse extends BaseResponse {
  type: 'dropdown';
  placeholder?: string;
  options: Option[];
}

export interface SliderResponse extends BaseResponse {
  type: 'slider';
  options: Option[];
}

export interface RadioResponse extends BaseResponse {
  type: 'radio';
  options: Option[];
  rightLabel?: string;
  leftLabel?: string;
}

export interface CheckboxResponse extends BaseResponse {
  type: 'checkbox';
  options: Option[];
}

export interface IFrameResponse extends BaseResponse {
  type: 'iframe';
}

export type Response = NumericalResponse | ShortTextResponse | LongTextResponse | LikertResponse | DropdownResponse | SliderResponse | RadioResponse | CheckboxResponse | IFrameResponse;


export interface Answer {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  answer: any;
  acceptableLow?: number;
  acceptableHigh?: number;
  answerCallback?: string;
  answerRegex?: string;
}

export const responseBlockLocations = [
  'sidebar',
  'aboveStimulus',
  'belowStimulus',
] as const;
export type ResponseBlockLocation = (typeof responseBlockLocations)[number];

interface BaseIndividualComponent {
  // Required fields for all components
  response: Response[];

  // Optional fields
  nextButtonText?: string;
  nextButtonLocation?: ResponseBlockLocation;
  instructionLocation?: ResponseBlockLocation;
  correctAnswer?: Answer[];
  meta?: Record<string, unknown>;
  description?: string;
  instruction?: string;
  title?: string;
}

export interface MarkdownComponent extends BaseIndividualComponent {
  type: 'markdown';
  path: string;
}

export interface ReactComponent extends BaseIndividualComponent {
  type: 'react-component';
  path: string;
  parameters?: Record<string, unknown>;
}

export interface ImageComponent extends BaseIndividualComponent {
  type: 'image';
  path: string;
  style?: Record<string, string>;
}

export interface WebsiteComponent extends BaseIndividualComponent {
  type: 'website';
  path: string;
  style?: Record<string, string>;
}

export interface QuestionnaireComponent extends BaseIndividualComponent {
  type: 'questionnaire';
}

export type IndividualComponent = MarkdownComponent | ReactComponent | ImageComponent | WebsiteComponent | QuestionnaireComponent;

export interface ContainerComponent {
  type: 'container';
  order: string[];
  components: StudyComponents;
}

export type StudyComponent = IndividualComponent | ContainerComponent;

export interface StudyComponents {
  [key: string]: StudyComponent;
}

export interface StudyConfig {
  $schema: string;
  studyMetadata: StudyMetadata;
  uiConfig: UIConfig;
  components: StudyComponents;
  sequence: string[];
}

/**
 * Helper type to avoid writing Type | undefined | null
 */
export type Nullable<T> = T | undefined | null;

/**
 * Helper type to make reading derived union and intersection types easier.
 * Purely aesthetic
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
  /* eslint-disable */
} & {};

// Typecase helper for ContainerComponent
export function isContainerComponent(component: StudyComponent): component is ContainerComponent {
  return component.type === 'container';
}
