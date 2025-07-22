import {
  Suspense, useCallback,
} from 'react';
import { ModuleNamespace } from 'vite/types/hot';
import { ParticipantData, ReactComponent } from '../parser/types';
import { StimulusParams } from '../store/types';
import { ResourceNotFound } from '../ResourceNotFound';
import { useStoreDispatch, useStoreActions } from '../store/store';
import { useCurrentIdentifier } from '../routes/utils';
import { ErrorBoundary } from './ErrorBoundary';

const modules = import.meta.glob(
  '../public/**/*.{mjs,js,mts,ts,jsx,tsx}',
  { eager: true },
);

export function ReactComponentController({ currentConfig, provState, answers }: { currentConfig: ReactComponent; provState?: unknown, answers: ParticipantData['answers'] }) {
  const reactPath = `../public/${currentConfig.path}`;
  const StimulusComponent = reactPath in modules ? (modules[reactPath] as ModuleNamespace).default : null;
  const identifier = useCurrentIdentifier();

  const storeDispatch = useStoreDispatch();
  const { updateResponseBlockValidation, setReactiveAnswers } = useStoreActions();
  const setAnswer = useCallback(({ status, provenanceGraph, answers: stimulusAnswers }: Parameters<StimulusParams<unknown>['setAnswer']>[0]) => {
    storeDispatch(updateResponseBlockValidation({
      location: 'stimulus',
      identifier,
      status,
      values: stimulusAnswers,
      provenanceGraph,
    }));

    storeDispatch(setReactiveAnswers(stimulusAnswers));
  }, [setReactiveAnswers, storeDispatch, updateResponseBlockValidation, identifier]);

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
