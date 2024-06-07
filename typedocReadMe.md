# Documentation


To create a study with reVISit, you have to create **components** that contain the content of your study, and you have to create the **study configuration (the reVISit Spec)** that controls when and how these components are shown to participants. Here, we will introduce these at a high level and link to complete documentation where appropriate. 


The technical documentation can be found [here](globals). 

# Components

Components are where study-specific content goes. ReVISit currently supports five types of components: 

* **Markdown Files** contain formatted text, including links, images, embedded videos, etc. They are useful for introductions, consent forms, help pages, etc. 
* **Images** can be used as stimuli directly. 
* **HTML Pages** can be used to create custom stimuli, including interactive stimuli developed with JavaScript 
* **React Components** can be used for sophisticated interactive stimuli. In comparison to HTML pages, react components simplify the communication between reVISit and the stimulus. 
* **Survey Questions** can be used to elicit structured responses from participants.


All of these stimuli can be (and commonly are) paired with **responses**. Responses are form elements that capture the elicited responses. Survey questions are basically empty components with responses. 

A component is typically defined in the spec, with the text, code, or image included from a file/URL. The only exception are survey questions, which do not need a file/URL.


# The reVISit Spec

The reVISit Spec enables you to define the details of your experiment as a JSON file. The reVISit Spec has five top-level concepts: 

* Study Metadata – setting things like the name of the study, authors, contact e-mails
* UI Config – parameterizing the appearance of reVISit
* Components and BaseComponents – setting up the content of the study
* Sequence – choosing the order and the selection of tasks participants see. 

We'll explain the ideas in the next section, and link to the documentation for more details. 

You can find the detailed documentation for the reVISit Spec [here](interfaces/StudyConfig).


## Study Metadata

The study metadata defines elements such as the study title, authors, and description. The title and description are shown on the landing page when you have multiple studies. The other fields are hidden to the user, but are saved to the database with participant tracking information. This allows you to see which version of the study a participant took. For more detailed documentation on the study metadata, check out the [documentation](interfaces/StudyMetadata).


## UI Configuration

The UI configuration tells reVISit how the UI should be laid out, such as which image to use for the study logo, whether to include a sidebar, the contact email, etc. For more detailed documentation on the UI configuration, check out the [documentation](interfaces/UIConfig).


## Components

Components are the building blocks for each study. 
There are currently 5 types of components: 
* [Image](interfaces/ImageComponent), 
* [Website](interfaces/WebsiteComponent), 
* [Questionnaire](interfaces/QuestionnaireComponent), 
* [React](interfaces/ReactComponent), and 
* [Markdown](interfaces/MarkdownComponent).

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

[Base Components](interfaces/StudyConfig#basecomponents) can be used to implement inheritance for components. This is often useful if you want to parameterize a component. For example: 

* You might have a stimulus, such as an image, where you want to ask multiple different questions.  
* You might have a generic implementation of a stimulus, such as a bar chart, and you want to pass in data to change how the stimulus appears. 

In both of these cases, you can set up a component once as a `baseComponent`, including linking to the stimulus and including (partial) responses, but then later write inherited, short components that extend the base component with the specific functionality you want. 

For examples of how to write a base component, refer to the [documentation](interfaces/StudyConfig#basecomponents) and to the [relevant tutorial](../getting-started/tutorial-questionnaire#adding-custom-html).


## Sequence

The sequence object of the study configuration defines (a) the order participants see your components and (b) determines which components they see. ReVISit supports sophisticated ordering strategies, interruptions and skip logic. Specifically, revisit supports: 

* **Ordering Strategies:** (See [ComponentBlock](interfaces/ComponentBlock) for more details
    * **Fixed** order: participants see the components the way they are defined in the sequence
    * **Random** order: the order of the components are randomized
    * **[Latin Square](https://en.wikipedia.org/wiki/Latin_square)**: permute the order of stimuli but ensure that for a set of participants, each component occurs at each index an equal amount of times throughout the sequence (e.g. if there are 100 participants and 10 components, each component is seen at each index 10 times).
* **Sampling:**  `numSamples` draws a given number of items from a block. numSamples can be used in combination with each ordering strategy (while preserving ordering guarantees).
* **Interruptions** can be used to insert breaks and attention checks into a block. See [InterruptionBlock](type-aliases/InterruptionBlock) for more details.
* **Skip Logic** can be used to control flow based on the response to a question or a component block. See [SkipConditions](type-aliases/SkipConditions) for more details.

All of these can be applied on arbitrarily nested "blocks", i.e., it is designed in a nested fashion which means that an entry in the "components" list can either be the name of a components or another `ComponentBlock`. For example, the overall structure of a study can be linear (introduction, consent, tutorial, trials, survey), but within trials we can use random order:  


```js
 "sequence": {
        "order": "fixed",
        "components": [
            "introduction",
            "consent",
            "tutorial",
            {
                "order": "random",
                "components": [
                    "paintBrush_q1",
                    "rectangleBrush_q1",
                    "axisBrush_q1",
                    "sliderBrush_q1"
                ]
            },
            "post-study-survey",
            "survey"
        ]
    }
```

You can find more detailed documentation about the sequencing strategies [here](interfaces/ComponentBlock).
