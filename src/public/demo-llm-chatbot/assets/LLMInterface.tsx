import { Card, Flex, Grid } from '@mantine/core';
import { useState, useEffect, useMemo, useCallback } from 'react';
import ChatInterface from './ChatInterface';
import InstructionsDisplay from './InstructionsDisplay';
import ImageDisplay from './ImageDisplay';
import { StimulusParams } from '../../../store/types';
import { ChatInterfaceParams, ChatMessage, ChatProvenanceState } from './types';
import { Registry, initializeTrrack } from '@trrack/core';

export default function LLMInterface({ parameters, setAnswer, answers, provenanceState }: StimulusParams<ChatInterfaceParams, ChatProvenanceState>) {
  console.log('LLMInterface answers:', answers.systemPrompt_1.answer["q-systemPrompt"]);

  // Setup provenance tracking (Trrack)
  const { actions, trrack } = useMemo(() => {
    const reg = Registry.create();

    // Register an "updateMessages" action to update chat history state
    const updateMessages = reg.register('updateMessages', (state, newState: ChatMessage[]) => {
      // eslint-disable-next-line no-param-reassign
      state = newState;
      return state;
    });

    // Initialize Trrack with an empty message list
    const trrackInst = initializeTrrack({
      registry: reg,
      initialState: {
        messages: [],
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
        <ImageDisplay chartType={parameters.chartType} />
      </Grid.Col>
      <Grid.Col span={6}>
        <ChatInterface 
          setAnswer={setAnswer} 
          provenanceState={provenanceState} 
          testSystemPrompt={answers.systemPrompt_1.answer["q-systemPrompt"] as string}
          trrack={trrack}
          actions={actions as any}
          updateProvenanceState={updateProvenanceState}
        />
      </Grid.Col>
    </Grid>
  );
}
