export type { ParticipantData } from '../storage/types';
export type { StoredAnswer, ParticipantMetadata } from '../store/types';

/**
 * The GlobalConfig is used to generate the list of available studies in the UI.
 * This list is displayed on the landing page when running the app.
*/
export interface GlobalConfig {
  /** A required json schema property. This should point to the github link for the version of the schema you would like. See examples in the public folder for more information */
  $schema: string;
  /** A required property that specifies the options for the configList property.   */
  configs: {
    /** The key is used to identify the study config file. This key is used in the configList property. */
    [key: string]: {
      /** The path to the study config file. This should be a relative path from the public folder. */
      path: string;
      /** Indicates whether the study is a test study. This is used to hide the study from the landing page. */
      test?: boolean;
    };
  };
  /** A required property that is used to generate the list of available studies in the UI. This list is displayed on the landing page when running the app. */
  configsList: string[];
}

/**
 * The StudyMetadata is used to describe certain properties of a study.
 * Some of this data is displayed on the landing page when running the app, such as the title and description.
 * Below is an example of a StudyMetadata entry in your study configuration file:

```js
"studyMetadata" : {
  "title": "My New Study",
  "version": "pilot",
  "authors": [
    "Jane Doe",
    "John Doe"
  ],
  "date": "2024-04-01",
  "description": "This study is meant to test your ability.",
  "organizations": [
    "The reVISit Team",
    "The Other Team"
  ]
}
```
*/
export interface StudyMetadata {
  /** The title of your study, shown on the landing page. */
  title: string;
  /** The version of your study. When you change a configuration file after a study has already been distributed to participants, you can change the version number so that the participants who see this new configuration file can be identified. */
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
 * @ignore
 */
export type ResponseBlockLocation = 'sidebar' | 'aboveStimulus' | 'belowStimulus' | 'stimulus';
export type ConfigResponseBlockLocation = Exclude<ResponseBlockLocation, 'stimulus'>;

export type Styles = {
  /** Sizing */
  height?: string;
  width?: string;
  minHeight?: string;
  minWidth?: string;
  maxHeight?: string;
  maxWidth?: string;

  /** Positioning */
  position?: 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky';
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;

  /** Spacing */
  margin?: string;
  padding?: string;

  /** Border */
  border?: string;
  borderRadius?: string;

  /** Background */
  background?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundPosition?: string;
  backgroundSize?: string;

  /** Filter */
  filter?: string;

  /** Typography */
  color?: string;
  font?: string;
  fontFamily?: string;
  fontSize?: string;
  fontStyle?: 'normal' | 'italic' | 'oblique';
  fontWeight?: string | number;
  textAlign?: 'start' | 'center' | 'end' | 'justify' | 'left' | 'right' | 'match-parent';
  textDecoration?: 'none' | 'underline' | 'overline' | 'line-through' | 'underline-overline';
  textTransform?: 'capitalize' | 'lowercase' | 'none' | 'uppercase';
  letterSpacing?: string;
  wordSpacing?: string;
  lineHeight?: string | number;

  /** Transform */
  transform?: string;
};

/**
 * The UIConfig is used to configure the UI of the app.
 * This includes the logo, contact email, and whether to show a progress bar.
 * The UIConfig is also used to configure the sidebar, which can be used to display the task instructions and capture responses. Below is an example of how the UI Config would look in your study configuration (note, there are optional fields that are not shown here):
```js
uiConfig:{
  "contactEmail": "contact@revisit.dev",
  "helpTextPath": "<study-name>/assets/help.md",
  "logoPath": "<study-name>/assets/logo.jpg",
  "withProgressBar": true,
  "autoDownloadStudy": true
  "autoDownloadTime": 5000,
  "studyEndMsg": "Thank you for completing this study. You're the best!",
  "withSidebar": true,
  "windowEventDebounceTime": 500,
  "urlParticipantIdParam": "PROLIFIC_ID",
  "numSequences": 500
}
```
In the above, the `<study-name>/assets/` path is referring to the path to your individual study assets. It is common practice to have your study directory contain an `assets` directory where all components and images relevant to your study reside. Note that this path is relative to the `public` folder of the repository - as is all other paths you define in reVISit (aside from React components whose paths are relative to `src/public`.)
 */
export interface UIConfig {
  // Required fields
  /** The path to the logo image. This is displayed on the landing page and the header. */
  logoPath: string;
  /** The email address that used during the study if a participant clicks contact. */
  contactEmail: string;
  /** Controls whether the progress bar is rendered in the study. */
  withProgressBar: boolean;
  /** Controls whether the left sidebar is rendered at all. Required to be true if your response's location is set to sidebar for any question. */
  withSidebar: boolean;

