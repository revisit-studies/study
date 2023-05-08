import { Suspense } from 'react';
import {
  createTrialProvenance,
  TrialProvenanceContext,
} from '../store/trialProvenance';
import IframeController from './IframeController';
import ImageController from './ImageController';
import { useTrainingConfig } from './utils';

// current active stimuli presented to the user

export default function TrainingController() {
  const trialProvenance = createTrialProvenance();
  const trainingConfig = useTrainingConfig();
  const trainingStimulus = trainingConfig?.stimulus;

  return (
    <div>
      <TrialProvenanceContext.Provider value={trialProvenance}>
        <Suspense fallback={<div>Loading...</div>}>
          {trainingStimulus && trainingStimulus.type === 'website' && (
            <IframeController stimulus={trainingStimulus} />
          )}
          {trainingStimulus && trainingStimulus.type === 'image' && (
            <ImageController
              path={trainingStimulus.path}
              style={trainingStimulus.style}
            />
          )}
        </Suspense>
      </TrialProvenanceContext.Provider>
    </div>
  );
}
