import { useState, useCallback } from 'react';
import {
  Center, Stack, Text,
} from '@mantine/core';
import ParallelCoordinatesWrapper from './ParallelCoordinatesWrapper';
import { StimulusParams } from '../../../../../../store/types';

export default function PracticeHeatmap({
  parameters,
}: StimulusParams<{ r1: number; r2: number }>) {
  const [result, setResult] = useState<string | null>(null);

  const onClick = useCallback(
    (n: number) => {
      const { r1, r2 } = parameters;
      if (result === null) {
        setResult((n === 1 && r1 > r2) || (n === 2 && r2 > r1) ? 'Correct' : 'Incorrect');
      }
    },
    [parameters, result],
  );

  return (
    <Stack style={{ width: '100%', height: '100%' }}>
      <Text style={{
        textAlign: 'center', paddingBottom: '24px', fontSize: '18px', fontWeight: 'bold',
      }}
      >
        Select the option with the higher correlation
      </Text>
      <Center>
        <ParallelCoordinatesWrapper
          onClick={onClick}
          r1={parameters.r1}
          r2={parameters.r2}
          shouldReRender={false}
        />
      </Center>
      <Text style={{ textAlign: 'center', marginTop: '1rem', minHeight: '28px' }}>{result ?? ' '}</Text>
    </Stack>
  );
}
