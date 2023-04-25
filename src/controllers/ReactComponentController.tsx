import { Suspense } from 'react';
import { Stimulus } from '../parser/types';
import { ModuleNamespace } from 'vite/types/hot';

const modules = import.meta.glob('../components/stimuli/**/*.{mjs,js,mts,ts,jsx,tsx}', {eager: true});

const ReactComponentController = ({
  stimulusID,
  stimulus,
}: {
  stimulusID: string;
  stimulus: Stimulus;
}) => {
  const path = `../components/stimuli/${stimulus.path}`;
  console.log(path);
  const StimulusComponent = (modules[path] as ModuleNamespace).default;

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
