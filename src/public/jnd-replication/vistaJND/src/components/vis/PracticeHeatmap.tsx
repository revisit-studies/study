import { useState, useCallback } from 'react';
import {
  Center, Stack, Text,
} from '@mantine/core';
import { IconCircleCheck, IconCircleX } from '@tabler/icons-react';
import HeatmapWrapper from './HeatmapWrapper';
import { StimulusParams } from '../../../../../../store/types';

export default function PracticeHeatmap({
  parameters,
}: StimulusParams<{ r1: number; r2: number }>) {
  const [result, setResult] = useState<string | null>(null);
  const { r1, r2 } = parameters;

  const onClick = useCallback(
    (n: number) => {
      if (result === null) {
        setResult((n === 1 && r1 > r2) || (n === 2 && r2 > r1) ? 'Correct' : 'Incorrect');
      }
    },
    [r1, r2, result],
  );

  return (
    <Stack style={{ width: '100%', height: '100%' }}>
      <Text style={{
        textAlign: 'center', paddingBottom: '0px', fontSize: '18px', fontWeight: 'bold',
      }}
      >
        Please select the visualization that appears to have a larger correlation. (This may be difficult, but try your best!)
      </Text>
      <Text style={{
        textAlign: 'center', paddingBottom: '24px', fontSize: '18px', fontWeight: 'bold',
      }}
      >
        You can either click the buttons (A or B) or use the‚ left and right keys.
      </Text>
      <Center>
        <HeatmapWrapper
          onClick={onClick}
          r1={parameters.r1}
          r2={parameters.r2}
          shouldReRender={false}
          shouldRandomize={false}
        />
      </Center>
      {result && (
        <>
          <Text style={{
            textAlign: 'center', marginTop: '1rem', minHeight: '28px', fontSize: '18px', fontWeight: 'bold',
          }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: result === 'Correct' ? 'green' : 'red',
            }}
            >
              {result === 'Correct' ? (
                <>
                  <IconCircleCheck size={18} stroke={2} />
                  <span>Correct</span>
                </>
              ) : (
                <>
                  <IconCircleX size={18} stroke={2} />
                  <span>Incorrect</span>
                </>
              )}
            </div>
          </Text>
          <Text style={{ textAlign: 'center', marginTop: '1rem', minHeight: '28px' }}>{ `A is ${r1}, B is ${r2}`}</Text>
        </>
      )}
    </Stack>
  );
}
