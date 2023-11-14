import { Suspense } from 'react';
import { ModuleNamespace } from 'vite/types/hot';
import { ReactComponent } from '../parser/types';
import { StimulusParams } from '../store/types';
import { useStoreDispatch, useUntrrackedActions } from '../store/store';

const modules = import.meta.glob(
  '../components/stimuli/**/*.{mjs,js,mts,ts,jsx,tsx}',
  { eager: true }
);

const ReactComponentController = ({
  path,
  parameters,
  trialId,
}: {
  path: string;
  parameters: ReactComponent['parameters'];
  trialId: string | null;
}) => {
  const reactPath = `../components/stimuli/${path}`;

  const StimulusComponent = (modules[reactPath] as ModuleNamespace).default;

  const storeDispatch = useStoreDispatch();
  const unTrrackedActions = useUntrrackedActions();
  function setAnswer({trialId, status, provenanceGraph, answers}: Parameters<StimulusParams['setAnswer']>[0]) {
    storeDispatch(unTrrackedActions.updateResponseBlockValidation({
      location: 'sidebar',
      trialId,
      status,
      provenanceGraph,
      answers,
    }));
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <StimulusComponent
        parameters={parameters}
        trialId={trialId}
        setAnswer={setAnswer}
      />
    </Suspense>
  );
};

export default ReactComponentController;