  // Optional fields
  /** The width of the left sidebar. Defaults to 300. */
  sidebarWidth?: number;
  /** Controls whether the title should be hidden in the study. */
  showTitle?: boolean;
  /** Controls whether the title bar should be hidden in the study. */
  showTitleBar?: boolean;
  /** The location of the instructions. */
  instructionLocation?: ConfigResponseBlockLocation;
  /** The path to the help text file. This is displayed when a participant clicks help. Markdown is supported. */
  helpTextPath?: string;
  /** Whether enter key should move to the next question. Defaults to false. */
  nextOnEnter?: boolean;
  /** The text to display on the next button. */
  nextButtonText?: string;
  /** The location of the next button. */
  nextButtonLocation?: ConfigResponseBlockLocation;
  /** The time in milliseconds to wait before the next button is enabled. */
  nextButtonEnableTime?: number;
  /** The time in milliseconds to wait before the next button is disabled. */
  nextButtonDisableTime?: number;
  /** The text that is displayed on the previous button. */
  previousButtonText?: string;
  /** Whether to redirect a timed out participant to a rejection page. This only works for components where the `nextButtonDisableTime` field is set. */
  timeoutReject?: boolean;
  /** Controls whether the component should provide feedback to the participant, such as in a training trial. Defaults to false. */
  provideFeedback?: boolean;
  /** The number of training attempts allowed for the component. The next button will be disabled until either the correct answer is given or the number of attempts is reached. When the number of attempts is reached, if the answer is incorrect still, the correct value will be shown to the participant. The default value is 2. Providing a value of -1 will allow infinite attempts and the participant must enter the correct answer to continue, and reVISit will not show the correct answer to the user.  */
  trainingAttempts?: number;
  /** Controls whether the component should allow failed training. Defaults to true. */
  allowFailedTraining?: boolean;
  /** Whether or not we want to utilize think-aloud features. If true, will record audio on all components unless deactivated on individual components. Defaults to false. */
  recordAudio?: boolean;
  /** Whether or not we want to utilize screen recording feature. If true, will record audio on all components unless deactivated on individual components. This must be set to true if you want to record audio on any component in your study. Defaults to false. It's also required that the library component, $screen-recording.co.screenRecordingPermission, be included in the study at some point before any component that you want to record the screen on to ensure permissions are granted and screen capture has started. */
  recordScreen?: boolean;
  /** Desired fps for recording screen. If possible, this value will be used, but if it's not possible, the user agent will use the closest possible match. */
  recordScreenFPS?: number;
  /** Whether to prepend questions with their index (+ 1). This should only be used when all questions are in the same location, e.g. all are in the side bar. */
  enumerateQuestions?: boolean;
  /** Whether to show the response dividers. Defaults to false. */
  responseDividers?: boolean;
  /** Debounce time in milliseconds for automatically tracked window events. Defaults to 100. E.g 100 here means 1000ms / 100ms = 10 times a second, 200 here means 1000ms / 200ms = 5 times per second  */
  windowEventDebounceTime?: number;
  /** The message to display when the study ends. */
  studyEndMsg?: string;
  /** Controls whether the study data is automatically downloaded at the end of the study. */
  autoDownloadStudy?: boolean;
  /** The time in milliseconds to wait before automatically downloading the study data. */
  autoDownloadTime?: number;
  /** The number of sequences to generate for the study. This is used to generate the random sequences for the study. Defaults to 1000. */
  numSequences?: number;
  /** If the participant ID is passed in the URL, this is the name of the querystring parameter that is used to capture the participant ID (e.g. PROLIFIC_ID). This will allow a user to continue a study on different devices and browsers. */
  urlParticipantIdParam?: string;
  /** The default name field for a participant. Directs revisit to use the task and response id as a name in UI elements. For example, if you wanted the response 'prolificId' from the task 'introduction' to be the name, this field would be 'introduction.prolificId' */
  participantNameField?: string;
  /** The minimum screen width size for the study */
  minWidthSize?: number;
  /** The minimum screen height size for the study */
  minHeightSize?: number;
  /** The path to the external stylesheet file. */
  stylesheetPath?: string;
}

/**
 * The NumberOption interface is used to define the options for a slider response.
 * The label is the text that is displayed to the user, and the value is the value that is stored in the data file.
 */
export interface NumberOption {
  /** The label displayed to participants. */
  label: string;
  /** The value stored in the participant's data. */
  value: number;
}

/**
 * The StringOption interface is used to define the options for a dropdown, radio, buttons, or checkbox response.
 * The label is the text that is displayed to the user, and the value is the value that is stored in the data file.
 */
export interface StringOption {
  /** The label displayed to participants. Markdown is supported. */
  label: string;
  /** The value stored in the participant's data. */
  value: string;
}

/**
 * The BaseResponse interface is used to define the required fields for all responses.
 * Other Response interfaces inherit properties from the BaseResponse interface.
 * Therefore, all responses must include these properties.
 */
export interface BaseResponse {
  /** The id of the response. This is used to identify the response in the data file. */
  id: string;
  /** The prompt that is displayed to the participant. You can use markdown here to render images, links, etc. */
  prompt: string;
  /** The secondary text that is displayed to the participant under the prompt. This does not accept markdown. */
  secondaryText?: string;
  /** Controls whether the response is required to be answered. Defaults to true. */
  required?: boolean;
  /** Controls the response location. These might be the same for all responses, or differ across responses. Defaults to `belowStimulus` */
  location?: ConfigResponseBlockLocation;
  /** You can provide a required value, which makes it so a participant has to answer with that value. */
  requiredValue?: unknown;
  /** You can provide a required label, which makes it so a participant has to answer with a response that matches label. */
  requiredLabel?: string;
  /** Use to capture querystring parameters in answers such as participant_name. See the examples for how this is used, but prefer uiConfig.urlParticipantIdParam if you are capturing a participant ID. */
  paramCapture?: string;
  /** Controls whether the response is hidden. */
  hidden?: boolean;
  /** Renders the response with a trailing divider. If present, will override the divider setting in the components or uiConfig. */
  withDivider?: boolean;
  /** Renders the response with an option for "I don't know". This counts as a completed answer for the validation. */
  withDontKnow?: boolean;
  /** The path to the external stylesheet file. */
  stylesheetPath?: string;
  /**  You can set styles here, using React CSSProperties, for example: {"width": 100} or {"width": "50%"} */
  style?: Styles;
}

/**
 * The NumericalResponse interface is used to define the properties of a numerical response.
 * NumericalResponses render as a text input that only accepts numbers, and can optionally have a min and max value, or a placeholder.
 *
 * Example:
```js
{
  "id": "q-numerical",
  "prompt": "Numerical example",
  "location": "aboveStimulus",
  "type": "numerical",
  "placeholder": "Enter your age, range from 0 - 120",
  "max": 120,
  "min": 0
}
```
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
 *
```js
{
  "id": "q-short-text",
  "prompt": "Short text example",
  "location": "aboveStimulus",
  "type": "shortText",
  "placeholder": "Enter your answer here"
}
```
 *
 */
export interface ShortTextResponse extends BaseResponse {
  type: 'shortText';
  /** The placeholder text that is displayed in the input. */
  placeholder?: string;
}

/**
 * The LongTextResponse interface is used to define the properties of a long text response.
 * LongTextResponses render as a text area that accepts any text and can optionally have a placeholder.
```js
{
  "id": "q-name",
  "prompt": "What is your first name?",
  "location": "aboveStimulus",
  "type": "longText",
  "placeholder": "Please enter your first name"
}
```
 *
 */
export interface LongTextResponse extends BaseResponse {
  type: 'longText';
  /** The placeholder text that is displayed in the input. */
  placeholder?: string;
}

/**
 * The LikertResponse interface is used to define the properties of a likert response.
 * LikertResponses render as radio buttons with a user specified number of options, which can be controlled through the numItems. For example, numItems: 5 will render 5 radio buttons, and numItems: 7 will render 7 radio buttons.
 * LikertResponses can also have a description, and left and right labels.
 * The left and right labels are used to label the left and right ends of the likert scale with values such as 'Strongly Disagree' and 'Strongly Agree'.
 *
 * Example for a five-point Likert Scale:
 *
```js
{
  "id": "q-satisfaction",
  "prompt": "Rate your satisfaction from 1 (not enjoyable) to 5 (very enjoyable).",
  "location": "aboveStimulus",
  "type": "likert",
  "leftLabel": "Not Enjoyable",
  "rightLabel": "Very Enjoyable",
  "numItems": 5,
  "start": 1,
  "spacing": 1
}
```
 */
export interface LikertResponse extends BaseResponse {
  type: 'likert';
  /** The number of options to render. */
  numItems: number;
  /** The starting value of the likert scale. Defaults to 1. */
  start?: number;
  /** The spacing between the options. Defaults to 1. */
  spacing?: number;
  /** The left label of the likert scale. E.g Strongly Disagree */
  leftLabel?: string;
  /** The right label of the likert scale. E.g Strongly Agree */
  rightLabel?: string;
}

/**
 * The MatrixResponse interface is used to define the properties of a matrix radio or matrix checkbox response.
 * Question options are rendered as rows of the matrix, each row containing its own radio/checkbox group.
 * Answer options are rendered as column headers of the matrix. These can be customized by passing in the custom strings into the answer options. Alternatively, `answerOptions` can be set to one of the following custom strings: 'satisfaction5','satisfaction7', 'likely5', 'likely7'. This will automatically generate the appropriate headers for the matrix.
 *
 * Example for a 5-scale satisfaction matrix with three questions:
 *
```js
{
  "id": "multi-satisfaction",
  "prompt": "Rate your satisfaction from 1 (not enjoyable) to 5 (very enjoyable) for the following items.",
  "location": "aboveStimulus",
  "type": "matrix-radio",
  "answerOptions": "satisfaction5",
  "questionOptions": [
    "The tool we created",
    "The technique we developed",
    "The authors of the tools"
  ]
}
```

Here's an example using custom columns (answerOptions):

```js
{
  "id": "multi-custom",
  "prompt": "Which categories do the following items belong to?",
  "location": "aboveStimulus",
  "type": "matrix-checkbox",
  "answerOptions": [
    "Has Legs",
    "Has Wings",
    "Can Swim"
  ],
  "questionOptions": [
    "Dog",
    "Snake",
    "Eagle",
    "Salmon",
    "Platypus"
  ]

}
```
 */
export interface MatrixResponse extends BaseResponse {
  type: 'matrix-radio' | 'matrix-checkbox';
  /** The answer options (columns). We provide some shortcuts for a likelihood scale (ranging from highly unlikely to highly likely) and a satisfaction scale (ranging from highly unsatisfied to highly satisfied) with either 5 or 7 options to choose from. */
  answerOptions: string[] | `likely${5 | 7}` | `satisfaction${5 | 7}`;
  /** The question options (rows) are the prompts for each response you'd like to record. */
  questionOptions: string[];
  /** The order in which the questions are displayed. Defaults to fixed. */
  questionOrder?: 'fixed' | 'random';
}

/**
 * The DropdownResponse interface is used to define the properties of a dropdown response.
 * DropdownResponses render as a select input with user specified options.
 *
 * Example:
```js
{
  "id": "q-color",
  "prompt": "What is your favorite color?",
  "location": "aboveStimulus",
  "type": "dropdown",
  "placeholder": "Please choose your favorite color",
  "options": ["Red", "Blue"]
}
  ```
 *
 *
 */
export interface DropdownResponse extends BaseResponse {
  type: 'dropdown';
  /** The placeholder text that is displayed in the input. */
  placeholder?: string;
  /** The options that are displayed in the dropdown. */
  options: (StringOption | string)[];
}

/**
 * The SliderResponse interface is used to define the properties of a slider response.
 * SliderResponses render as a slider input with user specified steps. For example, you could have steps of 0, 50, and 100.
 *
 * Example:
```js
{
  "id": "q-slider",
  "prompt": "How are you feeling?",
  "location": "aboveStimulus",
  "type": "slider",
  "options": [
    {
      "label": "Bad",
      "value": 0
    },
    {
      "label": "OK",
      "value": 50
    },
    {
      "label": "Good",
      "value": 100
    }
  ]
}
```
 *
 */
export interface SliderResponse extends BaseResponse {
  type: 'slider';
  /** This defines the steps in the slider and the extent of the slider as an array of objects that have a label and a value. */
  options: NumberOption[];
  /** The starting value of the slider. Defaults to the minimum value. */
  startingValue?: number;
  /** Whether the slider should snap between values. Defaults to false. Slider snapping disables the label above the handle. */
  snap?: boolean;
  /** The step value of the slider. If not provided (and snap not enabled), the step value is calculated as the range of the slider divided by 100. */
  step?: number;
  /** The spacing between the ticks. If not provided, the spacing is calculated as the range of the slider divided by power of 10. */
  spacing?: number;
  /** Whether to render the slider with a bar to the left. Defaults to true. */
  withBar?: boolean;
  /** Whether to render the slider with a NASA-tlx style. Defaults to false. */
  tlxStyle?: boolean;
  /** Whether to render the slider with a SMEQ style. Defaults to false. */
  smeqStyle?: boolean;
}

/**
 * The RadioResponse interface is used to define the properties of a radio response. Radios have only one allowable selection.
 * RadioResponses render as a radio input with user specified options, and optionally left and right labels.
 *
 * Example:
```js
{
  "id": "q-radio",
  "prompt": "Radio button example",
  "location": "aboveStimulus",
  "type": "radio",
  "options": ["Option 1", "Option 2"]
}
```
 *
 */
export interface RadioResponse extends BaseResponse {
  type: 'radio';
  /** The options that are displayed as checkboxes, provided as an array of objects, with label and value fields. */
  options: (StringOption | string)[];
  /** The order in which the radio buttons are displayed. Defaults to fixed. */
  optionOrder?: 'fixed' | 'random';
  /** The left label of the radio group. Used in Likert scales for example */
  leftLabel?: string;
  /** The right label of the radio group. Used in Likert scales for example */
  rightLabel?: string;
  /** Whether to render the radio buttons horizontally. Defaults to false, so they render horizontally. */
  horizontal?: boolean;
  /** Whether to render the radios with an "other" option. */
  withOther?: boolean;
}

/**
 * The CheckboxResponse interface is used to define the properties of a checkbox response.
 * CheckboxResponses render as a checkbox input with user specified options.
 *
```js
{
  "id": "q7",
  "prompt": "Checkbox example (not required)",
  "location": "aboveStimulus",
  "type": "checkbox",
  "options": ["Option 1", "Option 2", "Option 3"]
}
```
 */
export interface CheckboxResponse extends BaseResponse {
  type: 'checkbox';
  /** The options that are displayed as checkboxes, provided as an array of objects, with label and value fields. */
  options: (StringOption | string)[];
  /** The order in which the checkboxes are displayed. Defaults to fixed. */
  optionOrder?: 'fixed' | 'random';
  /** The minimum number of selections that are required. */
  minSelections?: number;
  /** The maximum number of selections that are required. */
  maxSelections?: number;
  /** Whether to render the checkboxes horizontally. Defaults to false, so they render horizontally. */
  horizontal?: boolean;
  /** Whether to render the checkboxes with an "other" option. */
  withOther?: boolean;
}

/**
 * The ReactiveResponse interface is used to define the properties of a reactive response.
 * ReactiveResponses render as a list, that is connected to a WebsiteComponent, VegaComponent, or ReactComponent. When data is sent from the components, it is displayed in the list.
 *
```js
{
  "id": "reactiveResponse",
  "prompt": "Answer clicked in the stimulus",
  "location": "aboveStimulus",
  "type": "reactive"
}
```
 */
export interface ReactiveResponse extends BaseResponse {
  type: 'reactive';
}

/**
 * The ButtonsResponse interface is used to define the properties of a buttons response.
 * ButtonsResponses render as a list of buttons that the participant can click. When a button is clicked, the value of the button is stored in the data file.
 * Participants can cycle through the options using the arrow keys.
 *
 * Example:
 * ```js
 * {
 *   "id": "buttonsResponse",
 *   "type": "buttons",
 *   "prompt": "Click a button",
 *   "location": "belowStimulus",
 *   "options": [
 *     "Option 1",
 *     "Option 2",
 *     "Option 3"
 *   ]
 * }
 * ```
 * In this example, the participant can click one of the buttons labeled "Option 1", "Option 2", or "Option 3".
 */
export interface ButtonsResponse extends BaseResponse {
  type: 'buttons';
  options: (StringOption | string)[];
  /** The order in which the buttons are displayed. Defaults to fixed. */
  optionOrder?: 'fixed' | 'random';
}

/**
 * The TextOnlyResponse interface is used to define the properties of a text only response.
 * TextOnlyResponses render as a block of text that is displayed to the user. This can be used to display instructions or other information.
 * It does not accept any input from the user.
 *
 * Example:
 * ```js
 * {
 *   "id": "textOnlyResponse",
 *   "type": "textOnly",
 *   "prompt": "This is a text only response, it accepts markdown so you can **bold** or _italicize_ text.",
 *   "location": "belowStimulus",
 *   "restartEnumeration": true
 * }
 * ```
 *
 * In this example, the text only response is displayed below the stimulus and the enumeration of the questions is restarted.
 */
export interface TextOnlyResponse extends Omit<BaseResponse, 'secondaryText' | 'required' | 'requiredValue' | 'requiredLabel' | 'paramCapture' | 'hidden' | 'withDontKnow'> {
  type: 'textOnly';
  /** The markdown text that is displayed to the user. */
  prompt: string;
  /** Whether to restart the enumeration of the questions. Defaults to false. */
  restartEnumeration?: boolean;

