import { Suspense, useCallback } from 'react';
import { ModuleNamespace } from 'vite/types/hot';
import { ReactComponent } from '../parser/types';
import { setAnswer } from '../store/flags';

import { getStorage, ref, uploadBytes } from 'firebase/storage';
import { ProvenanceGraph } from '@trrack/core/graph/graph-slice';
import { debounce } from 'lodash';

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

  const updateProvenance = useCallback(debounce((graph: ProvenanceGraph<any, any, any>) => {
    const storage = getStorage();

    const storageRef = ref(storage, `${trialId}/${graph.root}`);

    const blob = new Blob([JSON.stringify(graph.nodes)], { type: 'application/json' });

    uploadBytes(storageRef, blob).then((snapshot) => {
      console.log('Uploaded a blob or file!');
    });
  }, 5000, {maxWait: 5000}), [trialId]);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <StimulusComponent
        parameters={parameters}
        trialId={trialId}
        setAnswer={setAnswer}
        updateProvenance={updateProvenance}
      />
    </Suspense>
  );
};

export default ReactComponentController;
