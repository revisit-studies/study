# Reference Documentation


## General reVISit 

- [GlobalConfig](interfaces/GlobalConfig.md) — The GlobalConfig is used to generate the list of available studies in the UI. 

## Data Fromats

- [ParticipantData](interfaces/ParticipantData.md) – The ParticipantData is a JSON object that contains all of the data for all of the participants in your study.
- [StoredAnswer](interfaces/StoredAnswer.md) - The StoredAnswer object is a data structure describing the participants interaction with an individual component. It is used by ParticipantData to store individual answers.

## reVISit Spec


- [StudyConfig](interfaces/StudyConfig.md) – The StudyConfig interface is used to define the properties of a study configuration. This is a JSON object with four main components: the StudyMetadata, the UIConfig, the Components, and the Sequence. 

- [StudyMetadata](interfaces/StudyMetadata.md) – A top-level property of the `StudyConfig`. The study metadata defines elements such as the study title, authors, and description.
- [UIConfig](interfaces/UIConfig.md) – A top-level property of the `StudyConfig`, defining the apperance of the study.

For other components of the reVISit spec see [Components](#Components) and [Sequencing](#Sequencing)

## Components

Components contain study-specific conent. See the [How does it Work](https://revisit.dev/docs/getting-started/how-does-it-work) guide for an introduction.

Each component extends the [BaseIndividualComponent](interfaces/BaseIndividualComponent) interface. To add a component to your study (which can be thought of as a "page" of your study), you add a JSON object representing that component to the "components" object with a key which you can define how you would like. Then, the `type` key in that JSON object controls which type of component you are referring to. 

### Collecting Responses

Each component has a list of responses which represents a set of questions to ask to the user for that particular component. The user can describe where the question should be displayed in the UI, the instruction for the response, and the type of response input (e.g., a [numerical response](interfaces/NumericalResponse), a [dropdown](interfaces/DropdownResponse), a [slider](interfaces/SliderResponse), etc). Each response interface extends the [BaseResponse](interfaces/BaseResponse) interface.

The below example illustrates a simple consent component that is based on a Markdown file and has a response that asks for a signature: 

```js
  "consent": {
            "type": "markdown",
            "path": "demo-brush-interactions/assets/consent.md",
            "nextButtonText": "Agree",
            "response": [
                {
                    "id": "signature",
                    "prompt": "Your signature",
                    "required": true,
                    "location": "belowStimulus",
                    "type": "shortText",
                    "placeholder": "Please provide your signature"
                }
            ]
        }
```

For more detailed documentation on the response section, check out the [documentation](interfaces/BaseResponse).

## Base Components and Inheritance

[Base Components](type-aliases/BaseComponents) can be used to implement inheritance for components. This is often useful if you want to parameterize a component. For example: 

* You might have a stimulus, such as an image, where you want to ask multiple different questions.  
* You might have a generic implementation of a stimulus, such as a bar chart, and you want to pass in data to change how the stimulus appears. 

In both of these cases, you can set up a component once as a `baseComponent`, including linking to the stimulus and including (partial) responses, but then later write inherited, short components that extend the base component with the specific functionality you want. 

For examples of how to write a base component, refer to the [documentation](type-aliases/BaseComponents) and to the [relevant tutorial](../tutorials/html-stimulus).


The different component types: 
- [ImageComponent](interfaces/ImageComponent.md)
- [MarkdownComponent](interfaces/MarkdownComponent.md)
- [QuestionnaireComponent](interfaces/QuestionnaireComponent.md)
- [ReactComponent](interfaces/ReactComponent.md)
- [WebsiteComponent](interfaces/WebsiteComponent.md)

## Responses

Responses are expected as a reaction to many components. Responses are given to administrative forms, such as consent or training, but mostly as a response to a stimulus. 
- [Response](type-aliases/Response.md)
- [IFrameResponse](interfaces/IFrameResponse.md)
- [Answer](interfaces/Answer.md)

### Form Elements

Responses are often provided as form elements. reVISit supports the following form elements.

- [BaseResponse](interfaces/BaseResponse.md)
- [CheckboxResponse](interfaces/CheckboxResponse.md)
- [DropdownResponse](interfaces/DropdownResponse.md)
- [LikertResponse](interfaces/LikertResponse.md)
- [LongTextResponse](interfaces/LongTextResponse.md)
- [NumericalResponse](interfaces/NumericalResponse.md)
- [Option](interfaces/Option.md)
- [RadioResponse](interfaces/RadioResponse.md)
- [ShortTextResponse](interfaces/ShortTextResponse.md)
- [SliderResponse](interfaces/SliderResponse.md)

## Sequencing

Sequencing determines the order in which components appear.

- [Sequence](interfaces/Sequence.md) – TODO - needs documentation

- [ComponentBlock](interfaces/ComponentBlock.md) — The ComponentBlock interface is used to define order properties within the sequence.

- [DeterministicInterruption](interfaces/DeterministicInterruption.md)
- [RandomInterruption](interfaces/RandomInterruption.md)
- [InterruptionBlock](type-aliases/InterruptionBlock.md)

- [SkipConditions](type-aliases/SkipConditions.md)
- [ComponentBlockCondition](interfaces/ComponentBlockCondition.md)
- [IndividualComponentAllResponsesCondition](interfaces/IndividualComponentAllResponsesCondition.md)
- [IndividualComponentSingleResponseCondition](interfaces/IndividualComponentSingleResponseCondition.md)
- [RepeatedComponentBlockCondition](interfaces/RepeatedComponentBlockCondition.md)






