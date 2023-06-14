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
  location: ResponseBlockLocation;
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

export type IndividualComponent = (MarkdownComponent | ReactComponent | ImageComponent | WebsiteComponent | QuestionnaireComponent);

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
