/**
 * Authors: The ReVISit team
 * Description:
 *    This file is the base component for the Parallel Coordinate plot trials written in the config.json
 * Possible next steps:
 *    regarding the paper,
 *    https://classes.engineering.wustl.edu/cse557/spring2017/readings/ranking-correlations.pdf,
 *    add an F-test after 24 user selections, "the 24 user judgments are divided into 3 subgroups,
 *    and convergence is reached when there is no significant difference between these three
 *    subgroups".
 */

import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import { Center, Stack, Text } from '@mantine/core';
import { StimulusParams } from '../../../../../../store/types';
import ParallelCoordinatesWrapper from './ParallelCoordinatesWrapper';

/**
 * Displays user's experiemnt. (This includes 2 scatter plots and a progress bar).
 * Once completed (after 50 selections or the graphs converge) it nofifys the user
 * to continue on.
 * @param param0 - setAnswer is a function that fills the response, parameters are
 * r1 (base correlation value, does not change), r2 (other correlation value, does change
 * depending on the user's actions), above (a boolean determining whether it is an above or
 * below experiment)
 * @returns 2 scatter plots and a progress bar during the experiment or a message of completion
 * of the trial
 */
export default function JND({ setAnswer, parameters } : StimulusParams<{r1: number, r2:number, above: boolean}>) {
  const [counter, setCounter] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [above, setAbove] = useState(parameters.above);
  const [participantSelections, setParticipantSelections] = useState<{correct: boolean}[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [r1, setR1] = useState(parameters.r1);
  const [r2, setR2] = useState(parameters.r2);

  const onClick = useCallback((n: number) => {
    setParticipantSelections([...participantSelections, { correct: n === 1 }]);
    setCounter(counter + 1);
    if (above && n === 2) {
      if (r2 < r1 || r2 - r1 <= 0.01) {
        // correct and user converges graphs
        setCounter(50);
      } else {
        // correct
        setR2(Math.min(r2 - 0.01, 1));
      }
    } else if (above && n === 1) {
      // incorrect
      if (r2 >= 1) {
        setR2(1);
      } else {
        setR2(Math.max(r2 + 0.03, 0));
      }
    } else if (!above && n === 1) {
      if (r1 < r2 || r1 - r2 <= 0.01) {
        // correct and user converges graphs
        setCounter(50);
      } else {
        // correct
        setR2(Math.min(r2 + 0.01, 1));
      }
    } else if (!above && n === 2) {
      // incorrect
      if (r2 <= 0) {
        setR2(0);
      }
      setR2(Math.max(r2 - 0.03, 0));
    }
  }, [above, counter, participantSelections, r1, r2]);

  useEffect(() => {
    if (counter === 50) {
      setAnswer({
        status: true,
        provenanceGraph: undefined,
        answers: { parallelSelections: participantSelections },
      });
    }
  }, [counter, participantSelections, setAnswer]);

  if (counter === 50) {
    return (
      <Text>Completed! Great job, please continue.</Text>
    );
  }

  return (
    <Stack style={{ width: '100%', height: '100%' }}>
      <Text style={{
        textAlign: 'center', paddingBottom: '24px', fontSize: '18px', fontWeight: 'bold',
      }}
      >
        Select the option with the higher correlation
      </Text>
      <Center>
        <ParallelCoordinatesWrapper onClick={onClick} r1={r1} r2={r2} />
      </Center>
      <Center style={{ marginTop: 20 }}>
        <progress value={counter} max={50} />
      </Center>
    </Stack>
  );
}