  secondaryText?: undefined;
  required?: undefined;
  requiredValue?: undefined;
  requiredLabel?: undefined;
  paramCapture?: undefined;
  hidden?: undefined;
  withDontKnow?: undefined;
}

export type Response = NumericalResponse | ShortTextResponse | LongTextResponse | LikertResponse | DropdownResponse | SliderResponse | RadioResponse | CheckboxResponse | ReactiveResponse | MatrixResponse | ButtonsResponse | TextOnlyResponse;

/**
 * The Answer interface is used to define the properties of an answer. Answers are used to define the correct answer for a task. These are generally used in training tasks or if skip logic is required based on the answer.
 *
 * Answers are used to defined correct answers for a task. These are generally used in training tasks or if skip logic is required based on the answer. The answer field is used to define the correct answer to the question. The acceptableLow and acceptableHigh fields are used to define a range of acceptable answers (these are currently only used for training). For example, if the correct answer is 5, and the acceptableLow is 4 and the acceptableHigh is 6, then any answer between 4 and 6 will be considered correct.
 *
 * Here's an example of how to use the Answer interface to define the correct answer to a question:
 *
```js
{
  "type": "markdown",
  "path": "<study-name>/assets/question.md",
  "response": [
    {
      "id": "response1",
      "prompt": "What is 2 + 2?",
      "location": "belowStimulus",
      "type": "numerical"
    }
  ]
  "correctAnswer": [{
    "id": "response1",
    "answer": 4
  }]
}
```
 *
 * In this example, the correct answer to the question "What is 2 + 2?" is 4. If the participant answers 4, they will be considered correct. If they answer anything other than 4, they will be considered incorrect.
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
 * The BaseIndividualComponent interface is used to define the required fields for all components.
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
  /** The correct answer to the component. This is used for training trials where the user is shown the correct answer after a guess. */
  correctAnswer?: Answer[];
  /** The meta data for the component. This is used to identify and provide additional information for the component in the admin panel. */
  meta?: Record<string, unknown>;
  /** The description of the component. This is used to identify and provide additional information for the component in the admin panel. */
  description?: string;
  /** Controls whether the progress bar is rendered. If present, will override the progress bar setting in the uiConfig. */
  withProgressBar?: boolean;
  /** Controls whether the left sidebar is rendered at all. Required to be true if your response's location is set to sidebar for any question. If present, will override the sidebar setting in the uiConfig. */
  withSidebar?: boolean;
  /** The width of the left sidebar. If present, will override the sidebar width setting in the uiConfig. */
  sidebarWidth?: number;
  /** Controls whether the title should be hidden in the study. If present, will override the title setting in the uiConfig. */
  showTitle?: boolean;
  /** Controls whether the title bar should be hidden in the study. If present, will override the title bar setting in the uiConfig. */
  showTitleBar?: boolean;
  /** The instruction of the component. This is used to identify and provide additional information for the component in the admin panel. */
  instruction?: string;
  /** The location of the instructions. If present, will override the instruction location setting in the uiConfig. */
  instructionLocation?: ConfigResponseBlockLocation;
  /** The path to the help text file. This is displayed when a participant clicks help. Markdown is supported. If present, will override the help text path set in the uiConfig. */
  helpTextPath?: string;
  /** Whether enter key should move to the next question. If present, will override the enter key setting in the uiConfig. */
  nextOnEnter?: boolean;
  /** The text to display on the next button. If present, will override the next button text setting in the uiConfig. */
  nextButtonText?: string;
  /** The location of the next button. If present, will override the  next button location setting in the uiConfig. */
  nextButtonLocation?: ConfigResponseBlockLocation;
  /** The time in milliseconds to wait before the next button is enabled. If present, will override the next button enable time setting in the uiConfig. */
  nextButtonEnableTime?: number;
  /** The time in milliseconds to wait before the next button is disabled. If present, will override the next button disable time setting in the uiConfig. */
  nextButtonDisableTime?: number;
  /** Whether to show the previous button. If present, will override the previous button setting in the uiConfig. */
  previousButton?: boolean;
  /** The text that is displayed on the previous button. If present, will override the previous button text setting in the uiConfig. */
  previousButtonText?:string;
  /** Controls whether the component should provide feedback to the participant, such as in a training trial. If present, will override the provide feedback setting in the uiConfig. */
  provideFeedback?: boolean;
  /** The number of training attempts allowed for the component. If present, will override the training attempts setting in the uiConfig. */
  trainingAttempts?: number;
  /** Controls whether the component should allow failed training. If present, will override the allow failed training setting in the uiConfig. */
  allowFailedTraining?: boolean;
  /** Whether or not we want to utilize think-aloud features. If present, will override the record audio setting in the uiConfig. */
  recordAudio?: boolean;
  /** Whether or not we want to utilize screen recording feature. If present, will override the record screen setting in the uiConfig. If true, the uiConfig must have recordScreen set to true or the screen will not be captured. It's also required that the library component, $screen-recording.co.screenRecordingPermission, be included in the study at some point before this component to ensure permissions are granted and screen capture has started. */
  recordScreen?: boolean;
  /** Whether to prepend questions with their index (+ 1). This should only be used when all questions are in the same location, e.g. all are in the side bar. If present, will override the enumeration of questions setting in the uiConfig. */
  enumerateQuestions?: boolean;
  /** Whether to show the response dividers. If present, will override the response dividers setting in the uiConfig. */
  responseDividers?: boolean;
  /** Debounce time in milliseconds for automatically tracked window events. If present, will override the window event debounce time setting in the uiConfig. */
  windowEventDebounceTime?: number;
  /** The order of the responses. Defaults to 'fixed'. */
  responseOrder?: 'fixed' | 'random';
  /** The path to the external stylesheet file. */
  stylesheetPath?: string;
  /**  You can set styles here, using React CSSProperties, for example: {"width": 100} or {"width": "50%"} */
  style?: Styles;
}

