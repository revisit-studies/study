import { useState, useCallback } from 'react';
import {
  Center, Stack, Text,
} from '@mantine/core';
import ScatterWrapper from './ScatterWrapper';
import { StimulusParams } from '../../../../../../store/types';

export default function PracticeScatter({
  parameters,
}: StimulusParams<{ r1: number; r2: number }>) {
  const [result, setResult] = useState<string | null>(null);
  const [r1First, setR1First] = useState<boolean | null>(null);
  const { r1, r2 } = parameters;

  const onClick = useCallback(
    (n: number, higherFirst?: boolean) => {
      if (result === null) {
        setR1First(higherFirst ?? true);
        setResult((n === 1 && r1 > r2) || (n === 2 && r2 > r1) ? 'Correct' : 'Incorrect');
      }
    },
    [r1, r2, result],
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
        <ScatterWrapper
          onClick={onClick}
          r1={parameters.r1}
          r2={parameters.r2}
          shouldReRender={false}
        />
      </Center>
      {result && (
        <>
          <Text style={{
            textAlign: 'center', marginTop: '1rem', minHeight: '28px', fontSize: '18px', fontWeight: 'bold',
          }}
          >
            {result === 'Correct' ? (
              <span style={{ color: 'green' }}>
                ✔
                <span style={{ color: 'green' }}>Correct</span>
              </span>
            ) : (
              <span style={{ color: 'red' }}>✘ Incorrect</span>
            )}
          </Text>
          <Text style={{ textAlign: 'center', marginTop: '1rem', minHeight: '28px' }}>{r1First ? `Left is ${r1}, right is ${r2}` : `Left is ${r2}, right is ${r1}`}</Text>
        </>
      )}
    </Stack>
  );
}
