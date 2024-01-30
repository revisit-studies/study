/**
 * The GlobalConfig is used to generate the list of available studies in the UI.
 * This list is displayed on the landing page when running the app.
*/
export interface GlobalConfig {
  /** A required json schema property. This should point to the github link for the version of the schema you would like. See examples for more information */
  $schema: string;
  /** A required property that specifies the options for the configList property.   */
  configs: {
    /** The key is used to identify the study config file. This key is used in the configList property. */
    [key: string]: {
      /** The path to the study config file. This should be a relative path from the public folder. */
      path: string;
    };
  };
  /** A required property that is used to generate the list of available studies in the UI. This list is displayed on the landing page when running the app. */
  configsList: string[];
}

/**
 * The StudyMetadata is used to describe certain properties of a study.
 * Some of this data is displayed on the landing page when running the app, such as the title and description.
 * This data is also included in the data file that is downloaded at the end of the study, to help identify the study and version.
*/
export interface StudyMetadata {
  /** The title of your study, shown on the landing page. */
  title: string;
  /** The version of your study, shown on the landing page and attached to participant data. This might be useful for seeing which version of the study a participant saw. */
  version: string;
  /** The authors of your study. */
  authors: string[];
  /** The date of your study, may be useful for the researcher. */
  date: string;
  /** The description of your study, shown on the landing page. */
  description: string;
  /** The organizations that are associated with your study. */
  organizations: string[];
}

/**
 * The UIConfig is used to configure the UI of the app.
 * This includes the logo, contact email, and whether to show a progress bar.
 * The UIConfig is also used to configure the sidebar, which can be used to display the task instructions and capture responses.
 */
export interface UIConfig {
  /** The email address that used during the study if a participant clicks contact. */
  contactEmail: string;
  /** The path to the help text file. This is displayed when a participant clicks help. Markdown is supported. */
  helpTextPath?: string;
  /** The path to the logo image. This is displayed on the landing page and the header. */
  logoPath: string;
  /** Controls whether the progress bar is rendered in the study. */
  withProgressBar: boolean;
  /** Controls whether the study data is automatically downloaded at the end of the study. */
  autoDownloadStudy?: boolean;
  /** The time in milliseconds to wait before automatically downloading the study data. */
  autoDownloadTime?: number;
  /** The message to display when the study ends. */
  studyEndMsg?: string;
  /** Controls whether the left sidebar is rendered at all. Required to be true if your response's location is set to sidebar for any question. */
  sidebar: boolean;
  /** Debounce time in milliseconds for automatically tracked window events. Defaults to 100. E.g 100 here means 1000ms / 100ms = 10 times a second, 200 here means 1000ms / 200ms = 5 times per second  */
  windowEventDebounceTime?: number;
  /**
   * If the participant ID is passed in the URL, this is the name of the querystring parameter that is used to capture the participant ID (e.g. PROLIFIC_ID). This will allow a user to continue a study on different devices and browsers.
   */
  urlParticipantIdParam?: string;
}

/**
 * The Option interface is used to define the options for a dropdown, slider, radio, or checkbox response.
 * The label is the text that is displayed to the user, and the value is the value that is stored in the data file.
 * The Option interface is used in the Response interface.
 */