/**
 * The MarkdownComponent interface is used to define the properties of a markdown component. The components can be used to render many different things, such as consent forms, instructions, and debriefs. Additionally, you can use the markdown component to render images, videos, and other media, with supporting text. Markdown components can have responses (e.g. in a consent form), or no responses (e.g. in a help text file). Here's an example with no responses for a simple help text file:
 *
```js
{
  "type": "markdown",
  "path": "<study-name>/assets/help.md",
  "response": []
}
```
 */
export interface MarkdownComponent extends BaseIndividualComponent {
  type: 'markdown';
  /** The path to the markdown file. This should be a relative path from the public folder. */
  path: string;
}

/**
 * The ReactComponent interface is used to define the properties of a react component. This component is used to render react code with certain parameters. These parameters can be used within your react code to render different things.
 *
 * Unlike other types of components, the path for a React component is relative to the `src/public/` folder.
 * Similar to our standard assets, we suggest creating a folder named `src/public/{studyName}/assets` to house all of the React component assets for a particular study.
 * Your React component which you link to in the path must be default exported from its file.
 *
 * React components created this way have a generic prop type passed to the component on render, `<StimulusParams<T>>`, which has the following types.
 *
```ts
{
  parameters: T;
  setAnswer: ({ status, provenanceGraph, answers }: { status: boolean, provenanceGraph?: TrrackedProvenance, answers: Record<string, any> }) => void
}
```
 *
 * parameters is the same object passed in from the ReactComponent type below, allowing you to pass options in from the config to your component.
 * setAnswer is a callback function allowing the creator of the ReactComponent to programmatically set the answer, as well as the provenance graph. This can be useful if you don't use the default answer interface, and instead have something more unique.
 *
 * So, for example, if I had the following ReactComponent in my config
```js
{
  type: 'react-component';
  path: 'my_study/CoolComponent.tsx';
  parameters: {
    name: 'Zach';
    age: 26;
  }
}
```
 *
 * My react component, CoolComponent.tsx, would exist in src/public/my_study/assets, and look something like this
 *
```ts
export default function CoolComponent({ parameters, setAnswer }: StimulusParams<{name: string, age: number}>) {
  // render something
}
```
 *
 * For in depth examples, see the following studies, and their associated codebases.
 * https://revisit.dev/study/demo-click-accuracy-test (https://github.com/revisit-studies/study/tree/v2.2.0/src/public/demo-click-accuracy-test/assets)
 * https://revisit.dev/study/example-brush-interactions (https://github.com/revisit-studies/study/tree/v2.2.0/src/public/example-brush-interactions/assets)
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
 *
 * For example, to render an image with a path of `path/to/study/assets/image.jpg` and a max width of 50%, you would use the following snippet:
```js
{
  "type": "image",
  "path": "<study-name>/assets/image.jpg",
  "style": {
  "maxWidth": "50%"
  }
}
```
 */
