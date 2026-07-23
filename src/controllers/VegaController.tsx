import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { Vega, VisualizationSpec, View } from 'react-vega';
import { Registry } from '@trrack/core';
import { VegaProps } from 'react-vega/lib/Vega';
import { ValueOf, VegaComponent } from '../parser/types';
import { getJsonAssetByPath } from '../utils/getStaticAsset';
import { ResourceNotFound } from '../ResourceNotFound';
import { useStoreActions, useStoreDispatch } from '../store/store';
import { StimulusParams, TrrackedProvenance } from '../store/types';
import { useCurrentIdentifier } from '../routes/utils';
import { useEvent } from '../store/hooks/useEvent';
import { useIsAnalysis } from '../store/hooks/useIsAnalysis';
import { useManagedTrrack } from '../store/hooks/useRevisitTrrack';

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

  const { updateProvenance, updateResponseBlockValidation, setReactiveAnswers } = useStoreActions();
  const isAnalysis = useIsAnalysis();
  const [view, setView] = useState<View>();

  const { actions, registry } = useMemo(() => {
    const reg = Registry.create();

    const signalAction = reg.register('signal', (state, signalEvt) => {
      state.event = signalEvt;
      return state;
    });

    return {
      actions: {
        signalAction,
      },
      registry: reg,
    };
  }, []);
  const reportProvenance = useCallback((provenanceGraph: TrrackedProvenance) => {
    if (isAnalysis) return;
    storeDispatch(updateProvenance({
      location: 'stimulus',
      identifier,
      provenanceGraph,
    }));
  }, [identifier, isAnalysis, storeDispatch, updateProvenance]);
  const trrack = useManagedTrrack({
    registry,
    initialState: {
      event: {},
    },
  }, reportProvenance, identifier);

  const setAnswer = useCallback(({
    status,
    provenanceGraph,
    answers,
    reason,
    message,
  }: Parameters<StimulusParams<unknown>['setAnswer']>[0]) => {
    if (isAnalysis) return;
    storeDispatch(
      updateResponseBlockValidation({
        location: 'stimulus',
        identifier,
        status,
        values: answers,
        provenanceGraph,
        reason,
        message,
      }),
    );

    if (Object.keys(answers).length > 0) {
      storeDispatch(setReactiveAnswers(answers));
    }
  }, [isAnalysis, storeDispatch, updateResponseBlockValidation, identifier, setReactiveAnswers]);

  const handleSignalEvt = useEvent((key: string, value: unknown) => {
    trrack.apply(key, actions.signalAction({
      key,
      value,
    }));

    // Save provenance state after every event
    setAnswer({
      status: stimulusStatus,
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

  const configuredSignalNames = useMemo(() => new Set(Object.keys(signalListeners)), [signalListeners]);

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
      if (configuredSignalNames.has(provState.event.key)) {
        view.signal(provState.event.key, structuredClone(provState.event.value)).run();
      }
    }
  }, [configuredSignalNames, view, provState]);

  // If the vega spec can't be fetched (404) or parsed (invalid JSON), clear
  // stimulus validation so the participant isn't stuck on a trial that can
  // never load. Skipped in analysis mode so replay doesn't mutate validation.
  useEffect(() => {
    if (isAnalysis) return;
    if (!loading && 'path' in currentConfig && !vegaConfig) {
      console.error(`Vega spec at "${currentConfig.path}" could not be loaded or parsed. Clearing stimulus validation so the participant is not stuck.`);
      storeDispatch(updateResponseBlockValidation({
        location: 'stimulus',
        identifier,
        status: true,
        values: {},
      }));
    }
  }, [isAnalysis, loading, vegaConfig, currentConfig, identifier, storeDispatch, updateResponseBlockValidation]);

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
