/* eslint-disable linebreak-style */
import { Suspense } from 'react';
import ReactMarkdown from 'react-markdown';

import { useParams } from 'react-router-dom';
// eslint-disable-next-line linebreak-style
import { PracticeComponent } from '../parser/types';
import { useCurrentStep } from '../routes';
import { useAppSelector } from '../store';

import {
  createTrialProvenance,
  TrialProvenanceContext,
} from '../store/trialProvenance';
import IframeController from './IframeController';

import ReactComponentController from './ReactComponentController';
import PracticeResponseBlock from '../components/stimuli/inputcomponents/PracticeResponseBlock';
import ImageController from './ImageController';


export function useTrialsConfig() {
  const currentStep = useCurrentStep();

  return useAppSelector((state) => {
    const { config } = state.study;
    const component = currentStep ? config?.components[currentStep] : null;
    if (!config || !currentStep || component?.type !== 'practice') return null;

    return config.components[currentStep] as PracticeComponent;
  });
}

export function useNextTrialId(currentTrial: string | null) {
  console.log('Here');
  const config = useTrialsConfig();
  console.log(config, currentTrial);
  if (!currentTrial || !config) return null;

  const { order } = config;
  console.log(order, currentTrial);
  const idx = order.findIndex((t) => t === currentTrial);

  if (idx === -1) return null;

  return order[idx + 1] || null;
}

// current active stimuli presented to the user

export default function PracticeController() {
  const { trialId = null } = useParams<{ trialId: string }>();
  const config = useTrialsConfig();

  const trialProvenance = createTrialProvenance();

  if (!trialId || !config) return null;

  const stimulus = config.practice[trialId];
  const response = config.response;
  
  return (
    <div key={trialId}>
      <ReactMarkdown>{stimulus.instruction}</ReactMarkdown>
      <TrialProvenanceContext.Provider value={trialProvenance}>
        <Suspense fallback={<div>Loading...</div>}>
          {stimulus.stimulus.type === 'website' && (
            <IframeController
              path={stimulus.stimulus.path}
              style={stimulus.stimulus.style}
            />
          )}
          {stimulus.stimulus.type === 'image' && (
            <ImageController
              path={stimulus.stimulus.path}
              style={stimulus.stimulus.style}
            />
          )}
          {stimulus.stimulus.type === 'react-component' && (
            <ReactComponentController
              stimulusID={trialId}
              stimulus={stimulus.stimulus}
            />
          )}

          {/* <StimulusComponent parameters={stimulus.stimulus.parameters} /> */}
          <PracticeResponseBlock responses={response} />
        </Suspense>
      </TrialProvenanceContext.Provider>
    </div>
  );
}
