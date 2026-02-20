import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { Vega, VisualizationSpec, View } from 'react-vega';
import { initializeTrrack, Registry } from '@trrack/core';
import { VegaProps } from 'react-vega/lib/Vega';
import { ValueOf, VegaComponent } from '../parser/types';
import { getJsonAssetByPath } from '../utils/getStaticAsset';
import { ResourceNotFound } from '../ResourceNotFound';
import { useStoreActions, useStoreDispatch } from '../store/store';
import { StimulusParams } from '../store/types';
import { useCurrentIdentifier } from '../routes/utils';
import { useEvent } from '../store/hooks/useEvent';

type Listeners = { [key: string]: (key: string, value: { responseId: string, response: string | number }) => void };

export interface VegaProvState {
  event: {
    key: string;
    value: string | object;
  };
}

const InternalVega = Vega as unknown as React.FC<VegaProps>;

export function VegaController({ currentConfig, provState }: { currentConfig: VegaComponent; provState?: VegaProvState }) {
  const storeDispatch = useStoreDispatch();
  const [vegaConfig, setVegaConfig] = useState<VisualizationSpec | null>(null);
  const [loading, setLoading] = useState(true);

  const [stimulusStatus, setStimulusStatus] = useState(false);
  const [stimulusAnswer, setStimulusAnswer] = useState<Record<string, string | number>>({});

  const identifier = useCurrentIdentifier();

  const { updateResponseBlockValidation, setReactiveAnswers } = useStoreActions();
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
        location: 'stimulus',
        identifier,
        status,
        values: answers,
        provenanceGraph,
      }),
    );

    if (Object.keys(answers).length > 0) {
      storeDispatch(setReactiveAnswers(answers));
    }
  }, [storeDispatch, updateResponseBlockValidation, identifier, setReactiveAnswers]);

  const handleSignalEvt = useEvent((key: string, value: unknown) => {
    trrack.apply(key, actions.signalAction({
      key,
      value,
    }));

    // Save provenance state after every event
    setAnswer({
      status: stimulusStatus,
      provenanceGraph: trrack.graph.backend,
      answers: stimulusAnswer,
    });
  });

  const handleRevisitAnswer = useEvent((key: string, value: Parameters<ValueOf<Listeners>>[1]) => {
    const { responseId, response } = value;
    trrack.apply(key, actions.signalAction({
      key,
      value: structuredClone(value),
    }));

    setStimulusStatus(true);
    setStimulusAnswer({ [responseId]: response });

    setAnswer({
      status: true,
      provenanceGraph: trrack.graph.backend,
      answers: { [responseId]: response },
    });
  });

  const signalListeners = useMemo(() => {
    const signals = vegaConfig?.config?.signals;
    if (!signals) return {};

    return signals.reduce((listeners, signal) => {
      if (signal.name === 'revisitAnswer') {
        listeners[signal.name] = handleRevisitAnswer;
      } else {
        listeners[signal.name] = handleSignalEvt;
      }
      return listeners;
    }, {} as Listeners);
  }, [handleRevisitAnswer, handleSignalEvt, vegaConfig]);

  useEffect(() => {
    async function fetchVega() {
      setLoading(true);

      let config: VisualizationSpec | undefined;
      if ('path' in currentConfig) {
        config = await getJsonAssetByPath(currentConfig.path);
      } else {
        config = currentConfig.config as VisualizationSpec;
      }
      if (config !== undefined) {
        setVegaConfig(config);
      }
      setLoading(false);
    }

    if (currentConfig) {
      fetchVega();
    }
  }, [currentConfig]);

  useEffect(() => {
    if (view && provState && provState.event && provState.event.key) {
      view!.signal(provState.event.key, structuredClone(provState.event.value)).run();
    }
  }, [view, provState]);

  if (loading) {
    return <div>Loading...</div>;
  }
  if ('path' in currentConfig && !vegaConfig) {
    return <ResourceNotFound path={currentConfig.path} />;
  }
  if (!vegaConfig) {
    return <div>Failed to load vega config</div>;
  }

  return (
    <InternalVega spec={structuredClone(vegaConfig)} signalListeners={signalListeners as never} onNewView={(v) => setView(v)} actions={currentConfig.withActions} />
  );
}
