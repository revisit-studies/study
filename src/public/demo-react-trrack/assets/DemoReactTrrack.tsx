import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import {
  Box, Center, Stack, Text, TextInput,
} from '@mantine/core';
import { initializeTrrack, Registry } from '@trrack/core';
import { StimulusParams } from '../../../store/types';

/** State shape for provenance tracking (used during replay) */
interface StroopState {
  response: string;
}

/** Trial parameters from config: displayText and textColor */
interface StroopTrialParams {
  displayText?: string;
  textColor?: string;
}

/** Normalize input to uppercase for consistent answers */
const toCapped = (value: string) => value.toUpperCase();

function StroopColorTask({ parameters, setAnswer, provenanceState }: StimulusParams<StroopTrialParams, StroopState>) {
  const { displayText = '', textColor = 'black' } = parameters;

  // Create Trrack instance and actions once (see provenance-tracking docs)
  const { actions, trrack } = useMemo(() => {
    const reg = Registry.create();
    const setResponseAction = reg.register('setResponse', (state, nextResponse: string) => {
      state.response = nextResponse;
      return state;
    });
    const trrackInst = initializeTrrack({
      registry: reg,
      initialState: { response: '' },
    });
    return {
      actions: { setResponseAction },
      trrack: trrackInst,
    };
  }, []);

  const [responseText, setResponseText] = useState('');

  // Update local state, record in provenance, and pass to reVISit
  const updateAnswer = useCallback((value: string) => {
    setResponseText(value);
    trrack.apply('Set response', actions.setResponseAction(value));
    setAnswer({
      status: value.trim().length > 0,
      provenanceGraph: trrack.graph.backend,
      answers: { stroopAnswer: value },
    });
  }, [actions, setAnswer, trrack]);

  // Replay: sync textbox from provenanceState when replay seeks to a different node
  useEffect(() => {
    if (provenanceState) {
      setResponseText(provenanceState.response);
    }
  }, [provenanceState]);

  return (
    <Stack gap="xl" style={{ maxWidth: 520, margin: '0 auto' }}>
      {/* Display the Stroop word in the configured color */}
      <Center>
        <Box>
          <Text fw={700} size="2rem" style={{ color: textColor }}>
            {displayText}
          </Text>
        </Box>
      </Center>
      {/* Text input for participant's color response */}
      <Center>
        <TextInput
          value={responseText}
          onChange={(event) => {
            const value = toCapped(event.currentTarget.value);
            updateAnswer(value);
          }}
        />
      </Center>

    </Stack>
  );
}

export default StroopColorTask;
