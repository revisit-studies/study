import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { Vega, VisualizationSpec, View } from 'react-vega';
import { initializeTrrack, Registry } from '@trrack/core';
import { VegaComponent } from '../parser/types';
import { getJsonAssetByPath } from '../utils/getStaticAsset';
import ResourceNotFound from '../ResourceNotFound';
import { useStoreActions, useStoreDispatch } from '../store/store';
import { StimulusParams } from '../store/types';
import { useCurrentComponent, useCurrentStep } from '../routes/utils';

export interface VegaProvState {
    event: {
        key: string;
        value: string | object;
    };
}

function VegaController({ currentConfig, provState }: { currentConfig: VegaComponent; provState?: VegaProvState }) {
  const currentStep = useCurrentStep();
  const currentComponent = useCurrentComponent();
  const storeDispatch = useStoreDispatch();
  const [vegaConfig, setVegaConfig] = useState<VisualizationSpec | null>(null);
  const [loading, setLoading] = useState(true);
  const { updateResponseBlockValidation, setIframeAnswers } = useStoreActions();
  const [view, setView] = useState<View>();

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

  useEffect(() => {
    if (view && provState && provState.event) {
      view!.signal(provState.event.key, provState.event.value).run();
    }
  }, [provState]);

  if (loading) {
    return <div>Loading...</div>;
  }
  if (!vegaConfig) {
    return <ResourceNotFound path={currentConfig.path} />;
  }

  return (<Vega spec={vegaConfig} signalListeners={signalListeners} onNewView={(v) => setView(v)} />);
}

export default VegaController;
