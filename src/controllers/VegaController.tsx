import {
  useCallback, useEffect, useMemo, useState, type ComponentProps,
} from 'react';
import { VegaEmbed } from 'react-vega';
import { initializeTrrack, Registry } from '@trrack/core';
import { View } from 'vega';
import { ValueOf, VegaComponent } from '../parser/types';
import { getJsonAssetByPath } from '../utils/getStaticAsset';
import { ResourceNotFound } from '../ResourceNotFound';
import { useStoreActions, useStoreDispatch } from '../store/store';
import { StimulusParams } from '../store/types';
import { useCurrentIdentifier } from '../routes/utils';
import { useEvent } from '../store/hooks/useEvent';

type Listeners = { [key: string]: (key: string, value: { responseId: string, response: string | number }) => void };
type VegaEmbedSpec = ComponentProps<typeof VegaEmbed>['spec'];
type SignalListenerHandler = Parameters<View['addSignalListener']>[1];
type VegaSignal = { name: string };

export interface VegaProvState {
  event: {
    key: string;
    value: string | object;
  };
}

export function VegaController({ currentConfig, provState }: { currentConfig: VegaComponent; provState?: VegaProvState }) {
  const storeDispatch = useStoreDispatch();
  const [vegaConfig, setVegaConfig] = useState<VegaEmbedSpec | null>(null);
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
    const signals = (vegaConfig && typeof vegaConfig === 'object'
      ? (vegaConfig as { config?: { signals?: VegaSignal[] } }).config?.signals
      : undefined);
    if (!signals) return {};

    return signals.reduce((listeners: Record<string, SignalListenerHandler>, signal: VegaSignal) => {
      if (signal.name === 'revisitAnswer') {
        listeners[signal.name] = handleRevisitAnswer as SignalListenerHandler;
      } else {
        listeners[signal.name] = handleSignalEvt as SignalListenerHandler;
      }
      return listeners;
    }, {} as Record<string, SignalListenerHandler>);
  }, [handleRevisitAnswer, handleSignalEvt, vegaConfig]);

  useEffect(() => {
    if (!view) {
      return undefined;
    }

    (Object.entries(signalListeners) as Array<[string, SignalListenerHandler]>).forEach(([name, listener]) => {
      view.addSignalListener(name, listener);
    });

    return () => {
      (Object.entries(signalListeners) as Array<[string, SignalListenerHandler]>).forEach(([name, listener]) => {
        view.removeSignalListener(name, listener);
      });
    };
  }, [signalListeners, view]);

  useEffect(() => {
    async function fetchVega() {
      setLoading(true);

      let config: VegaEmbedSpec | undefined;
      if ('path' in currentConfig) {
        config = await getJsonAssetByPath(currentConfig.path);
      } else {
        config = currentConfig.config as VegaEmbedSpec;
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
    <VegaEmbed
      spec={structuredClone(vegaConfig) as VegaEmbedSpec}
      options={{ actions: currentConfig.withActions }}
      onEmbed={(result) => setView(result.view)}
    />
  );
}
