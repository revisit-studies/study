import {
  useCallback, useEffect, useMemo, useRef, useState,
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
import { compileTemplate } from '../utils/handlebars';
import { useTemplateAnswerContext } from '../store/hooks/useTemplateAnswerContext';
import { getInitialStimulusValidation } from '../components/response/stimulusErrors';
import { useAsyncResource } from '../store/hooks/useAsyncResource';

type Listeners = { [key: string]: (key: string, value: { responseId: string, response: string | number }) => void };

export interface VegaProvState {
  event?: {
    key: string;
    value: unknown;
  };
  signals?: Record<string, unknown>;
}

const InternalVega = Vega as unknown as React.FC<VegaProps>;

export function VegaController({ currentConfig, provState }: { currentConfig: VegaComponent; provState?: VegaProvState }) {
  const storeDispatch = useStoreDispatch();
  const [stimulusStatus, setStimulusStatus] = useState(false);
  const [stimulusAnswer, setStimulusAnswer] = useState<Record<string, string | number>>({});

  const identifier = useCurrentIdentifier();

  const templateData = useTemplateAnswerContext();

  const templatedPath = useMemo(
    () => (templateData && 'path' in currentConfig ? compileTemplate(currentConfig.path, currentConfig.parameters ?? {}, { noEscape: true, data: templateData }) : undefined),
    [currentConfig, templateData],
  );
  const requestedConfigKey = 'path' in currentConfig ? templatedPath : '__inline__';
  const requestKey = requestedConfigKey === undefined ? undefined : `${identifier}:${requestedConfigKey}`;
  const loadVega = useCallback(async () => {
    if ('path' in currentConfig) {
      return templatedPath === undefined ? undefined : getJsonAssetByPath(templatedPath);
    }
    return currentConfig.config as VisualizationSpec;
  }, [currentConfig, templatedPath]);
  const { status: resourceStatus, value: vegaConfig } = useAsyncResource<VisualizationSpec>(requestKey, loadVega);

  const {
    updateProvenance, updateResponseBlockValidation, setReactiveAnswers, setAssetStatus,
  } = useStoreActions();
  const isAnalysis = useIsAnalysis();
  const [viewResult, setViewResult] = useState<{ key?: string; status: 'ready' | 'error' }>();
  useEffect(() => { setViewResult(undefined); }, [requestKey, vegaConfig]);
  const viewStatus = viewResult && viewResult.key === requestKey ? viewResult.status : 'loading';
  const assetStatus = resourceStatus === 'missing' || resourceStatus === 'error' || (resourceStatus === 'success' && !vegaConfig)
    ? 'error'
    : resourceStatus === 'success' ? viewStatus : 'loading';
  useEffect(() => {
    if (isAnalysis) return undefined;
    storeDispatch(setAssetStatus({ identifier, status: assetStatus }));
    return () => { storeDispatch(setAssetStatus({ identifier, status: 'loading' })); };
  }, [assetStatus, identifier, isAnalysis, setAssetStatus, storeDispatch]);
  const handleViewError = useCallback(() => {
    setViewResult({ key: requestKey, status: 'error' });
  }, [requestKey]);

  const [view, setView] = useState<View>();
  const initialSignals = useRef<Record<string, unknown>>({});

  const { actions, registry } = useMemo(() => {
    const reg = Registry.create();

    const signalAction = reg.register('signal', ((state: VegaProvState, signalEvt: { key: string, value: unknown }) => {
      state.event = signalEvt;
      state.signals = {
        ...state.signals,
        [signalEvt.key]: structuredClone(signalEvt.value),
      };
      return state;
    }) as never) as unknown as (payload: { key: string, value: unknown }) => unknown;

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
      signals: {},
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
    if (isAnalysis) return;

    trrack.apply(key, actions.signalAction({
      key,
      value,
    }) as never);

    // Save provenance state after every event
    setAnswer({
      status: stimulusStatus,
      answers: stimulusAnswer,
    });
  });

  const handleRevisitAnswer = useEvent((key: string, value: Parameters<ValueOf<Listeners>>[1]) => {
    if (isAnalysis) return;

    const { responseId, response } = value;
    trrack.apply(key, actions.signalAction({
      key,
      value: structuredClone(value),
    }) as never);

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
    if (!view || !provState) {
      return;
    }

    Object.entries(initialSignals.current).forEach(([key, value]) => {
      view.signal(key, structuredClone(value));
    });

    const replaySignals = provState.signals
      ?? (provState.event?.key ? { [provState.event.key]: provState.event.value } : {});
    Object.entries(replaySignals).forEach(([key, value]) => {
      if (configuredSignalNames.has(key)) {
        view.signal(key, structuredClone(value));
      }
    });
    view.run();
  }, [configuredSignalNames, view, provState]);

  const handleNewView = useCallback((newView: View) => {
    initialSignals.current = Object.fromEntries(
      [...configuredSignalNames].map((signalName) => [
        signalName,
        structuredClone(newView.signal(signalName)),
      ]),
    );
    setView(newView);
    setViewResult({ key: requestKey, status: 'ready' });
  }, [configuredSignalNames, requestKey]);

  // Reset answer validation while a new spec loads; asset validation is independent.
  useEffect(() => {
    if (isAnalysis) return;
    if (resourceStatus === 'unresolved' || resourceStatus === 'loading') {
      const initialValidation = getInitialStimulusValidation(currentConfig);
      storeDispatch(updateResponseBlockValidation({
        location: 'stimulus',
        identifier,
        status: initialValidation.valid,
        values: initialValidation.values,
        reason: initialValidation.reason,
      }));
    }
  }, [isAnalysis, resourceStatus, currentConfig, identifier, storeDispatch, updateResponseBlockValidation]);

  if (resourceStatus === 'unresolved' || resourceStatus === 'loading') {
    return <div>Loading...</div>;
  }
  if ('path' in currentConfig && assetStatus === 'error') {
    return <ResourceNotFound path={templatedPath} />;
  }
  if (assetStatus === 'error' || !vegaConfig) {
    return <div>Failed to load vega config</div>;
  }

  return (
    <div inert={isAnalysis} style={{ display: 'contents' }}>
      <InternalVega
        key={requestKey}
        spec={structuredClone(vegaConfig)}
        signalListeners={signalListeners as never}
        onNewView={handleNewView}
        onError={handleViewError}
        actions={currentConfig.withActions}
      />
    </div>
  );
}
