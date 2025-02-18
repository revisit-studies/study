import { Suspense, useCallback } from 'react';
import { ModuleNamespace } from 'vite/types/hot';
import { ReactComponent } from '../parser/types';
import { StimulusParams, StoredAnswer } from '../store/types';
import { ResourceNotFound } from '../ResourceNotFound';
import { useStoreDispatch, useStoreActions } from '../store/store';
import { useCurrentComponent, useCurrentStep } from '../routes/utils';
import { ErrorBoundary } from './ErrorBoundary';

const modules = import.meta.glob(
  '../public/**/*.{mjs,js,mts,ts,jsx,tsx}',
  { eager: true },
);

export function ReactComponentController({ currentConfig, provState, answers }: { currentConfig: ReactComponent; provState?: unknown, answers: Record<string, StoredAnswer> }) {
  const currentStep = useCurrentStep();
  const currentComponent = useCurrentComponent();

  const reactPath = `../public/${currentConfig.path}`;
  const StimulusComponent = reactPath in modules ? (modules[reactPath] as ModuleNamespace).default : null;

  const storeDispatch = useStoreDispatch();
  const { updateResponseBlockValidation, setreactiveAnswers } = useStoreActions();
  const setAnswer = useCallback(({ status, provenanceGraph, answers: stimulusAnswers }: Parameters<StimulusParams<unknown>['setAnswer']>[0]) => {
    storeDispatch(updateResponseBlockValidation({
      location: 'sidebar',
      identifier: `${currentComponent}_${currentStep}`,
      status,
      values: stimulusAnswers,
      provenanceGraph,
    }));

    storeDispatch(setreactiveAnswers(stimulusAnswers));
  }, [currentComponent, currentStep, setreactiveAnswers, storeDispatch, updateResponseBlockValidation]);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      {StimulusComponent
        ? (
          <ErrorBoundary>
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
