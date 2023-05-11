export interface StudyMetadata {
  title: string;
  version: string;
  authors: string[];
  date: string;
  description?: string;
  organization?: string[];
}

export const studyComponentTypes = [
  'questionnaire',
  'image',
  'markdown',
  'react-component',
  'website',
  'container',
] as const;
export type StudyComponentType = (typeof studyComponentTypes)[number];
export interface StudyComponent {
  type: StudyComponentType;
  nextButtonText?: string;
  response: Response[];
  nextButtonLocation?: ResponseBlockLocation;
  instructionLocation?: ResponseBlockLocation;
  path?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  style?: { [key: string]: any };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parameters?: { [key: string]: any };
  correctAnswer?: Answer[];
  meta?: Record<string, any>;
  description?: string;
  instruction?: string;
}

export interface StudyComponents {
  [key: string]: StudyComponent;
}

export const responseBlockLocations = [
  'sidebar',
  'aboveStimulus',
  'belowStimulus',
] as const;
export type ResponseBlockLocation = (typeof responseBlockLocations)[number];

export interface ContainerComponent extends StudyComponent {
  order: string[];
  components: { [key: string]: StudyComponent };
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
    [key: string]: {
      path: string;
    };
  };
}

export interface StudyConfigJSON {
  title: string;
  path: string;
  url: string;
  description: string;
}

/**
 * Helper type to avoid writing Type | undefined | null
 */
export type Nullable<T> = T | undefined | null;

/**
 * Helper type to make reading derived union and intersection types easier.
 * Purely asthetic
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
  /* eslint-disable */
} & {};

// Typecase helper for ContainerComponent
export function isContainerComponent(component: StudyComponent): component is ContainerComponent {
  return component.type === 'container';
}
