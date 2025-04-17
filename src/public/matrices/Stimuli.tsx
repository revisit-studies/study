import {
  useEffect, useState, useMemo, useCallback,
} from 'react';
import { Loader } from '@mantine/core';
import { Registry, initializeTrrack } from '@trrack/core';

import { StimulusParams } from '../../store/types';

import { Matrix } from './components/Matrix';
import { ChartParams, TrrackState, link } from './utils/Interfaces';

import './style.css';

export function Stimuli({
  parameters,
  setAnswer,
  provenanceState,
}: StimulusParams<ChartParams, TrrackState>) {
  // ---------------------------- Setup & data ----------------------------
  const [data, setData] = useState<link[]>([]);

  const [dataname, setDataname] = useState<string>(parameters.dataset);

  const loadData = useCallback(async (file: string) => {
    if (!file) return;

    try {
      const response = await fetch(`data/${file}`);
      if (!response.ok) throw new Error('Failed to fetch file');

      const text = await response.text();
      const parsedData = text
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line));

      setData(parsedData);
    } catch (error) {
      console.error('Error loading JSON:', error);
    }
  }, []);

  useEffect(() => {
    loadData(dataname);
  }, [loadData, dataname]);
  // ---------------------------- Trrack ----------------------------
  const { actions, trrack } = useMemo(() => {
    const registry = Registry.create();

    const addAnswerNode = registry.register('add-answer-node', (state, node: string) => {
      state.answerNodes = [...state.answerNodes, node];
    });

    const removeAnswerNode = registry.register('remove-answer-node', (state, node: string) => {
      state.answerNodes = state.answerNodes.filter((n: string) => n !== node);
    });

    const setAnswerNodes = registry.register('set-answer-nodes', (state, answerNodes: string[]) => {
      state.answerNodes = answerNodes;
    });

    const addHighlightNode = registry.register('add-highlight-node', (state, node: string) => {
      state.highlightedNodes = [...state.highlightNodes, node];
    });

    const removeHighlightNode = registry.register(
      'remove-highlight-node',
      (state, node: string) => {
        state.highlightNodes = state.highlightNodes.filter((n: string) => n !== node);
      },
    );

    const setHighlightNodes = registry.register(
      'set-highlight-nodes',
      (state, highlightNodes: string[]) => {
        state.highlightNodes = highlightNodes;
      },
    );

    const setOrderingNode = registry.register('set-sorting-node', (state, node: string) => {
      state.orderingNode = node;
    });

    const setOriginHighlight = registry.register('highlight-origin-node', (state, node: string) => {
      state.originHighlight = node;
    });

    const setDestinationHighlight = registry.register(
      'highlight-destination-node',
      (state, node: string) => {
        state.destinationHighlight = node;
      },
    );

    const trrackInst = initializeTrrack<TrrackState>({
      initialState: {
        answerNodes: [],

        orderingNode: null,

        originHighlight: null,
        destinationHighlight: null,
      },
      registry,
    });

    return {
      actions: {
        addAnswerNode,
        removeAnswerNode,
        setAnswerNodes,

        addHighlightNode,
        removeHighlightNode,
        setHighlightNodes,

        setOriginHighlight,
        setDestinationHighlight,

        setOrderingNode,
      },
      trrack: trrackInst,
    };
  }, []);

  // ---------------------------- Render ----------------------------

  return data ? (
    <Matrix
      config={parameters}
      data={data}
      dataname={dataname}
      setDataname={setDataname}
      provenanceState={provenanceState}
      actions={actions}
      trrack={trrack}
      setAnswer={setAnswer}
    />
  ) : (
    <Loader />
  );
}

export default Stimuli;
