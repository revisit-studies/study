import { Suspense, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Trial} from '../parser/types';
import { useCurrentStep } from '../routes';


import {
  createTrialProvenance,
  TrialProvenanceContext,
} from '../store/trialProvenance';
import IframeController from './IframeController';

import ImageController from './ImageController';
import { resetResponseBlockValidation } from '../store/flags';

import {useTrainingConfig, useTrialsConfig} from './utils';

// current active stimuli presented to the user

export default function TrainingController() {
  const trialProvenance = createTrialProvenance();
  const trainingConfig = useTrainingConfig();
  const trainingStimulus = trainingConfig?.stimulus;
  console.log(trainingConfig,'trainingConfig');

  return (
    <div>
      <TrialProvenanceContext.Provider value={trialProvenance}>
        <Suspense fallback={<div>Loading...</div>}>
          {trainingStimulus && trainingStimulus.type === 'website' && (
            <IframeController
              path={trainingStimulus.path}
              style={trainingStimulus.style}
            />
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