export interface Option {
  /** The label displayed to participants. */
  label: string;
  /** The value stored in the participant's data. */
  value: string | number;
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
 * The BaseResponse interface is used to define the required fields for all responses.
 * Other Response interfaces inherit properties from the BaseResponse interface.
 * Therefore, all responses must include these properties.
 */
export interface BaseResponse {
  /** The id of the response. This is used to identify the response in the data file. */
  id: string;
  /** The prompt that is displayed to the participant. */
  prompt: string;
  /** Controls whether the response is required to be answered. */
  required: boolean;
  /** Controls the response location. These might be the same for all responses, or differ across responses. */
  location: ResponseBlockLocation;
  /** The correct answer to the response. This is used in the data download and can be shown in the admin panel. */
  correctAnswer?: unknown;
  /** You can provide a required value, which makes it so a participant has to answer with that value. */
  requiredValue?: unknown;
  /** You can provide a required label, which makes it so a participant has to answer with a response that matches label. */
  requiredLabel?: string;
  /** Use to capture querystring parameters in answers such as participant_name. See the examples for how this is used, but prefer uiConfig.urlParticipantIdParam if you are capturing a participant ID. */
  paramCapture?: string;
  /** Controls whether the response is hidden. */
  hidden?: boolean;
}

/**
 * The NumericalResponse interface is used to define the properties of a numerical response.
 * NumericalResponses render as a text input that only accepts numbers, and can optionally have a min and max value, or a placeholder.
 */
export interface NumericalResponse extends BaseResponse {
  type: 'numerical';
  /** The placeholder text that is displayed in the input. */
  placeholder?: string;
  /** The minimum value that is accepted in the input. */
  min?: number;
  /** The maximum value that is accepted in the input. */
  max?: number;
}

/**
 * The ShortTextResponse interface is used to define the properties of a short text response.
 * ShortTextResponses render as a text input that accepts any text and can optionally have a placeholder.
 */
export interface ShortTextResponse extends BaseResponse {
  type: 'shortText';
  /** The placeholder text that is displayed in the input. */
  placeholder?: string;
}

/**
 * The LongTextResponse interface is used to define the properties of a long text response.
 * LongTextResponses render as a text area that accepts any text and can optionally have a placeholder.
 */
export interface LongTextResponse extends BaseResponse {
  type: 'longText';
  /** The placeholder text that is displayed in the input. */
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
  /** The number of options to render. */
  preset: number;
  /** The description of the likert scale. */
  desc?: string;
  /** The left label of the likert scale. E.g Strongly Disagree */
  leftLabel?: string;
  /** The right label of the likert scale. E.g Strongly Agree */
  rightLabel?: string;
}

/**
 * The DropdownResponse interface is used to define the properties of a dropdown response.
 * DropdownResponses render as a select input with user specified options.
 */
export interface DropdownResponse extends BaseResponse {
  type: 'dropdown';
  /** The placeholder text that is displayed in the input. */
  placeholder?: string;
  /** The options that are displayed in the dropdown. */
  options: Option[];
}

/**
 * The SliderResponse interface is used to define the properties of a slider response.
 * SliderResponses render as a slider input with user specified steps. For example, you could have steps of 0, 50, and 100.
 */
export interface SliderResponse extends BaseResponse {
  type: 'slider';
  /** This define the steps in the slider and the extent of the slider. */
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
  /** The options that are displayed as checkboxes. */
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
  /** The id of the answer. This is used to identify the answer in the data file. */
  id: string;
  /** The correct answer to the question. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  answer: any;
  /** The acceptable low value for the answer. This is used to define a range of acceptable answers. */
  acceptableLow?: number;
  /** The acceptable high value for the answer. This is used to define a range of acceptable answers. */
  acceptableHigh?: number;
}

/**
 * The BaseIndividualComponent interface is used to define the required fields for all components. The only exception is the ContainerComponent, which is used to group components together.
 *
 * All components must include the response field, which is an array of Response interfaces.
 * There are additional optional fields that can be included in a component that help layout the task. These include the nextButtonText, nextButtonLocation, instructionLocation, correctAnswer.
 * There are other fields that can be included in a component that are used to identify the task in the admin panel. These include the meta, description, instruction, and title fields.
 */
export interface BaseIndividualComponent {
  // Required fields for all components
  /** The responses to the component */
  response: Response[];

