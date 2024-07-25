// eslint-disable-next-line import/no-cycle
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
  "sidebar": true,
  "windowEventDebounceTime": 500,
  "urlParticipantIdParam": "PROLIFIC_ID",
  "numSequences": 500
}
```
In the above, the `path/to/assets/` path is referring to the path to your individual study assets. It is common practice to have your study directory contain an `assets` directory where all components and images relevant to your study reside. Note that this path is relative to the `public` folder of the repository - as is all other paths you define in reVISit (aside from React components whose paths are relative to `src/public`.)
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
  /** The width of the left sidebar. Defaults to 300. */
  sidebarWidth?: number;
  /** Debounce time in milliseconds for automatically tracked window events. Defaults to 100. E.g 100 here means 1000ms / 100ms = 10 times a second, 200 here means 1000ms / 200ms = 5 times per second  */
  windowEventDebounceTime?: number;
  /**
   * If the participant ID is passed in the URL, this is the name of the querystring parameter that is used to capture the participant ID (e.g. PROLIFIC_ID). This will allow a user to continue a study on different devices and browsers.
   */
  urlParticipantIdParam?: string;
  /**
   * The number of sequences to generate for the study. This is used to generate the random sequences for the study. The default is 1000.
   */
  numSequences?: number;
  /**
   * Whether to prepend questions with their index (+ 1). This should only be used when all questions are in the same location, e.g. all are in the side bar.
   */
  enumerateQuestions?: boolean;
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
 * The StringOption interface is used to define the options for a dropdown, radio, or checkbox response.
 * The label is the text that is displayed to the user, and the value is the value that is stored in the data file.
 */
export interface StringOption {
  /** The label displayed to participants. */
  label: string;
  /** The value stored in the participant's data. */
  value: string;
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
  /** The prompt that is displayed to the participant. You can use markdown here to render images, links, etc. */
  prompt: string;
  /** The secondary text that is displayed to the participant under the prompt. This does not accept markdown. */
  secondaryText?: string;
  /** Controls whether the response is required to be answered. */
  required: boolean;
  /** Controls the response location. These might be the same for all responses, or differ across responses. Defaults to `belowStimulus` */
  location?: ResponseBlockLocation;
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
 *
 * Example:
```js
{
  "id": "q-numerical",
  "prompt": "Numerical example",
  "required": true,
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
  "required": true,
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
  "required": true,
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
  "required": true,
  "location": "aboveStimulus",
  "type": "likert",
  "leftLabel": "Not Enjoyable",
  "rightLabel": "Very Enjoyable",
  "numItems": 5
}
```
 */
export interface LikertResponse extends BaseResponse {
  type: 'likert';
  /** The number of options to render. */
  numItems: number;
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
 *
 * Example:
```js
{
  "id": "q-color",
  "prompt": "What is your favorite color?",
  "required": true,
  "location": "aboveStimulus",
  "type": "dropdown",
  "placeholder": "Please choose your favorite color",
  "options": [
    {
      "label": "Red",
      "value": "red"
    },
    {
      "label": "Blue",
      "value": "blue"
    }
  ]
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
  options: StringOption[];
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
  "required": true,
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
  "required": true,
  "location": "aboveStimulus",
  "type": "radio",
  "options": [
    {
      "label": "Option 1",
      "value": "opt-1"
    },
    {
      "label": "Option 2",
      "value": "opt-2"
    }
  ]
}
```
 *
 */
export interface RadioResponse extends BaseResponse {
  type: 'radio';
  /** The options that are displayed as checkboxes, provided as an array of objects, with label and value fields. */
  options: StringOption[];
  /** The left label of the radio group. Used in Likert scales for example */
  leftLabel?: string;
  /** The right label of the radio group. Used in Likert scales for example */
  rightLabel?: string;
}

/**
 * The CheckboxResponse interface is used to define the properties of a checkbox response.
 * CheckboxResponses render as a checkbox input with user specified options.
 *
```js
{
  "id": "q7",
  "prompt": "Checkbox example (not required)",
  "required": false,
  "location": "aboveStimulus",
  "type": "checkbox",
  "options": [
    {
      "label": "Option 1",
      "value": "opt-1"
    },
    {
      "label": "Option 2",
      "value": "opt-2"
    },
    {
      "label": "Option 3",
      "value": "opt-3"
    }
  ]
}
```
 */
export interface CheckboxResponse extends BaseResponse {
  type: 'checkbox';
  /** The options that are displayed as checkboxes, provided as an array of objects, with label and value fields. */
  options: StringOption[];
  /** The minimum number of selections that are required. */
  minSelections?: number;
  /** The maximum number of selections that are required. */
  maxSelections?: number;
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
      "required": true,
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
  /** The text that is displayed on the next button. */
  nextButtonText?: string;
  /** The location of the next button. */
  nextButtonLocation?: ResponseBlockLocation;
  /** The location of the instructions. */
  instructionLocation?: ResponseBlockLocation;
  /** The correct answer to the component. This is used for training trials where the user is shown the correct answer after a guess. */
  correctAnswer?: Answer[];
  /** Controls whether the component should provide feedback to the participant, such as in a training trial. If not provided, the default is false. */
  provideFeedback?: boolean;
  /** The meta data for the component. This is used to identify and provide additional information for the component in the admin panel. */
  meta?: Record<string, unknown>;
  /** The description of the component. This is used to identify and provide additional information for the component in the admin panel. */
  description?: string;
  /** The instruction of the component. This is used to identify and provide additional information for the component in the admin panel. */
  instruction?: string;
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
 * https://revisit.dev/study/demo-click-accuracy-test (https://github.com/revisit-studies/study/tree/v1.0.1/src/public/demo-click-accuracy-test/assets)
 * https://revisit.dev/study/demo-brush-interactions (https://github.com/revisit-studies/study/tree/v1.0.1/src/public/demo-brush-interactions/assets)
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
  /** The path to the image. This should be a relative path from the public folder. */
  path: string;
  /** The style of the image. This is an object with css properties as keys and css values as values. */
  style?: Record<string, string>;
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
  }
  "response": [
    {
      "id": "barChart",
      "prompt": "Your selected answer:",
      "required": true,
      "location": "belowStimulus",
      "type": "iframe"
    }
  ],
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
      "required": true,
      "location": "belowStimulus",
      "type": "checkbox",
      "options": [
        {
          "label": "Man",
          "value": "Man"
        },
        {
          "label": "Woman",
          "value": "Woman"
        },
        {
          "label": "Genderqueer",
          "value": "Genderqueer"
        },
        {
          "label": "Third-gender",
          "value": "Third-gender"
        },
        ... etc.
      ]
    }
  ]
}
```
 */
