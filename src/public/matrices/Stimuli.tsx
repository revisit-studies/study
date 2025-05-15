import {
  useEffect, useState, useMemo, useCallback,
} from 'react';
import { Loader } from '@mantine/core';
import { Registry, initializeTrrack } from '@trrack/core';

import { StimulusParams } from '../../store/types';

import { Matrix } from './components/Matrix';
import { TrrackState, Link, ExternalParameters } from './utils/Interfaces';

import './style.css';

export function Stimuli({
  parameters,
  setAnswer,
  provenanceState,
}: StimulusParams<ExternalParameters, TrrackState>) {
  const [data, setData] = useState<Link[] | null>(null);
  const [dataname, setDataname] = useState<string>(parameters.dataset ?? '');

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

      // We keep only upper diagonal!
      const filteredData = parsedData.filter((d) => d.origin >= d.destination);
      filteredData.forEach((d) => {
        if (d.destination !== d.origin) {
          const item = { ...d };
          item.origin = d.destination;
          item.destination = d.origin;
          filteredData.push(item);
        }
      });

      setData(filteredData);
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

    const setAnswerNodes = registry.register('set-answer-nodes', (state, answerNodes: string[]) => {
      state.answerNodes = answerNodes;
    });

    const setOrderingNode = registry.register('set-ordering-node', (state, node: string) => {
      state.orderingNode = node;
    });

    const setLinkMarks = registry.register('set-link-marks', (state, links: string[][]) => {
      state.linkMarks = links;
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
        linkMarks: [],

        originHighlight: null,
        destinationHighlight: null,
      },
      registry,
    });

    return {
      actions: {
        setAnswerNodes,

        setOrderingNode,
        setLinkMarks,

        setOriginHighlight,
        setDestinationHighlight,
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
