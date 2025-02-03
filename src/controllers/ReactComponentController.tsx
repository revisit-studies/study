import { Suspense, useCallback } from 'react';
import { ModuleNamespace } from 'vite/types/hot';
import { ReactComponent } from '../parser/types';
import { StimulusParams } from '../store/types';
import { ResourceNotFound } from '../ResourceNotFound';
import { useStoreDispatch, useStoreActions, useStoreSelector } from '../store/store';
import { useCurrentComponent, useCurrentStep } from '../routes/utils';
import { ErrorBoundary } from './ErrorBoundary';

const modules = import.meta.glob(
  '../public/**/*.{mjs,js,mts,ts,jsx,tsx}',
  { eager: true },
);

export function ReactComponentController({ currentConfig, provState }: { currentConfig: ReactComponent; provState?: unknown }) {
  const currentStep = useCurrentStep();
  const currentComponent = useCurrentComponent();
  const funcParams = useStoreSelector((state) => state.funcParams);

  const reactPath = `../public/${currentConfig.path}`;
  const StimulusComponent = reactPath in modules ? (modules[reactPath] as ModuleNamespace).default : null;

  const storeDispatch = useStoreDispatch();
  const { updateResponseBlockValidation, setreactiveAnswers } = useStoreActions();
  const setAnswer = useCallback(({ status, provenanceGraph, answers }: Parameters<StimulusParams<unknown>['setAnswer']>[0]) => {
    storeDispatch(updateResponseBlockValidation({
      location: 'sidebar',
      identifier: `${currentComponent}_${currentStep}`,
      status,
      values: answers,
      provenanceGraph,
    }));

    storeDispatch(setreactiveAnswers(answers));
  }, [currentComponent, currentStep, setreactiveAnswers, storeDispatch, updateResponseBlockValidation]);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      {StimulusComponent
        ? (
          <ErrorBoundary>
            <StimulusComponent
              parameters={funcParams !== undefined ? funcParams : currentConfig.parameters}
              setAnswer={setAnswer}
              provenanceState={provState}
            />
          </ErrorBoundary>
        )
        : <ResourceNotFound path={currentConfig.path} />}
    </Suspense>
  );
}
