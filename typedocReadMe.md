# Documentation

Below we provide some additional information for the study configuration and its components. With this documentation, you will be able to alter your study configuration file to meet your specific use cases.

We use <a href="https://typedoc.org/" target="_blank">TypeDoc</a> to generate documentation for each type in our code base. The documentation can be found [here](modules.html). 

# Study Configuration

The Study Configuration file is how we describe all of the information necessary to create a study. In this configuration, we describe the metadata for the study, the configuration of the UI, the set of components, and how we sequence them in the study. You can find the detailed documentation for the study configuration [here](/typedoc/interfaces/StudyConfig.html).

## Study Metadata

The study metadata defines elements such as the study title, authors, and description. The title and description are shown on the landing page when you have multiple studies. The other fields are hidden to the user, but are saved to the database with participant tracking information. This allows you to see which version of the study a participant took. For more detailed documentation on the study metadata, check out the [documentation](/typedoc/interfaces/StudyMetadata.html).


## UI Configuration

The UI configuration tells reVISit how the UI should be laid out, such as which image to use for the study logo, whether to include a sidebar, the contact email, etc. For more detailed documentation on the UI configuration, check out the [documentation](/typedoc/interfaces/UIConfig.html).


## Study Components

Study components are the building blocks for each study. There are currently 5 types of components: [Image](/typedoc/interfaces/ImageComponent.html), [Website](/typedoc/interfaces/WebsiteComponent.html), [Questionnaire](/typedoc/interfaces/QuestionnaireComponent.html), [React](/typedoc/interfaces/ReactComponent.html), and [Markdown](/typedoc/interfaces/MarkdownComponent.html). Each component extends the [BaseIndividualComponent]((/typedoc/interfaces/BaseIndividualComponent.html)) interface. To add a component to your study (which can be thought of as a "page" of your study), you add a JSON object representing that component to the "components" object with a key which you can define how you would like. Then, the "type" key in that JSON object controls which type of component you are referring to. If you are utilizing the "baseComponents" object of the configuration file, you will specify a "baseComponent" key rather than a "type" key. You can find more examples of each of these components within their individual documentation.

#### Collecting Responses

Each component has a list of responses which represents a set of questions to ask to the user for that particular component. The user can describe where the question should be displayed in the UI, the type of response input (e.g. a [numerical response](/typedoc/interfaces/NumericalResponse.html), a [dropdown](/typedoc/interfaces/DropdownResponse.html), a [slider](/typedoc/interfaces/SliderResponse.html), etc.), and more. Each response interface extends the [BaseResponse](/typedoc/interfaces/BaseResponse.html) interface. For more detailed documentation on the response section, check out the [documentation](/typedoc/index.html#response).


## Sequence

The sequence object of the study configuration defines the order of your defined components. The standard ordering is a "fixed" ordering where components are displayed in the order that they are placed in the sequence list. reVISit also supports randomization of the components (using either true randomization or a "latin square" technique). The sequence uses the [OrderObject](/typedoc/interfaces/OrderObject.html) interface. This order object takes in a list of "components" to display and will allow you to assign the order. It is designed in a nested fashion which means that an entry in your "components" list can either be the name of one of your components or another OrderObject. This allows the user to have several fixed pages (such as an introduction and consent form) while still randomizing the rest. You can find more detailed documentation about the sequence list [here](/typedoc/interfaces/OrderObject.html).




