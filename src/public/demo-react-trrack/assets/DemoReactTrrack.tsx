import { useEffect, useState } from 'react';
import {
  Box, Center, Stack, Text, TextInput,
} from '@mantine/core';
import { initializeTrrack, Registry } from '@trrack/core';
import { StimulusParams } from '../../../store/types';

interface StroopState {
  response: string;
}

interface StroopTrialParams {
  displayText?: string;
  textColor?: string;
}

const toCapped = (value: string) => value.toUpperCase();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function StroopColorTask({ parameters, setAnswer, provenanceState }: StimulusParams<any, StroopState>) {
  const { taskid } = parameters;
  const { displayText = '', textColor = 'black' } = parameters as StroopTrialParams;
  // Create provenance registry
  const reg = Registry.create();
  const setResponseAction = reg.register('setResponse', (state, nextResponse: string) => {
    state.response = nextResponse;
    return state;
  });
  // initializing trrack
  const trrack = initializeTrrack({
    registry: reg,
    initialState: {
      response: toCapped(provenanceState?.response ?? ''),
    },
  });

  const [responseText, setResponseText] = useState(toCapped(provenanceState?.response ?? ''));

  useEffect(() => {
    setResponseText(toCapped(provenanceState?.response ?? ''));
  }, [provenanceState?.response]);

  return (
    <Stack gap="xl" style={{ maxWidth: 520, margin: '0 auto' }}>
      <Center>
        <Box>
          <Text fw={700} size="2rem" style={{ color: textColor }}>
            {displayText}
          </Text>
        </Box>
      </Center>
      <Center>
        <TextInput
          value={responseText}
          onChange={(event) => {
            const value = toCapped(event.currentTarget.value);
            setResponseText(value);
            trrack.apply('Set response', setResponseAction(value));
            setAnswer({
              status: value.trim().length > 0,
              provenanceGraph: trrack.graph.backend,
              answers: { [taskid]: value },
            });
          }}
        />
      </Center>

    </Stack>
  );
}

export default StroopColorTask;
