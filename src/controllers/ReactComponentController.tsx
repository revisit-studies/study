import {
  Suspense, useCallback, useEffect,
} from 'react';
import { ModuleNamespace } from 'vite/types/hot';
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

const modules = import.meta.glob(
  [
    '../public/**/*.{mjs,js,mts,ts,jsx,tsx}',
    '!../public/**/*.spec.{mjs,js,mts,ts,jsx,tsx}',
  ],
  { eager: true },
) as Record<string, ModuleNamespace>;

export function ReactComponentController({ currentConfig, provState, answers }: { currentConfig: ReactComponent; provState?: unknown, answers: ParticipantData['answers'] }) {
  const templateData = useTemplateAnswerContext();
  const templatedPath = compileTemplate(currentConfig.path, currentConfig.parameters ?? {}, { noEscape: true, data: templateData });
  const reactPath = `../public/${templatedPath}`;
  const StimulusComponent = reactPath in modules ? modules[reactPath].default : null;
  const identifier = useCurrentIdentifier();

  const storeDispatch = useStoreDispatch();
  const { updateProvenance, updateResponseBlockValidation, setReactiveAnswers } = useStoreActions();
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
      console.error(`Stimulus component not found at "${templatedPath}". Clearing stimulus validation so the participant is not stuck.`);
      clearStimulusValidation();
    }
  }, [StimulusComponent, templatedPath, clearStimulusValidation]);

  const handleRuntimeError = useCallback((error: unknown) => {
    console.error(`Stimulus component "${templatedPath}" threw at runtime. Clearing stimulus validation so the participant is not stuck.`, error);
    clearStimulusValidation();
  }, [templatedPath, clearStimulusValidation]);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      {StimulusComponent
        ? (
          <ErrorBoundary onError={handleRuntimeError}>
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