export interface ImageComponent extends BaseIndividualComponent {
  type: 'image';
  /** The path to the image. This could be a relative path from the public folder or a url to an external image. */
  path: string;
}

/**
 * The WebsiteComponent interface is used to define the properties of a website component. A WebsiteComponent is used to render an iframe with a website inside of it. This can be used to display an external website or an html file that is located in the public folder.

```js
{
  "type": "website",
  "path": "<study-name>/assets/website.html",
}
```

 * To pass a data from the config to the website, you can use the `parameters` field as below:

```js
{
  "type": "website",
  "path": "<study-name>/website.html",
  "parameters": {
    "barData": [0.32, 0.01, 1.2, 1.3, 0.82, 0.4, 0.3]
  },
  "response": [
    {
      "id": "barChart",
      "prompt": "Your selected answer:",
      "location": "belowStimulus",
      "type": "reactive"
    }
  ]
}
```
 * In the `website.html` file, by including `revisit-communicate.js`, you can use the `Revisit.onDataReceive` method to retrieve the data, and `Revisit.postAnswers` to send the user's responses back to the reVISit as shown in the example below:

```html
<script src="../../revisitUtilities/revisit-communicate.js"></script>
<script>
  Revisit.onDataReceive((data) => {
    const barData = data['barData'];
    ...
  });

  // Call out that 'barChart' needs to match ID in 'response' object
  Revisit.postAnswers({ barChart: userAnswer });
</script>
```

  * If the html website implements Trrack library for provenance tracking, you can send the provenance graph back to reVISit by calling `Revisit.postProvenanceGraph` as shown in the example below. You need to call this each time the Trrack state is updated so that reVISit is kept aware of the changes in the provenance graph.

```js
const trrack = initializeTrrack({
  initialState,
  registry
});

...
Revisit.postProvenance(trrack.graph.backend);
```

 */
export interface WebsiteComponent extends BaseIndividualComponent {
  type: 'website';
  /** The path to the website. This should be a relative path from the public folder or could be an external website. */
  path: string;
  /** The parameters that are passed to the website (iframe). These can be used within your website to render different things. */
  parameters?: Record<string, unknown>;
}

/**
 * A QuestionnaireComponent is used to render simple questions that require a response. The main use case of this component type is to ask participants questions when you don't need to render a stimulus. Please note, that even though we're not using a stimulus, the responses still require a `location`. For example this could be used to collect demographic information from a participant using the following snippet:
 *
```js
{
  "type": "questionnaire",
  "response": [
    {
      "id": "gender",
      "prompt": "Gender:",
      "location": "belowStimulus",
      "type": "checkbox",
      "options": ["Man", "Woman", "Genderqueer", "Third-gender", ...]
    }
  ]
}
```
 */
export interface QuestionnaireComponent extends BaseIndividualComponent {
  type: 'questionnaire';
}

/**
 * The VegaComponentPath interface is used to define the properties of a Vega Component. This component is used to render a Vega/Vega-Lite Component with path pointing to your Vega/Vega-Lite specs file.
 *
 * For example, to render a vega based stimuli with a path of `<study-name>/assets/vega.spec.json`, you would use the following snippet:
```js
{
  "type": "vega",
  "path": "<study-name>/assets/vega.spec.json",
}
```

If you are using Vega, you can use signals with `revisitAnswer` to send the user's responses back to the reVISit. For example, you can use the following snippet in your Vega spec file's signals section:
```js
{
  "signals": [
    {
      "name": "revisitAnswer",
      "value": {},
      "on": [
        {
          "events": "rect:click",
          "update": "{responseId: 'vegaDemoResponse1', response: datum.category}"
        }
      ]
    }
  ]
}
In this example, when a user clicks on a rectangle in the Vega chart, the `revisitAnswer` signal is updated with the responseId and response. This signal is then passed to reVISit as the participant's response.
```
*/
export interface VegaComponentPath extends BaseIndividualComponent {
  type: 'vega';
  /** The path to the vega file. This should be a relative path from the public folder. */
  path: string;
  /** Whether to include vega actions. Defaults to true. */
  withActions?: boolean;
}

/**
 * The VegaComponentConfig interface is used to define the properties of a Vega Component. This component is used to render a Vega/Vega-Lite Component by adding Vega/Vega-Lite specs within the reVISit config itself.
 *
 * To do this, would use the following snippet:
```js
{
  "type": "vega",
  "config": { ... vega specs here ...},
}

IIf you are using Vega, you can use signals with `revisitAnswer` to send the user's responses back to the reVISit. For example, you can use the following snippet in your Vega spec's signals section:
```js
{
  "signals": [
    {
      "name": "revisitAnswer",
      "value": {},
      "on": [
        {
          "events": "rect:click",
          "update": "{responseId: 'vegaDemoResponse1', response: datum.category}"
        }
      ]
    }
  ]
}
In this example, when a user clicks on a rectangle in the Vega chart, the `revisitAnswer` signal is updated with the responseId and response.
```
*/
export interface VegaComponentConfig extends BaseIndividualComponent {
  type: 'vega';
  /** The vega or vega-lite configuration. */
  config: object;
  /** Whether to include vega actions. Defaults to true. */
  withActions?: boolean;
}

export type VegaComponent = VegaComponentPath | VegaComponentConfig;

/**
 * The VideoComponent interface is used to define the properties of a video component. This component is used to render a video with optional controls.
 *
 * Most often, video components will be used for trainings, and will have a `forceCompletion` field set to true. This will prevent the participant from moving on until the video has finished playing.
 *
 * As such, the `forceCompletion` field is set to true by default, and the `withTimeline` field is set to false by default.
 *
 * For example, to render a training video with a path of `<study-name>/assets/video.mp4`, you would use the following snippet:
 * ```js
 * {
 *   "type": "video",
 *   "path": "<study-name>/assets/video.mp4",
 * }
 * ```
 * */

