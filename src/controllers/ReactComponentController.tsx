import {
  ComponentType, Suspense, lazy, useCallback, useMemo,
} from 'react';
import { ParticipantData, ReactComponent } from '../parser/types';
import { StimulusParams, TrrackedProvenance } from '../store/types';
import { ResourceNotFound } from '../ResourceNotFound';
import { useStoreDispatch, useStoreActions } from '../store/store';
import { useCurrentIdentifier } from '../routes/utils';
import { useIsAnalysis } from '../store/hooks/useIsAnalysis';
import { RevisitProvenanceProvider } from '../store/hooks/useRevisitTrrack';
import { ErrorBoundary } from './ErrorBoundary';
import { compileTemplate } from '../utils/handlebars';
import { useTemplateAnswerContext } from '../store/hooks/useTemplateAnswerContext';
import { useAssetStatus, useAssetLoadStatus } from '../store/hooks/useAssetStatus';

const modules = import.meta.glob<{ default: ComponentType<StimulusParams<ReactComponent['parameters'], unknown>> }>(
  [
    '../public/**/*.{mjs,js,mts,ts,jsx,tsx}',
    '!../public/**/*.spec.{mjs,js,mts,ts,jsx,tsx}',
  ],
);

export function ReactComponentController({ currentConfig, provState, answers }: { currentConfig: ReactComponent; provState?: unknown, answers: ParticipantData['answers'] }) {
  const templateData = useTemplateAnswerContext();
  const templatedPath = templateData ? compileTemplate(currentConfig.path, currentConfig.parameters ?? {}, { noEscape: true, data: templateData }) : undefined;
  const reactPath = templatedPath ? `../public/${templatedPath}` : undefined;
  const StimulusComponent = useMemo(() => (reactPath && reactPath in modules ? lazy(modules[reactPath]) : null), [reactPath]);
  const identifier = useCurrentIdentifier();

  const storeDispatch = useStoreDispatch();
  const {
    updateProvenance, updateResponseBlockValidation, setReactiveAnswers,
  } = useStoreActions();
  const isAnalysis = useIsAnalysis();
  const onProvenanceChange = useCallback((provenanceGraph: TrrackedProvenance) => {
    if (isAnalysis) return;
    storeDispatch(updateProvenance({
      location: 'stimulus',
      identifier,
      provenanceGraph,
    }));
  }, [identifier, isAnalysis, storeDispatch, updateProvenance]);
  const setAnswer = useCallback(({
    status,
    provenanceGraph,
    answers: stimulusAnswers,
    reason,
    message,
  }: Parameters<StimulusParams<unknown>['setAnswer']>[0]) => {
    if (isAnalysis) return;
    storeDispatch(updateResponseBlockValidation({
      location: 'stimulus',
      identifier,
      status,
      values: stimulusAnswers,
      provenanceGraph,
      reason,
      message,
    }));

    storeDispatch(setReactiveAnswers(stimulusAnswers));
  }, [isAnalysis, setReactiveAnswers, storeDispatch, updateResponseBlockValidation, identifier]);

  const requestKey = `${identifier}:${reactPath}`;
  const { status: componentStatus, onReady: handleReady, onError: handleRuntimeError } = useAssetLoadStatus(requestKey);
  const assetStatus = !templateData ? 'loading' : !StimulusComponent ? 'error' : componentStatus;
  useAssetStatus(assetStatus);

  if (!templateData) {
    return null;
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      {StimulusComponent
        ? (
          <ErrorBoundary key={requestKey} onReady={handleReady} onError={handleRuntimeError}>
            <RevisitProvenanceProvider
              key={identifier}
              onProvenanceChange={onProvenanceChange}
            >
              {(useTrrack) => (
                <StimulusComponent
                  parameters={currentConfig.parameters}
                  setAnswer={setAnswer}
                  answers={answers}
                  provenanceState={provState}
                  useTrrack={useTrrack}
                />
              )}
            </RevisitProvenanceProvider>
          </ErrorBoundary>
        )
        : <ResourceNotFound path={templatedPath} />}
    </Suspense>
  );
}
