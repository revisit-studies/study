import {
  Suspense, useCallback, useEffect,
} from 'react';
import { ModuleNamespace } from 'vite/types/hot';
import { ParticipantData, ReactComponent } from '../parser/types';
import { StimulusParams } from '../store/types';
import { ResourceNotFound } from '../ResourceNotFound';
import { useStoreDispatch, useStoreActions } from '../store/store';
import { useCurrentIdentifier } from '../routes/utils';
import { useIsAnalysis } from '../store/hooks/useIsAnalysis';
import { ErrorBoundary } from './ErrorBoundary';

const modules = import.meta.glob(
  [
    '../public/**/*.{mjs,js,mts,ts,jsx,tsx}',
    '!../public/**/*.spec.{mjs,js,mts,ts,jsx,tsx}',
  ],
  { eager: true },
) as Record<string, ModuleNamespace>;

export function ReactComponentController({ currentConfig, provState, answers }: { currentConfig: ReactComponent; provState?: unknown, answers: ParticipantData['answers'] }) {
  const reactPath = `../public/${currentConfig.path}`;
  const StimulusComponent = reactPath in modules ? modules[reactPath].default : null;
  const identifier = useCurrentIdentifier();

  const storeDispatch = useStoreDispatch();
  const { updateResponseBlockValidation, setReactiveAnswers } = useStoreActions();
  const isAnalysis = useIsAnalysis();
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

  const clearStimulusValidation = useCallback(() => {
    if (isAnalysis) return;
    storeDispatch(updateResponseBlockValidation({
      location: 'stimulus',
      identifier,
      status: true,
      values: {},
    }));
  }, [isAnalysis, identifier, storeDispatch, updateResponseBlockValidation]);

  // If the stimulus component file can't be resolved (404), clear stimulus
  // validation so the participant isn't stuck on a trial that can never load.
  useEffect(() => {
    if (!StimulusComponent) {
      console.error(`Stimulus component not found at "${currentConfig.path}". Clearing stimulus validation so the participant is not stuck.`);
      clearStimulusValidation();
    }
  }, [StimulusComponent, currentConfig.path, clearStimulusValidation]);

  const handleRuntimeError = useCallback((error: unknown) => {
    console.error(`Stimulus component "${currentConfig.path}" threw at runtime. Clearing stimulus validation so the participant is not stuck.`, error);
    clearStimulusValidation();
  }, [currentConfig.path, clearStimulusValidation]);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      {StimulusComponent
        ? (
          <ErrorBoundary onError={handleRuntimeError}>
            <StimulusComponent
              parameters={currentConfig.parameters}
              setAnswer={setAnswer}
              answers={answers}
              provenanceState={provState}
            />
          </ErrorBoundary>
        )
        : <ResourceNotFound path={currentConfig.path} />}
    </Suspense>
  );
}
