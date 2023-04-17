import { Suspense, lazy } from 'react';
import { Stimulus } from '../parser/types';

const ReactComponentController = ({
  stimulusID,
  stimulus,
}: {
  stimulusID: string;
  stimulus: Stimulus;
}) => {
  const StimulusComponent = lazy(
    () => import(/* @vite-ignore */ `../components/${stimulus.path}`)
  );

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <StimulusComponent
        stimulusID={stimulusID}
        parameters={stimulus.parameters}
      />
    </Suspense>
  );
};

export default ReactComponentController;
