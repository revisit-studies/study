import { useState, useCallback } from 'react';
import {
  Center, Stack, Text, Button,
} from '@mantine/core';
import HexbinWrapper from './HexbinWrapper';
import { StimulusParams } from '../../../../../../store/types';

const practiceTrials: [number, number][] = [[0.3, 0.7], [0.9, 0.6], [0.6, 0.3], [0.6, 0.9], [0.3, 0.1], [0.5, 0.3], [0.9, 0.8], [0.6, 0.7], [0.99, 0.9]];

export default function PracticeHexBin({
  setAnswer,
}: StimulusParams<Record<string, never>>) {
  const [counter, setCounter] = useState(0);
  const [rValues, setRValues] = useState<[number, number]>(practiceTrials[0]);
  const [result, setResult] = useState<string | null>(null);
  const [showNext, setShowNext] = useState(false);

  const onClick = useCallback(
    (n: number) => {
      const [r1, r2] = rValues;
      if (result === null) {
        if ((n === 1 && r1 > r2) || (n === 2 && r2 > r1)) {
          setResult('Correct');
        } else {
          setResult('Incorrect');
        }
        setShowNext(true);
      }
    },
    [rValues, result],
  );

  const onNext = () => {
    setResult(null);
    setShowNext(false);
    const nextCounter = counter < practiceTrials.length - 1 ? counter + 1 : practiceTrials.length - 1;
    setCounter(nextCounter);

    if (nextCounter < practiceTrials.length - 1) {
      setRValues(practiceTrials[nextCounter]);
    } else {
      setAnswer({
        status: true,
        provenanceGraph: undefined,
        answers: { completed: true },
      });
      setResult('Practice Completed, please continue.');
    }
  };

  return (
    <Stack style={{ width: '100%', height: '100%' }}>
      <Text>
        {counter + 1}
        /
        {practiceTrials.length}
      </Text>
      <Text style={{
        textAlign: 'center', paddingBottom: '24px', fontSize: '18px', fontWeight: 'bold',
      }}
      >
        Select the option with the higher correlation
      </Text>
      <Center>
        <HexbinWrapper
          onClick={onClick}
          r1={rValues[0]}
          r2={rValues[1]}
          shouldReRender={false}
        />
      </Center>
      {result && (
        <Text style={{ textAlign: 'center', marginTop: '1rem' }}>{result}</Text>
      )}
      {showNext && (
        <Center style={{ justifyContent: 'flex-end' }}>
          <Button onClick={onNext} style={{ marginTop: '1rem' }}>
            Next
          </Button>
        </Center>
      )}
    </Stack>
  );
}
