import { Suspense } from 'react';
import { ModuleNamespace } from 'vite/types/hot';
import { ReactComponent } from '../parser/types';
import { StimulusParams } from '../store/types';
import { useStoreDispatch, useUntrrackedActions } from '../store/store';
import { useCurrentStep } from '../routes';

const modules = import.meta.glob(
  '../components/stimuli/**/*.{mjs,js,mts,ts,jsx,tsx}',
  { eager: true }
);

const ReactComponentController = ({ currentConfig }: { currentConfig: ReactComponent; }) => {

  const currentStep = useCurrentStep();

  const reactPath = `../components/stimuli/${currentConfig.path}`;
  const StimulusComponent = (modules[reactPath] as ModuleNamespace).default;

  const storeDispatch = useStoreDispatch();
  const unTrrackedActions = useUntrrackedActions();
  function setAnswer({status, provenanceGraph, answers}: Parameters<StimulusParams<unknown>['setAnswer']>[0]) {
    storeDispatch(unTrrackedActions.updateResponseBlockValidation({
      location: 'sidebar',
      currentStep,
      status,
      values: answers,
      provenanceGraph,
    }));

    storeDispatch(unTrrackedActions.setIframeAnswers(
      Object.values(answers).map((value) => value)
    ));
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <StimulusComponent
        parameters={currentConfig.parameters}
        setAnswer={setAnswer}
      />
    </Suspense>
  );
};

export default ReactComponentController;
