/**
 * The GlobalConfig is used to generate the list of available studies in the UI.
 * This list is displayed on the landing page when running the app.
*/ 
export interface GlobalConfig {
  configs: {
    [key: string]: {
      path: string;
    };
  };
  configsList: string[];
}

/** 
 * The StudyMetadata is used to describe certain properties of a study.
 * Some of this data is displayed on the landing page when running the app, such as the title and description.
 * This data is also included in the data file that is downloaded at the end of the study, to help identify the study and version.
*/
export interface StudyMetadata {
  title: string;
  version: string;
  authors: string[];
  date: string;
  description: string;
  organizations: string[];
}

/**
 * The UIConfig is used to configure the UI of the app.
 * This includes the logo, contact email, and whether to show a progress bar.
 * The UIConfig is also used to configure the sidebar, which can be used to display the task instructions and capture responses.
 */
export interface UIConfig {
  contactEmail: string;
  helpTextPath?: string;
  logoPath: string;
  withProgressBar: boolean;
  autoDownloadStudy?: boolean;
  autoDownloadTime?: number;
  studyEndMsg?: string;
  sidebar: boolean;
}

/**
 * The Option interface is used to define the options for a dropdown, slider, radio, or checkbox response.
 * The label is the text that is displayed to the user, and the value is the value that is stored in the data file.
 * The Option interface is used in the Response interface.
 */
export interface Option {
  label: string;
  value: string | number;
}

/**
 * The BaseResponse interface is used to define the required fields for all responses.
 * Other Response interfaces inherit properties from the BaseResponse interface.
 * Therefore, all responses must include these properties.
 */
export interface BaseResponse {
  // Required fields for all responses
  id: string;
  prompt: string;
  required: boolean;
  location: ResponseBlockLocation;
  requiredValue?: unknown;
  requiredLabel?: string;
}

/**
 * The NumericalResponse interface is used to define the properties of a numerical response.
 * NumericalResponses render as a text input that only accepts numbers, and can optionally have a min and max value, or a placeholder.
 */
export interface NumericalResponse extends BaseResponse {
  type: 'numerical';
  placeholder?: string;
  min?: number;
  max?: number;
}

/**
 * The ShortTextResponse interface is used to define the properties of a short text response.
 * ShortTextResponses render as a text input that accepts any text and can optionally have a placeholder.
 */
export interface ShortTextResponse extends BaseResponse {
  type: 'shortText';
  placeholder?: string;
}

/**
 * The LongTextResponse interface is used to define the properties of a long text response.
 * LongTextResponses render as a text area that accepts any text and can optionally have a placeholder.
 */
export interface LongTextResponse extends BaseResponse {
  type: 'longText';
  placeholder?: string;
}

/**
 * The LikertResponse interface is used to define the properties of a likert response.
 * LikertResponses render as radio buttons with a user specified number of options, which can be controlled through the preset. For example, preset: 5 will render 5 radio buttons, and preset: 7 will render 7 radio buttons.
 * LikertResponses can also have a description, and left and right labels.
 * The left and right labels are used to label the left and right ends of the likert scale with values such as 'Strongly Disagree' and 'Strongly Agree'.
 */
export interface LikertResponse extends BaseResponse {
  type: 'likert';
  preset: number;
  desc?: string;
  leftLabel?: string;
  rightLabel?: string;
}

/**
 * The DropdownResponse interface is used to define the properties of a dropdown response.
 * DropdownResponses render as a select input with user specified options.
 */
export interface DropdownResponse extends BaseResponse {
  type: 'dropdown';
  placeholder?: string;
  options: Option[];
}

/**
 * The SliderResponse interface is used to define the properties of a slider response.
 * SliderResponses render as a slider input with user specified steps. For example, you could have steps of 0, 50, and 100.
 */
export interface SliderResponse extends BaseResponse {
  type: 'slider';
  options: Option[];
}

/**
 * The RadioResponse interface is used to define the properties of a radio response.
 * RadioResponses render as a radio input with user specified options, and optionally left and right labels.
 */
export interface RadioResponse extends BaseResponse {
  type: 'radio';
  options: Option[];
  leftLabel?: string;
  rightLabel?: string;
}

/**
 * The CheckboxResponse interface is used to define the properties of a checkbox response.
 * CheckboxResponses render as a checkbox input with user specified options.
 */
export interface CheckboxResponse extends BaseResponse {
  type: 'checkbox';
  options: Option[];
}

/**
 * The IFrameResponse interface is used to define the properties of an iframe response.
 * IFrameResponses render as a list, that is connected to a WebsiteComponent. When data is sent from the WebsiteComponent, it is displayed in the list.
 */
export interface IFrameResponse extends BaseResponse {
  type: 'iframe';
}

export type Response = NumericalResponse | ShortTextResponse | LongTextResponse | LikertResponse | DropdownResponse | SliderResponse | RadioResponse | CheckboxResponse | IFrameResponse;

/**
 * The Answer interface is used to define the properties of an answer. Answers are used to define the correct answer for a task. These are generally used in training tasks.
 */
