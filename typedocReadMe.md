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

TODO: Explain what these are
- [BaseIndividualComponent](interfaces/BaseIndividualComponent.md)
- [IndividualComponent](type-aliases/IndividualComponent.md)
- [InheritedComponent](type-aliases/InheritedComponent.md)


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






