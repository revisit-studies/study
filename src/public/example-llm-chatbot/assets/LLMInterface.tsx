import { Grid } from '@mantine/core';
import {
  useMemo, useCallback,
} from 'react';
import { Registry, Trrack, initializeTrrack } from '@trrack/core';
import ChatInterface from './ChatInterface';
import ImageDisplay from './ImageDisplay';
import { StimulusParams } from '../../../store/types';
import { ChatMessage, ChatProvenanceState } from './types';

type ChatTrrackState = {
  messages: ChatMessage[];
};

export default function LLMInterface({
  setAnswer, provenanceState,
}: StimulusParams<ChatProvenanceState>) {
  // Setup provenance tracking (Trrack)
  const { actions, trrack } = useMemo<{
    actions: {
      updateMessages: (messages: ChatMessage[]) => { payload: ChatMessage[]; type: string };
    };
    trrack: Trrack<ChatTrrackState, string>;
  }>(() => {
    const reg = Registry.create();

    // Register an "updateMessages" action to update chat history state
    const updateMessages = reg.register('brush', (state, newMessages: ChatMessage[]) => {
      state.messages = newMessages;
      return state;
    });

    // Initialize Trrack with an empty message list
    const trrackInst = initializeTrrack({
      registry: reg,
      initialState: {
        messages: [] as ChatMessage[],
      },
    });

    return {
      actions: {
        updateMessages,
      },
      trrack: trrackInst,
    };
  }, []);

  const updateProvenanceState = useCallback((messages: unknown[]) => {
    setAnswer({
      status: true,
      provenanceGraph: trrack.graph.backend,
      answers: {
        messages: JSON.stringify(messages),
      },
    });
  }, [setAnswer, trrack.graph.backend]);

  return (
    <Grid gutter="md">
      <Grid.Col span={6}>
        <ImageDisplay />
      </Grid.Col>
      <Grid.Col span={6}>
        <ChatInterface
          provenanceState={provenanceState}
          trrack={trrack}
          actions={actions}
          updateProvenanceState={updateProvenanceState}
        />
      </Grid.Col>
    </Grid>
  );
}