export interface Answer {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  answer: any;
  acceptableLow?: number;
  acceptableHigh?: number;
  answerCallback?: string;
  answerRegex?: string;
}

/**
 * @ignore
 */
export const responseBlockLocations = [
  'sidebar',
  'aboveStimulus',
  'belowStimulus',
] as const;
/**
 * @ignore
 */
export type ResponseBlockLocation = (typeof responseBlockLocations)[number];

/**
 * The BaseIndividualComponent interface is used to define the required fields for all components. The only exception is the ContainerComponent, which is used to group components together.
 * 
 * All components must include the response field, which is an array of Response interfaces.
 * There are additional optional fields that can be included in a component that help layout the task. These include the nextButtonText, nextButtonLocation, instructionLocation, correctAnswer.
 * There are other fields that can be included in a component that are used to identify the task in the admin panel. These include the meta, description, instruction, and title fields.
 */
export interface BaseIndividualComponent {
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

/**
 * The MarkdownComponent interface is used to define the properties of a markdown component. The components can be used to render many different things, such as consent forms, instructions, and debriefs. Additionally, you can use the markdown component to render images, videos, and other media, with supporting text.
 */
export interface MarkdownComponent extends BaseIndividualComponent {
  type: 'markdown';
  path: string;
}

/**
 * The ReactComponent interface is used to define the properties of a react component. This component is used to render react code with certain parameters. These parameters can be used within your react code to render different things.
 */
export interface ReactComponent extends BaseIndividualComponent {
  type: 'react-component';
  path: string;
  parameters?: Record<string, unknown>;
}

/**
 * The ImageComponent interface is used to define the properties of an image component. This component is used to render an image with optional styling.
 */
export interface ImageComponent extends BaseIndividualComponent {
  type: 'image';
  path: string;
  style?: Record<string, string>;
}

/**
 * The WebsiteComponent interface is used to define the properties of a website component. A WebsiteComponent is used to render an iframe with a website inside of it. This can be used to display an external website or an html file that is located in the public folder.
 */
export interface WebsiteComponent extends BaseIndividualComponent {
  type: 'website';
  path: string;
  style?: Record<string, string>;
  parameters?: Record<string, unknown>;
}

/**
 * The QuestionnaireComponent interface is used to define the properties of a questionnaire component. A QuestionnaireComponent is used to render questions with different response types. The response types are also defined with these documentation. The main use case of this component type is to ask participants questions, without using markdown, websites, images, etc.
 */
export interface QuestionnaireComponent extends BaseIndividualComponent {
  type: 'questionnaire';
}


export type IndividualComponent = MarkdownComponent | ReactComponent | ImageComponent | WebsiteComponent | QuestionnaireComponent;

/**
 * ContainerComponents are used to group components together. They are used to define the order of sub components and can be used to group related tasks, task blocks, or other components together. Ultimately, the plan is to support nesting of ContainerComponents, but this is not currently supported. Additionally, we plan to support randomization of sub components, but this is also not currently supported, either.
 */
export interface ContainerComponent {
  type: 'container';
  order: OrderObject;
  components: StudyComponents;
}

export interface ProcessedContainerComponent {
  type: 'container';
  order: string[];
  components: StudyComponents;
}

export interface OrderObject {
  order: 'random' | 'latinSquare' | 'fixed'
  components: (string | OrderObject)[]
  randomCount?: number
}

export type StudyComponent = IndividualComponent | ContainerComponent;

export type ProcessedStudyComponent = IndividualComponent | ProcessedContainerComponent;

export interface StudyComponents {
  [key: string]: StudyComponent;
}
export interface ProcessedStudyComponents {
  [key: string]: ProcessedStudyComponent;
}

/**
 * The StudyConfig interface is used to define the properties of a study configuration. These are the hjson files that live in the public folder. In our repo, one example of this would be public/cleveland/config-cleveland.hjson. 
 */
export interface StudyConfig {
  $schema: string;
  studyMetadata: StudyMetadata;
  uiConfig: UIConfig;
  components: StudyComponents;
  sequence: (string | OrderObject)[];
}

export interface ProcessedStudyConfig {
  $schema: string;
  studyMetadata: StudyMetadata;
  uiConfig: UIConfig;
  components: ProcessedStudyComponents;
  sequence: string[];
}

/**
 * @ignore
 * Helper type to avoid writing Type | undefined | null
 */
export type Nullable<T> = T | undefined | null;

/**
 * @ignore
 * Helper type to make reading derived union and intersection types easier.
 * Purely aesthetic
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
  /* eslint-disable */
} & {};

/**
 * @ignore
 * Typecase helper for ContainerComponent
 */
export function isContainerComponent(component: StudyComponent): component is ContainerComponent {
  return component.type === 'container';
}

/**
 * @ignore
 * Typecase helper for ContainerComponent
 */
export function isProcessedContainerComponent(component: ProcessedStudyComponent): component is ProcessedContainerComponent {
  return component.type === 'container';
}
