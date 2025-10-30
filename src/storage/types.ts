import { ParticipantMetadata, Sequence, StoredAnswer } from '../store/types';

/**
The ParticipantData is a JSON object that contains all of the data for all of the participants in your study. It is structured as a list. Each element refers to a participants data or a configuration. While in many cases there is only one configuration per study, the study creator is allowed to change the configuration file after the study has already been completed by other participants. The data for each participant will have a "participantConfigHash" which refers to a particular configuration which is also in this list.

Below we have an example of a participants data.
```js
[
    {
        "participantId": <UUID4>,
        "participantConfigHash": <CONFIG_ID>,
        "sequence": {
            ...
        },
        "answers": {
            ...
        },
        "searchParameters": {
            ...
        }
    }
]
```
Each key in answer will be labeled the same as the response component that it refers to. The sequence shows the order that the participant saw each component (since these may be different for each participant if the configuration sequence has some randomization). This answer will contain information such as the start time, the end time, and all of the window events. See the example below.

```js
     "bar-chart-1_1": {
        "answer": {
          "barChart": [
            1.3
          ]
        },
        "startTime": 1711641174858,
        "endTime": 1711641178836,
        "provenanceGraph":{
          ...
        },
        "windowEvents": [
          ...
        ]
      }
```
The keys of this object are the names of the components with an additional underscore and number appended to the end. This is done so that the study creator can discern between not only the components but also between the various instances of the same component when necessary. All times are in **epoch milliseconds**.

:::info
The `"provenanceGraph"` key will only exist if the component is a React component and if it is utilizing Trrack. See [here](../StoredAnswer) for more details.
:::

We can see at a high level that we are given the answer that the user submitted, the start time for the component, and the end time. In addition to this, we have a list of window events. You can find more information about the StoredAnswer object [here](../StoredAnswer).
*/
export interface ParticipantData {
  /** Unique ID  associated with the participant */
  participantId: string;
  /** Unique ID corresponding to the Configuration that the participant received. */
  participantConfigHash: string;
  /** Sequence of components that the participant received. This is an internal data type and is compiled from the ComponentBlocks in the StudyConfig sequence. */
  sequence: Sequence;
  /** Index of the participant in the study. */
  participantIndex: number;
  /** Object whose keys are the component names and values are StoredAnswer objects. */
  answers: Record<string, StoredAnswer>;
  /** Query parameters of the URL used to enter the study. */
  searchParams: Record<string, string>;
  /** Metadata of a participants browser, resolution, language, and IP. */
  metadata: ParticipantMetadata
  /** Whether the participant has completed the study. */
  completed: boolean;
  /** Whether the participant has been rejected and the reason. */
  rejected: {
    reason: string;
    timestamp: number;
  } | false;
  /** The component blocks that the participant entered. */
  participantTags: string[];
  /** The stage of the participant in the study. */
  stage: string;
}
