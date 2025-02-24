/**
 * Authors: The ReVISit team
 * Description:
 *    This file is component for the Scatter plot experiemnt. Alternate version of the JNDScatterRevised.
 *    Meant for easy understanding of the experiment code.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import { Center, Stack, Text } from '@mantine/core';
import { StimulusParams } from '../../../../../../store/types';
import ScatterWrapper from './ScatterWrapper';

const startingArr1 = [0.6, 0.7, 0.8];
const startingArr2 = [0.3, 0.4, 0.5];

/**
 * Displays user's experiemnt. (This includes 2 scatter plots and progress indication). Users
 * are randomly given a r1 value from the startingArr1 and a r2 value from the startingArr2.
 * @param param0 - setAnswer is a function that fills the response
 * @returns 2 scatter plots and a progress indication.
 */
function JND({ setAnswer } : StimulusParams<Record<string, never>>) {
  const [counter, setCounter] = useState(0);
  const [r1, setR1] = useState(startingArr1[Math.floor(Math.random() * startingArr1.length)]);
  const [r2, setR2] = useState(startingArr2[Math.floor(Math.random() * startingArr2.length)]);

  const [participantSelections, setParticipantSelections] = useState<{r1: number, r2: number, correct: boolean}[]>([]);

  const onClick = useCallback((n: number) => {
    setParticipantSelections([...participantSelections, { r1, r2, correct: n === 1 }]);
    setCounter(counter + 1);

    // this varible indicates whether or not to change the value of r1 or r2
    // to decrease the distance between the two
    const flip = Math.random() > 0.5;

    // is correct
    if (n === 1) {
      if (flip) {
        setR2(Math.min(r2 + 0.01, 1));
      } else {
        setR1(Math.min(r1 - 0.01, 1));
      }
    } else if (flip) {
      setR2(Math.max(r2 - 0.03, 0));
    } else {
      setR1(Math.max(r1 + 0.03, 0));
    }
  }, [counter, participantSelections, r1, r2]);

  useEffect(() => {
    if (counter === 50) {
      const observedJnd = Math.abs(r1 - r2);

      setAnswer({
        status: true,
        provenanceGraph: undefined,
        answers: {
          scatterSelections: participantSelections,
          r1,
          final_r2: r2,
          observedJnd,
        },
      });
    }
  }, [counter, participantSelections, r1, r2, setAnswer]);

  return (
    <Stack style={{ width: '100%', height: '100%' }}>
      <Text>
        {counter}
        /50
      </Text>
      <Text style={{
        textAlign: 'center', paddingBottom: '24px', fontSize: '18px', fontWeight: 'bold',
      }}
      >
        Select the option with the higher correlation
      </Text>
      <Center>
        <ScatterWrapper onClick={onClick} r1={r1} r2={r2} />
      </Center>
    </Stack>
  );
}

export default JND;
