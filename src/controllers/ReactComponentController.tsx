import { Suspense } from 'react';
import { ModuleNamespace } from 'vite/types/hot';
import { ReactComponent } from '../parser/types';
import { StimulusParams } from '../store/types';
import { useStoreDispatch, useStoreActions, useFlatSequence } from '../store/store';
import { useCurrentStep } from '../routes/utils';
import ResourceNotFound from '../ResourceNotFound';

const modules = import.meta.glob(
  '../public/**/*.{mjs,js,mts,ts,jsx,tsx}',
  { eager: true },
);

function ReactComponentController({ currentConfig }: { currentConfig: ReactComponent; }) {
  const currentStep = useCurrentStep();
  const currentComponent = useFlatSequence()[currentStep];

  const reactPath = `../public/${currentConfig.path}`;
  const StimulusComponent = reactPath in modules ? (modules[reactPath] as ModuleNamespace).default : null;

  const storeDispatch = useStoreDispatch();
  const { updateResponseBlockValidation, setIframeAnswers } = useStoreActions();
  function setAnswer({ status, provenanceGraph, answers }: Parameters<StimulusParams<unknown>['setAnswer']>[0]) {
    storeDispatch(updateResponseBlockValidation({
      location: 'sidebar',
      identifier: `${currentComponent}_${currentStep}`,
      status,
      values: answers,
      provenanceGraph,
    }));

    storeDispatch(setIframeAnswers(answers));
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      {StimulusComponent
        ? (
          <StimulusComponent
            parameters={currentConfig.parameters}
            // eslint-disable-next-line react/jsx-no-bind
            setAnswer={setAnswer}
          />
        )
        : <ResourceNotFound path={currentConfig.path} />}
    </Suspense>
  );
}

export default ReactComponentController;
