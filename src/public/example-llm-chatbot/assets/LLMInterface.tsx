import { Grid } from '@mantine/core';
import {
  useMemo, useCallback,
} from 'react';
import { Registry, Trrack } from '@trrack/core';
import ChatInterface from './ChatInterface';
import ImageDisplay from './ImageDisplay';
import { StimulusParams } from '../../../store/types';
import { ChatMessage, ChatProvenanceState } from './types';

type ChatTrrackState = {
  messages: ChatMessage[];
};

export default function LLMInterface({
  setAnswer, provenanceState, useTrrack,
}: StimulusParams<ChatProvenanceState>) {
  // Setup provenance tracking (Trrack)
  const { actions, registry } = useMemo<{
    actions: {
      updateMessages: (messages: ChatMessage[]) => { payload: ChatMessage[]; type: string };
    };
    registry: Trrack<ChatTrrackState, string>['registry'];
  }>(() => {
    const reg = Registry.create();

    // Register an "updateMessages" action to update chat history state
    const updateMessages = reg.register('brush', (state, newMessages: ChatMessage[]) => {
      state.messages = newMessages;
      return state;
    });

    return {
      actions: {
        updateMessages,
      },
      registry: reg,
    };
  }, []);
  const trrack = useTrrack({
    registry,
    initialState: {
      messages: [] as ChatMessage[],
    },
  });

  const updateProvenanceState = useCallback((messages: unknown[]) => {
    setAnswer({
      status: true,
      answers: {
        messages: JSON.stringify(messages),
      },
    });
  }, [setAnswer]);

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