export interface VideoComponent extends BaseIndividualComponent {
  type: 'video';
  /** The path to the video. This could be a relative path from the public folder or might be a url to an external website. */
  path: string;
  /** Whether to force the video to play until the end. Defaults to true. */
  forceCompletion?: boolean;
  /** Whether to show the video timeline. Defaults to false. */
  withTimeline?: boolean;
}

export type IndividualComponent = MarkdownComponent | ReactComponent | ImageComponent | WebsiteComponent | QuestionnaireComponent | VegaComponent | VideoComponent;

/** The DeterministicInterruption interface is used to define an interruption that will be shown at a specific location in the block.
 *
 * For example, if you want to show an interruption after the second component in the block, you would set firstLocation to 2. If you want to show an interruption after every 3 components, you would set spacing to 3. If you want to show an interruption after the second component and then every 3 components, you would set firstLocation to 2 and spacing to 3.
 *
 * The components property is an array of the components that will be inserted at the location specified by firstLocation and spacing. These components should reference components in the StudyConfig.components section of the config.
 *
 * Here's an example of how to use the DeterministicInterruption:
 *
```js
{
  "order": "fixed",
  "components": [
    "component1",
    "component2",
    "component3",
    "component4",
    "component5",
    "component6"
  ],
  "interruptions": [
    {
      "firstLocation": 2,
      "spacing": 3,
      "components": [
        "interruption1",
        "interruption2"
      ]
    }
  ]
}
```
 *
 * The resulting sequence array could be:
 *
```js
[
  ["component1", "component2", "interruption1", "component3", "component4", "component5", "interruption2", "component6"],
  ["component1", "component2", "interruption1", "component3", "component4", "component5", "interruption2", "component6"],
  ["component1", "component2", "interruption1", "component3", "component4", "component5", "interruption2", "component6"],
  ...
]
```
*/
export interface DeterministicInterruption {
  /** The Location of the first instance of the interruption. If this is set to 2, the interruption will be shown after the second component (inserted at index 2). */
  firstLocation: number;
  /** The number of components between breaks. */
  spacing: number;
  /** The components that are included in the interruption. These reference components in the StudyConfig.components section of the config. */
  components: (string)[]
}

/** The RandomInterruption interface is used to define an interruption that will be shown randomly in the block.
 *
 * For example, if you want to show a single interruption randomly in the block, you would set `"spacing"` to "random" and `"numInterruptions"` to 1. If you want to show 3 interruptions randomly in the block, you would set `"spacing"` to "random" and `"numInterruptions"` to 3.
 *
 * The components property is an array of the components that will be inserted randomly in the block. These components should reference components in the StudyConfig.components section of the config.
 *
 * Here's an example of how to use the RandomInterruption:
 *
```js
{
  "order": "fixed",
  "components": [
    "component1",
    "component2",
    "component3",
    "component4",
    "component5",
    "component6"
  ],
  "interruptions": [
    {
      "spacing": "random",
      "numInterruptions": 3,
      "components": [
        "interruption1",
        "interruption2"
      ]
    }
  ]
}
```
 *
 * The resulting sequence array could be:
 *
```js
[
  ["component1", "interruption1", "interruption2", "component2", "interruption1", "interruption2", "component3", "component4", "component5", "interruption1", "interruption2", "component6"],
  ["component1", "interruption1", "interruption2", "component2", "interruption1", "interruption2", "component3", "component4", "interruption1", "interruption2", "component5", "component6"],
  ["component1", "component2" "interruption1", "interruption2", "component3", "interruption1", "interruption2", "component4", "component5", "interruption1", "interruption2", "component6"],
  ...
]
```
*/
export interface RandomInterruption {
  /** If spacing is set to random, reVISit will add interruptions randomly. These interruptions will not ever be displayed as the first component in the block. */
  spacing: 'random';
  /** The number of times the interruption will be randomly added */
  numInterruptions: number;
  /** The components that are included in the interruption. These reference components in the StudyConfig.components section of the config. */
  components: (string)[];
}

/**  The InterruptionBlock interface is used to define interruptions in a block. These can be used for breaks or attention checks. Interruptions can be deterministic or random. */
export type InterruptionBlock = DeterministicInterruption | RandomInterruption;

/** The IndividualComponentSingleResponseCondition interface is used to define a SkipCondition based on a single answer to a specific component. The skip logic will be checked for every component in the block that has the specified name.
 *
 * :::info
 *
 * If you need to check all instances of a repeated component, you should use the RepeatedComponentBlockCondition.
 *
 * :::
 *
 * For example, if you want to skip to a different component based on a response to a specific component, you would use the IndividualComponentSingleResponseCondition. Here's an example of how to use the IndividualComponentSingleResponseCondition:
 *
```js
{
  ...
  "skip": [
    {
      "name": "attentionCheck",
      "check": "response",
      "responseId": "attentionCheckResponse",
      "value": "the right answer",
      "comparison": "equal",
      "to": "end"
    }
  ]
  ...
}
```
 *
 * In this example, we assign our skip logic to the component whose ID is "attentionCheck". If the answer given to the response "attentionCheckResponse" is equal to "the right answer", then the user will be redirected to the end of the study. If the response is _not_ equal to "the right answer", then the participant will continue to the next component in the sequence.
*/
export interface IndividualComponentSingleResponseCondition {
  /** The name of the component to check. */
  name: string;
  /** The check we'll perform. */
  check: 'response';
  /** The response id to check. */
  responseId: string;
  /** The value to check. */
  value: string | number;
  /** The comparison to use. */
  comparison: 'equal' | 'notEqual';
  /** The id of the component or block to skip to */
  to: string;
}

/** The IndividualComponentAllResponsesCondition interface is used to define a SkipCondition based on all answers to a specific component. The skip logic will be checked for every component in the block that has the specified name.
 *
 * :::info
 *
 * If you need to check all instances of a repeated component, you should use the RepeatedComponentBlockCondition.
 *
 * :::
 *
 *
 * Here's an example of how to use the IndividualComponentAllResponsesCondition:
 *
```js
{
  ...
  "skip": [
    {
      "name": "attentionCheck",
      "check": "responses",
      "to": "end"
    }
  ]
  ...
}
```
 *
 * In this example, if all responses to the component with the ID "attentionCheck" are correct, the participant will be redirected to the end of the study. If any response is incorrect, the participant will continue to the next component in the sequence.
 */
export interface IndividualComponentAllResponsesCondition {
  /** The name of the component to check. */
  name: string;
  /** The check we'll perform. */
  check: 'responses';
  /** The id of the component or block to skip to */
  to: string;
}

/** The ComponentBlockCondition interface is used to define a SkipCondition based on the number of correct or incorrect components in a block. All answers on all components in the block are checked.
 *
 * Answers are checked against the correct answers defined in the IndividualComponent's [CorrectAnswer](../Answer). If no correct answers are defined, the component is considered correct by default.
 *
 * You might use this if a participant answers two questions in a block incorrectly. Here's an example of how to use the ComponentBlockCondition:
 *
```js
{
  ...
  "skip": [
    {
      "check": "block",
      "condition": "numIncorrect",
      "value": 2,
      "to": "end"
    }
  ]
  ...
}
```
 *
 * In this example, when the number of components with incorrect responses in the block is two, the participant will be redirected to the end of the study. If the number of incorrect responses is less than two, the participant will continue to the next component in the sequence.
 *
 * When the condition is met, the participant will immediately be redirected to the component or block specified in the `"to"` property. If no conditions are met, the participant will continue to the next component in the sequence.
*/
export interface ComponentBlockCondition {
  /** The check we'll perform. */
  check: 'block';
  /** The condition to check. */
  condition: 'numCorrect' | 'numIncorrect';
  /** The number of correct or incorrect responses to check for. */
  value: number;
  /** The id of the component or block to skip to */
  to: string;
}

