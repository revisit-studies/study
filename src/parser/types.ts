interface StudyMetadata {
  title: string;
  version: string;
  author: string[];
  date: Date;
  description?: string;
  organization?: string[];
}

export interface StudyComponent {
  type:
  | 'consent'
  | 'training'
  | 'practice'
  | 'attentionTest'
  | 'trials'
  | 'survey'
  | 'end';
}

interface StudyComponents {
  [key: string]: StudyComponent;
}

export interface ConsentComponent extends StudyComponent {
  path: string;
  signatureRequired: boolean;
}

// TODO: add more properties to training component
export type TrainingComponent = StudyComponent;

export type ResponseBlockLocation = 'sidebar' | 'aboveStimulus' | 'belowStimulus';

export interface SteppedComponent extends StudyComponent {
  order: string[];
  response: Response[];
  trials: { [key: string]: Trial };
  nextButtonLocation?: ResponseBlockLocation;
  instructionLocation?: ResponseBlockLocation;
}

export type PracticeComponent = SteppedComponent

// TODO: add more properties to attention component
export type AttentionComponent = StudyComponent;

export type TrialsComponent = SteppedComponent

export interface SurveyComponent extends StudyComponent {
  response: Response[];
  nextButtonLocation: undefined;
}

export interface Trial {
  description: string;
  instruction: string;
  stimulus: Stimulus;
  response?: Response[];
  correctAnswer?: Answer[];
}

export interface Stimulus {
  type: 'react-component' | 'image' | 'javascript' | 'website';
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

export interface Response {
  id: string;
  prompt: string;
  type:
  | 'numerical'
  | 'shortText'
  | 'longText'
  | 'likert'
  | 'dropdown'
  | 'slider'
  | 'radio'
  | 'checkbox'
  | 'iframe';
  desc: string;
  required: boolean;
  options?: Option[];
  preset?: string;
  max?: number;
  min?: number;
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

type UIConfig = {
  contactEmail: string;
  helpTextPath?: string;
  logoPath: string;
  withProgressBar: boolean;
  autoDownloadStudy: boolean;
  autoDownloadTime: number;
  sidebar: boolean;
};

export interface StudyConfig {
  configVersion: number;
  studyMetadata: StudyMetadata;
  uiConfig: UIConfig;
  components: StudyComponents;
  sequence: (keyof StudyComponents)[];
}

export interface GlobalConfig {
  configsList: string[];
  configs: {
    [key: string]: { title: string; path: string; description: string };
  };
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