  // Optional fields
  /** The text that is displayed on the next button. */
  nextButtonText?: string;
  /** The location of the next button. */
  nextButtonLocation?: ResponseBlockLocation;
  /** The location of the instructions. */
  instructionLocation?: ResponseBlockLocation;
  /** The correct answer to the component. This is used for training trials where the user is shown the correct answer after a guess. */
  correctAnswer?: Answer[];
  /** The meta data for the component. This is used to identify and provide additional information for the component in the admin panel. */
  meta?: Record<string, unknown>;
  /** The description of the component. This is used to identify and provide additional information for the component in the admin panel. */
  description?: string;
  /** The instruction of the component. This is used to identify and provide additional information for the component in the admin panel. */
  instruction?: string;
}

/**
 * The MarkdownComponent interface is used to define the properties of a markdown component. The components can be used to render many different things, such as consent forms, instructions, and debriefs. Additionally, you can use the markdown component to render images, videos, and other media, with supporting text.
 */
export interface MarkdownComponent extends BaseIndividualComponent {
  type: 'markdown';
  /** The path to the markdown file. This should be a relative path from the public folder. */
  path: string;
}

/**
 * The ReactComponent interface is used to define the properties of a react component. This component is used to render react code with certain parameters. These parameters can be used within your react code to render different things.
 */
export interface ReactComponent extends BaseIndividualComponent {
  type: 'react-component';
  /** The path to the react component. This should be a relative path from the src/public folder. */
  path: string;
  /** The parameters that are passed to the react component. These can be used within your react component to render different things. */
  parameters?: Record<string, unknown>;
}

/**
 * The ImageComponent interface is used to define the properties of an image component. This component is used to render an image with optional styling.
 */
export interface ImageComponent extends BaseIndividualComponent {
  type: 'image';
  /** The path to the image. This should be a relative path from the public folder. */
  path: string;
  /** The style of the image. This is an object with css properties as keys and css values as values. */
  style?: Record<string, string>;
}

/**
 * The WebsiteComponent interface is used to define the properties of a website component. A WebsiteComponent is used to render an iframe with a website inside of it. This can be used to display an external website or an html file that is located in the public folder.
 */
export interface WebsiteComponent extends BaseIndividualComponent {
  type: 'website';
  /** The path to the website. This should be a relative path from the public folder or could be an external website. */
  path: string;
  /** The parameters that are passed to the website (iframe). These can be used within your website to render different things. */
  parameters?: Record<string, unknown>;
}

/**
 * The QuestionnaireComponent interface is used to define the properties of a questionnaire component. A QuestionnaireComponent is used to render questions with different response types. The response types are also defined with these documentation. The main use case of this component type is to ask participants questions, without using markdown, websites, images, etc.
 */
export interface QuestionnaireComponent extends BaseIndividualComponent {
  type: 'questionnaire';
}

export type IndividualComponent = MarkdownComponent | ReactComponent | ImageComponent | WebsiteComponent | QuestionnaireComponent;

/** The OrderObject interface is used to define the properties of an order object. This is used to define the order of components in a study. It supports random assignment of trials using a pure random assignment and a latin square. */
export interface OrderObject {
  /** The type of order. This can be random (pure random), latinSquare (random with some guarantees), or fixed. */
  order: 'random' | 'latinSquare' | 'fixed'
  /** The components that are included in the order. */
  components: (string | OrderObject)[]
  /** The number of samples to use for the random assignments. This means you can randomize across 3 components while only showing a participant 2 at a time. */
  numSamples?: number
}

/** An InheritedComponent is a component that inherits properties from a baseComponent. This is used to avoid repeating properties in components. This also means that components in the baseComponents object can be partially defined, while components in the components object can inherit from them and must be fully defined and include all properties (after potentially merging with a base component). */
export type InheritedComponent = (Partial<IndividualComponent> & { baseComponent: string })

/**
 * The StudyConfig interface is used to define the properties of a study configuration. These are the hjson files that live in the public folder. In our repo, one example of this would be public/cleveland/config-cleveland.json.
 */
export interface StudyConfig {
  /** A required json schema property. This should point to the github link for the version of the schema you would like. See examples for more information */
  $schema: string;
  /** The metadata for the study. This is used to identify the study and version in the data file. */
  studyMetadata: StudyMetadata;
  /** The UI configuration for the study. This is used to configure the UI of the app. */
  uiConfig: UIConfig;
  /** The components that are used in the study (baseComponents allow PartialComponents which allows for inheriting from them in components). */
  baseComponents?: Record<string, IndividualComponent | Partial<IndividualComponent>>;
  /** The components that are used in the study. They must be fully defined here with all properties. Some properties may be inherited from baseComponents. */
  components: Record<string, IndividualComponent | InheritedComponent>
  /** The order of the components in the study. This might include some randomness. */
  sequence: OrderObject;
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