/** The RepeatedComponentBlockCondition interface is used to define a SkipCondition based on the number of correct or incorrect repeated components. You might use this if you need to check if an attention check was failed multiple times. This is similar to the [ComponentBlockCondition](../ComponentBlockCondition), but it only checks a specific repeated component.
 *
 * Here's an example of how to use the RepeatedComponentBlockCondition:
 *
```js
{
  ...
  "skip": [
    {
      "name": "attentionCheck",
      "check": "repeatedComponent",
      "condition": "numIncorrect",
      "value": 2,
      "to": "end"
    }
  ]
  ...
}
```
 *
 * In this example, when the number of incorrect responses to the repeated component with the name "attentionCheck" is two, the participant will be redirected to the end of the study. If the number of incorrect responses is less than two, the participant will continue to the next component in the sequence.
*/
export interface RepeatedComponentBlockCondition {
  /** The name of the repeated component to check (e.g. attentionCheck). */
  name: string;
  /** The check we'll perform. */
  check: 'repeatedComponent';
  /** The condition to check. */
  condition: 'numCorrect' | 'numIncorrect';
  /** The number of correct or incorrect responses to check for. */
  value: number;
  /** The id of the component or block to skip to */
  to: string;
}

/** The SkipConditions interface is used to define skip conditions. This is used to skip to a different component/block based on the response to a component or based on the number of correct/incorrect responses in a block. Skip conditions work recursively: if you have a nested block, the parent blocks' skip conditions will be considered when computing the skip logic.
 *
 * Skip conditions are evaluated in the order they are defined in the array. If a condition is met, the participant will be redirected to the component or block specified in the `"to"` property. If no conditions are met, the participant will continue to the next component in the sequence.
 *
 * Skip conditions allow you to jump to a different component or block. If you intend to skip to a block, you should specify a block id in the sequence. If you intend to skip to a component, you should specify a component id. Skipping backwards is not supported. Skipping to a repeated component will skip to the first instance of the component after the component that triggered the skip.
 *
 * Please see the interface definitions for more specific information on the different types of skip conditions.
*/
export type SkipConditions = (IndividualComponentSingleResponseCondition | IndividualComponentAllResponsesCondition | ComponentBlockCondition | RepeatedComponentBlockCondition)[];

/**
 * The DynamicBlock interface is used to define a block where displayed components are controlled by a function. This is useful when you want to generate the sequence based on answers to previous questions or other factors.
 *
 * The functionPath property is a path to the function that generates the components. This should be a relative path from the src/public folder.
 *
 * Here's an example of how to use the DynamicBlock:
 *
 * ```js
 * {
 *   "id": "funcBlock",
 *   "order": "dynamic",
 *   "functionPath": "<study-name>/assets/function.js",
 *   "parameters": {
 *     "param1": "value1",
 *     "param2": "value2"
 *   }
 * }
 * ```
 */
export interface DynamicBlock {
  /** The id of the block. This is used to identify the block in the SkipConditions and is only required if you want to refer to the whole block in the condition.to property. */
  id: string
  /** The type of order. This can be random (pure random), latinSquare (random with some guarantees), or fixed. */
  order: 'dynamic';
  /** The path to the function that generates the components. This should be a relative path from the src/public folder. */
  functionPath: string;
  /** The parameters that are passed to the function. These can be used within your function to render different things. */
  parameters?: Record<string, unknown>;
}

/** The ComponentBlock interface is used to define order properties within the sequence. This is used to define the order of components in a study and the skip logic. It supports random assignment of trials using a pure random assignment and a [latin square](https://en.wikipedia.org/wiki/Latin_square).
 *
 * The pure random assignment is a random assignment with no guarantees. For example, one component _could_ show up in the first position 10 times in a row. However, this situation is unlikely.
 *
 Here's a snippet that shows how to use the random order:
 *
```js
{
  "order": "random",
  "components": [
    "component1",
    "component2",
    "component3"
  ]
}
```
 * This snippet would produce a random order of the components in the sequence array. For example, the resulting sequence array could be :
 *
```js
[
  ["component2", "component3", "component1"],
  ["component1", "component3", "component2"],
  ["component3", "component1", "component2"],
  ...
]
```
 *
 * The latin square assignment is a random assignment with some guarantees. It ensures that each component is shown an equal number of times in each position. Here's a snippet that shows how to use the latin square order:
 *
```js
{
  "order": "latinSquare",
  "components": [
    "component1",
    "component2",
    "component3"
  ]
}
```
 *
 * This snippet would produce a latin square order of the components in the sequence array. Since the latin square guarantees that each component is shown an equal number of times in each position, the resulting sequence array could be:
 *
```js
[
  ["component1", "component2", "component3"],
  ["component2", "component3", "component1"],
  ["component3", "component1", "component2"],
  ...
]
```
 *
 * The fixed assignment is a fixed assignment of components. This is used when you want to show the components in a specific order. Here's a snippet that shows how to use the fixed order:
 *
```js
{
  "order": "fixed",
  "components": [
    "component1",
    "component2",
    "component3"
  ]
}
```
 *
 * This snippet would produce a fixed order of the components in the sequence array. The resulting sequence array would be:
 *
```js
[
  ["component1", "component2", "component3"],
  ["component1", "component2", "component3"],
  ["component1", "component2", "component3"],
  ...
]
```
 *
 * In addition to the order property, the ComponentBlock interface also includes the `"numSamples"` property. This is used to reduce the number of components shown to a participant. This property respects the order property and the guarantees provided by the order property. For example, if you have three components in the components array and you set `"numSamples"` to 2, you would randomize across the three components while only showing a participant two of them. Here's a snippet that shows how to use the numSamples property:
 *
```js
{
  "order": "latinSquare",
  "components": [
    "component1",
    "component2",
    "component3"
  ],
  "numSamples": 2
}
```
 *
 * This snippet would produce a latin square order of the components in the sequence array. Since the latin square guarantees that each component is shown an equal number of times in each position, the resulting sequence array could be:
 *
```js
[
  ["component1", "component2"],
  ["component2", "component3"],
  ["component3", "component1"],
  ...
]
```
 *
 * The interruptions property specifies an array of interruptions. These can be used for breaks or attention checks. Interruptions can be deterministic or random. Please see [InterruptionBlock](../../type-aliases/InterruptionBlock) for more specific information.
 *
 * The skip property is used to define skip conditions. This is used to skip to a different component or block based on the response to a component or the number of correct or incorrect responses in a block. Please see [SkipConditions](../../type-aliases/SkipConditions) for more specific information.
*/
export interface ComponentBlock {
  /** The id of the block. This is used to identify the block in the SkipConditions and is only required if you want to refer to the whole block in the condition.to property. */
  id?: string
  /** The type of order. This can be random (pure random), latinSquare (random with some guarantees), or fixed. */
  order: 'random' | 'latinSquare' | 'fixed';
  /** The components that are included in the order. */
  components: (string | ComponentBlock | DynamicBlock)[];
  /** The number of samples to use for the random assignments. This means you can randomize across 3 components while only showing a participant 2 at a time. */
  numSamples?: number;
  /** The interruptions property specifies an array of interruptions. These can be used for breaks or attention checks.  */
  interruptions?: InterruptionBlock[];
  /** The skip conditions for the block. */
  skip?: SkipConditions;
}

