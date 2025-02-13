import {
  Suspense, useCallback, useMemo,
} from 'react';
import { ModuleNamespace } from 'vite/types/hot';
import { ReactComponent } from '../parser/types';
import { StimulusParams } from '../store/types';
import { ResourceNotFound } from '../ResourceNotFound';
import { useStoreDispatch, useStoreActions, useStoreSelector } from '../store/store';
import { useCurrentIdentifier } from '../routes/utils';
import { ErrorBoundary } from './ErrorBoundary';

const modules = import.meta.glob(
  '../public/**/*.{mjs,js,mts,ts,jsx,tsx}',
  { eager: true },
);

export function ReactComponentController({ currentConfig, provState }: { currentConfig: ReactComponent; provState?: unknown }) {
  const funcParams = useStoreSelector((state) => state.funcParams);

  const reactPath = `../public/${currentConfig.path}`;
  const StimulusComponent = reactPath in modules ? (modules[reactPath] as ModuleNamespace).default : null;
  const identifier = useCurrentIdentifier();

  const storeDispatch = useStoreDispatch();
  const { updateResponseBlockValidation, setreactiveAnswers } = useStoreActions();
  const setAnswer = useCallback(({ status, provenanceGraph, answers }: Parameters<StimulusParams<unknown>['setAnswer']>[0]) => {
    storeDispatch(updateResponseBlockValidation({
      location: 'sidebar',
      identifier,
      status,
      values: answers,
      provenanceGraph,
    }));

    storeDispatch(setreactiveAnswers(answers));
  }, [identifier, setreactiveAnswers, storeDispatch, updateResponseBlockValidation]);

  const params = useMemo(() => (funcParams !== undefined ? funcParams : currentConfig.parameters), [currentConfig.parameters, funcParams]);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      {StimulusComponent
        ? (
          <ErrorBoundary>
            <StimulusComponent
              parameters={params}
              setAnswer={setAnswer}
              provenanceState={provState}
            />
          </ErrorBoundary>
        )
        : <ResourceNotFound path={currentConfig.path} />}
    </Suspense>
  );
}