export interface QuestionnaireComponent extends BaseIndividualComponent {
  type: 'questionnaire';
}

export type IndividualComponent = MarkdownComponent | ReactComponent | ImageComponent | WebsiteComponent | QuestionnaireComponent;

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
  ["component1", "interruption1", "interruption2", "component2", "interruption1", "interruption2", "component3", "component4", "component5", "interruption1", "interruption2", "component6],
  ["component1", "interruption1", "interruption2", "component2", "interruption1", "interruption2", "component3", "component4", "interruption1", "interruption2", "component5", "component6],
  ["component1", "component2" "interruption1", "interruption2", "component3", "interruption1", "interruption2", "component4", "component5", "interruption1", "interruption2", "component6],
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
  components: (string | ComponentBlock)[];
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
        "options": [
          {
            "label": "Europe",
            "value": "Europe"
          },
          {
            "label": "Japan",
            "value": "Japan"
          },
          {
            "label": "USA",
            "value": "USA"
          }
        ],
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
  "$schema": "https://raw.githubusercontent.com/revisit-studies/study/v1.0.1/src/parser/StudyConfigSchema.json",
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
  /** The base components that are used in the study. These components can be used to template other components. See [BaseComponents](../../type-aliases/BaseComponents) for more information. */
  baseComponents?: BaseComponents;
  /** The components that are used in the study. They must be fully defined here with all properties. Some properties may be inherited from baseComponents. */
  components: Record<string, IndividualComponent | InheritedComponent>
  /** The order of the components in the study. This might include some randomness. */
  sequence: ComponentBlock;
}

/**
 * @ignore
 * Helper type to write the study config with with errors key
 */
export type ParsedStudyConfig = StudyConfig & {
  errors: { instancePath: string, message?: string, params: object }[]
  warnings: { instancePath: string, message?: string, params: object }[]
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
