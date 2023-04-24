interface StudyMetadata {
  title: string;
  version: string;
  author: string[];
  date: Date;
  description?: string;
  organization?: string[];
  contactEmail: string;
  helpTextPath?: string;
  logoPath: string;
  withProgressBar: boolean;
}

export interface StudyComponent {
  type:
  | 'consent'
  | 'training'
  | 'practice'
  | 'attention-test'
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

export type TrainingComponent = StudyComponent;

export interface PracticeComponent extends StudyComponent {
  response: Response[];
  order: string[];
  trials: { [key: string]: Trial };
}

export type AttentionComponent = StudyComponent;

export interface TrialsComponent extends StudyComponent {
  response: Response[];
  order: string[];
  trials: { [key: string]: Trial };
  nextButtonLocation?: string;
  instructionLocation?: string;
}

export interface SurveyComponent extends StudyComponent {
  response: Response[];
  nextButtonLocation: undefined;
}

export interface Trial {
  description: string;
  instruction: string;
  stimulus: Stimulus;
  responses: Response[];
  answers?: Answer[];
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

// Add types for stimulus

export interface Option {
  label: string;
  value: string | number;
}
export type ResponseLocation = 'sidebar' | 'aboveStimulus' | 'belowStimulus';
export interface Response {
  id: string;
  prompt: string;
  type:
  | 'numerical'
  | 'short-text'
  | 'long-text'
  | 'likert'
  | 'dropdown'
  | 'slider'
  | 'radio'
  | 'checkbox';
  desc: string;
  required: boolean;
  options?: Option[];
  preset?: string;
  max?: number;
  min?: number;
  location?: ResponseLocation;
}

// Add types for response

export interface Answer {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  answer: any;
  'acceptable-low'?: number;
  'acceptable-high'?: number;
  'answer-callback'?: string;
  'answer-regex'?: string;
}

// Add types for answers

type UIConfig = {
  autoDownloadStudy: boolean;
  autoDownloadTime: number;
  sidebar: boolean;
};

export interface StudyConfig {
  'config-version': number;
  'study-metadata': StudyMetadata;
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
