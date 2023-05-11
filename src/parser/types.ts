export interface StudyMetadata {
  title: string;
  version: string;
  authors: string[];
  date: string;
  description?: string;
  organization?: string[];
}

export const studyComponentTypes = [
  'consent',
  'training',
  'practice',
  'attentionTest',
  'trials',
  'survey',
  'end',
] as const;
export type StudyComponentType = (typeof studyComponentTypes)[number];
export interface StudyComponent {
  type: StudyComponentType;
}

export interface StudyComponents {
  [key: string]: StudyComponent;
}

export interface ConsentComponent extends StudyComponent {
  path: string;
  signatureRequired: boolean;
}

// TODO: add more properties to training component
export interface TrainingComponent extends StudyComponent {
  stimulus: Stimulus;
}

export const responseBlockLocations = [
  'sidebar',
  'aboveStimulus',
  'belowStimulus',
] as const;
export type ResponseBlockLocation = (typeof responseBlockLocations)[number];

export interface SteppedComponent extends StudyComponent {
  order: string[];
  response: Response[];
  trials: { [key: string]: Trial };
  nextButtonLocation?: ResponseBlockLocation;
  instructionLocation?: ResponseBlockLocation;
}

export type PracticeComponent = SteppedComponent;

// TODO: add more properties to attention component
export type AttentionComponent = StudyComponent;

export type TrialsComponent = SteppedComponent;

export interface SurveyComponent extends StudyComponent {
  response: Response[];
  nextButtonLocation?: null;
}

export interface Trial {
  meta?: Record<string,any>;
  description: string;
  instruction: string;
  stimulus: Stimulus;
  response?: Response[];
  correctAnswer?: Answer[];
}

export const stimulusTypes = [
  'react-component',
  'image',
  'javascript',
  'website',
] as const;
export type StimulusType = (typeof stimulusTypes)[number];
export interface Stimulus {
  type: StimulusType;
  path?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  style?: { [key: string]: any };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parameters?: { [key: string]: any };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  correctAnswer?: any;
}

export interface Option {
  label: string;
  value: string | number;
}

export const responseTypes = [
  'numerical',
  'shortText',
  'longText',
  'likert',
  'dropdown',
  'slider',
  'radio',
  'checkbox',
  'iframe',
] as const;
export type ResponseType = (typeof responseTypes)[number];
export interface Response {
  id: string;
  prompt: string;
  type: ResponseType;
  desc: string;
  required: boolean;
  options?: Option[];
  preset?: string;
  max?: number;
  min?: number;
  leftLabel?: string;
  rightLabel?: string;
  location?: ResponseBlockLocation;
}

export interface Answer {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  answer: any;
  acceptableLow?: number;
  acceptableHigh?: number;
  answerCallback?: string;
  answerRegex?: string;
}

export type UIConfig = {
  helpImgPath?: string;
  contactEmail: string;
  helpTextPath?: string;
  logoPath: string;
  withProgressBar: boolean;
  autoDownloadStudy?: boolean;
  autoDownloadTime?: number;
  studyEndMsg?: string;
  sidebar: boolean;
};

export interface StudyConfig {
  configVersion: number;
  studyMetadata: StudyMetadata;
  uiConfig: UIConfig;
  components: StudyComponents;
  sequence: string[];
}

export interface GlobalConfig {
  configsList: string[];
  configs: {
    [key: string]: { title: string; path: string; description: string };
  };
}

export interface StudyConfigJSON {
  title: string;
  path: string;
  url: string;
  description: string;
}

// Typecasting functions
export function isTrialsComponent(
  component: StudyComponent
): component is TrialsComponent {
  return component.type === 'trials';
}

export function isPracticeComponent(
  component: StudyComponent
): component is PracticeComponent {
  return component.type === 'practice';
}

/**
 * Helper type to avoid writing Type | undefined | null
 */
export type Nullable<T> = T | undefined | null;
