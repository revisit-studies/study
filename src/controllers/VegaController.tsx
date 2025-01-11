import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { Vega, VisualizationSpec, View } from 'react-vega';
import { initializeTrrack, Registry } from '@trrack/core';
import { Button } from '@mantine/core';
import { VegaComponent } from '../parser/types';
import { getJsonAssetByPath } from '../utils/getStaticAsset';
import ResourceNotFound from '../ResourceNotFound';
import { useStoreActions, useStoreDispatch } from '../store/store';
import { StimulusParams } from '../store/types';
import { useCurrentComponent, useCurrentStep } from '../routes/utils';

function VegaController({ currentConfig }: { currentConfig: VegaComponent }) {
  const currentStep = useCurrentStep();
  const currentComponent = useCurrentComponent();
  const storeDispatch = useStoreDispatch();
  const [vegaConfig, setVegaConfig] = useState<VisualizationSpec | null>(null);
  const [loading, setLoading] = useState(true);
  const { updateResponseBlockValidation, setIframeAnswers } = useStoreActions();
  const [view, setView] = useState<View>();
  // for demo 1
  const interactionCache1 = [
    { label: 'tooltip', datum: { category: 'A', amount: 28 } },
    { label: 'tooltip', datum: { category: 'B', amount: 55 } },
    { label: 'tooltip', datum: { category: 'C', amount: 43 } },
    { label: 'tooltip', datum: { category: 'D', amount: 91 } },
    { label: 'tooltip', datum: { category: 'E', amount: 81 } },
  ];

  // for demo 2
  const interactionCache2 = [
    {
      label: 'hoveredSymbol',
      datum: {
        Title: 'Swimfan',
        'US Gross': 28563926,
        'Worldwide Gross': 28563926,
        'US DVD Sales': null,
        'Production Budget': 10000000,
        'Release Date': 'Sep 06 2002',
        'MPAA Rating': 'PG-13',
        'Running Time min': 86,
        Distributor: '20th Century Fox',
        Source: 'Original Screenplay',
        'Major Genre': 'Drama',
        'Creative Type': 'Contemporary Fiction',
        Director: null,
        'Rotten Tomatoes Rating': 15,
        'IMDB Rating': 4.6,
        'IMDB Votes': 9577,
        tooltip: 'Swimfan (2002)',
      },
    },
    { label: 'yField', datum: 'US Gross' },
    { label: 'yField', datum: 'IMDB Rating' },
    { label: 'xField', datum: 'Worldwide Gross' },
  ];
  const { actions, trrack } = useMemo(() => {
    const reg = Registry.create();

    const signalAction = reg.register('signal', (state, signalEvt) => {
      state.event = signalEvt;
      return state;
    });

    const trrackInst = initializeTrrack({
      registry: reg,
      initialState: {
        event: {},
      },
    });

    return {
      actions: {
        signalAction,
      },
      trrack: trrackInst,
    };
  }, []);

  const setAnswer = useCallback(({
    status,
    provenanceGraph,
    answers,
  }: Parameters<StimulusParams<unknown>['setAnswer']>[0]) => {
    storeDispatch(
      updateResponseBlockValidation({
        location: 'sidebar',
        identifier: `${currentComponent}_${currentStep}`,
        status,
        values: answers,
        provenanceGraph,
      }),
    );

    storeDispatch(setIframeAnswers(answers));
  }, [currentComponent, currentStep, storeDispatch, setIframeAnswers, updateResponseBlockValidation]);

  const handleSignalEvt = useCallback((key: string, value:unknown) => {
    trrack.apply(key, actions.signalAction({
      key,
      value,
    }));
  }, []);

  const handleRevisitAnswer = useCallback((key: string, value: unknown) => {
    const { responseId, response } = value as {responseId: string, response: unknown};

    setAnswer({
      status: true,
      provenanceGraph: trrack.graph.backend,
      answers: {
        [responseId]: response,
      },
    });
    setReplay(true);
  }, [setAnswer]);

  const signalListeners = useMemo(() => {
    const signals = vegaConfig?.config?.signals;
    if (!signals) return {};
    type Listeners = { [key: string]: (key: string, value: unknown) => void };
    const listenerList = signals.reduce((listeners, signal) => {
      if (signal.name === 'revisitAnswer') {
        listeners[signal.name] = handleRevisitAnswer;
      } else {
        listeners[signal.name] = handleSignalEvt;
      }
      return listeners;
    }, {} as Listeners);
    return listenerList;
  }, [handleRevisitAnswer, handleSignalEvt, vegaConfig]);

  useEffect(() => {
    async function fetchVega() {
      setLoading(true);
      const asset = await getJsonAssetByPath(currentConfig.path);
      if (asset !== undefined) {
        setVegaConfig(asset);
      }
      setLoading(false);
    }

    fetchVega();
  }, [currentConfig]);

  let idx = 0;
  const replayInteraction = (cache) => {
    view!.signal(cache[idx].label, cache[idx].datum).runAsync();
    idx = (idx + 1) % cache.length;
  };

  if (loading) {
    return <div>Loading...</div>;
  }
  if (!vegaConfig) {
    return <ResourceNotFound path={currentConfig.path} />;
  }

  return (
    <>
      <Vega spec={vegaConfig} signalListeners={signalListeners} onNewView={(v) => setView(v)} />
      <Button onClick={() => replayInteraction(interactionCache1)}>replay demo 1</Button>
      <Button onClick={() => replayInteraction(interactionCache2)}>replay demo 2</Button>

    </>
  );
}

export default VegaController;