/** An InheritedComponent is a component that inherits properties from a baseComponent. This is used to avoid repeating properties in components. This also means that components in the baseComponents object can be partially defined, while components in the components object can inherit from them and must be fully defined and include all properties (after potentially merging with a base component). */
export type InheritedComponent = (Partial<IndividualComponent> & { baseComponent: string })

/** The baseComponents is an optional set of components which can help template other components. For example, suppose you have a single HTML file that you want to display to the user several times. Instead of having the same component twice in the `components` list, you can have a single baseComponent with all the information that the two HTML components will share. A great example is showing the same HTML component but with two different questions;

   * Using baseComponents:

```js
"baseComponents": {
  "my-image-component": {
    "instructionLocation": "sidebar",
    "nextButtonLocation": "sidebar",
    "path": "<study-name>/assets/my-image.jpg",
    "response": [
      {
        "id": "my-image-id",
        "options": ["Europe", "Japan", "USA"],
        "prompt": "Your Selected Answer:",
        "type": "dropdown"
      }
    ],
    "type": "image"
  }
}
```
In the above code snippet, we have a single base component which holds the information about the type of component, the path to the image, and the response (which is a dropdown containing three choices). Any component which contains the `"baseComponent":"my-image-component"` key-value pair will inherit each of these properties. Thus, if we have three different questions which have the same choices and are concerning the same image, we can define our components like below:
```js
"components": {
  "q1": {
    "baseComponent": "my-image-component",
    "description": "Choosing section with largest GDP",
    "instruction": "Which region has the largest GDP?"
  },
"q2": {
  "baseComponent": "my-image-component",
  "description": "Choosing section with lowest GDP",
  "instruction": "Which region has the lowest GDP?"
},
"q3": {
  "baseComponent": "my-image-component",
  "description": "Choosing section with highest exports of Wheat",
  "instruction": "Which region had the most Wheat exported in 2022?"
}
}
```
  */
export type BaseComponents = Record<string, Partial<IndividualComponent>>;

/**
 * The StudyConfig interface is used to define the properties of a study configuration. This is a JSON object with four main components: the StudyMetadata, the UIConfig, the Components, and the Sequence. Below is the general template that should be followed when constructing a Study configuration file.

```js
{
  "$schema": "https://raw.githubusercontent.com/revisit-studies/study/v2.2.0/src/parser/StudyConfigSchema.json",
  "studyMetadata": {
    ...
  },
  "uiConfig": {
    ...
  },
  "components": {
    ...
  },
  "sequence": {
    ...
  }
}
```

:::info
For information about each of the individual pieces of the study configuration file, you can visit the documentation for each one individually.
:::
<br/>

The `$schema` line is used to verify the schema. If you're using VSCode (or other similar IDEs), including this line will allow for autocomplete and helpful suggestions when writing the study configuration.
 */
export interface StudyConfig {
  /** A required json schema property. This should point to the github link for the version of the schema you would like. The `$schema` line is used to verify the schema. If you're using VSCode (or other similar IDEs), including this line will allow for autocomplete and helpful suggestions when writing the study configuration. See examples for more information */
  $schema: string;
  /** The metadata for the study. This is used to identify the study and version in the data file. */
  studyMetadata: StudyMetadata;
  /** The UI configuration for the study. This is used to configure the UI of the app. */
  uiConfig: UIConfig;
  /** A list of libraries that are used in the study. This is used to import external libraries into the study. Library names are valid namespaces to be used later. */
  importedLibraries?: string[];
  /** The base components that are used in the study. These components can be used to template other components. See [BaseComponents](../../type-aliases/BaseComponents) for more information. */
  baseComponents?: BaseComponents;
  /** The components that are used in the study. They must be fully defined here with all properties. Some properties may be inherited from baseComponents. */
  components: Record<string, IndividualComponent | InheritedComponent>
  /** The order of the components in the study. This might include some randomness. */
  sequence: ComponentBlock | DynamicBlock;
}

/**  LibraryConfig is used to define the properties of a library configuration. This is a JSON object with three main components: baseComponents, components, and the sequences. Libraries are useful for defining components and sequences of these components that are to be reused across multiple studies. We (the reVISit team) provide several libraries that can be used in your study configurations. Check the public/libraries folder in the reVISit-studies repository for available libraries. We also plan to accept community contributions for libraries. If you have a library that you think would be useful for others, please reach out to us. We would love to include it in our repository.
 *
 * Below is the general template that should be followed when constructing a Library configuration file.
 *
 * ```js
 * {
 *   "$schema": "https://raw.githubusercontent.com/revisit-studies/study/v2.2.0/src/parser/LibraryConfigSchema.json",
 *   "baseComponents": {
 *     // BaseComponents here are defined exactly as is in the StudyConfig
 *   },
 *   "components": {
 *     // Components here are defined exactly as is in the StudyConfig
 *   },
 *   "sequences": {
 *    // Sequences here are defined as "key": "value" pairs where the key is the name of the sequence and the value is a ComponentBlock, just like in the StudyConfig
 *   }
 * }
 * ```
 */
export interface LibraryConfig {
  /** A required json schema property. This should point to the github link for the version of the schema you would like. The `$schema` line is used to verify the schema. If you're using VSCode (or other similar IDEs), including this line will allow for autocomplete and helpful suggestions when writing the study configuration. See examples for more information */
  $schema: string;
  /** A description of the library. */
  description: string;
  /** The components that are used in the study. They must be fully defined here with all properties. Some properties may be inherited from baseComponents. */
  components: Record<string, IndividualComponent | InheritedComponent>
  /** The order of the components in the study. This might include some randomness. */
  sequences: Record<string, StudyConfig['sequence']>;
  /** Additional description of the library. It accepts markdown formatting. */
  additionalDescription?: string;
  /** The reference to the paper where the content of the library is based on. */
  reference?: string;
  /** The DOI of the paper where the content of the library is based on. */
  doi?: string;
  /** The external link to the paper/website where the content of the library is based on. */
  externalLink?: string;
  /** The base components that are used in the study. These components can be used to template other components. See [BaseComponents](../../type-aliases/BaseComponents) for more information. */
  baseComponents?: BaseComponents;
}

/**
 * @ignore
 * Helper error type to make reading the error messages easier
 */
export type ParserErrorWarning = {
  instancePath: string;
  message?: string;
  params: object;
}

/**
 * @ignore
 * Helper type to write the study config with with errors key
 */
export type ParsedConfig<T> = T & {
  errors: ParserErrorWarning[]
  warnings: ParserErrorWarning[]
}

/**
 * @ignore
 * Helper type to avoid writing Type | undefined | null
 */
export type Nullable<T> = T | undefined | null;

/**
 * @ignore
 * Helper type to get the value of a type
 */
export type ValueOf<T> = T[keyof T];

/**
 * @ignore
 * Helper type to make reading derived union and intersection types easier.
 * Purely aesthetic
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];

} & {};
