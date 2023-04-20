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


export function usePracticeConfig() {
  const currentStep = useCurrentStep();

  return useAppSelector((state) => {
    const { config } = state.study;
    const component = currentStep ? config?.components[currentStep] : null;
    if (!config || !currentStep || component?.type !== 'practice') return null;

    return config.components[currentStep] as PracticeComponent;
  });
}

export function useNextPracticeId(currentPractice: string | null) {
  const config = usePracticeConfig();
  
  if (!currentPractice || !config) return null;

  const { order } = config;
  const idx = order.findIndex((t) => t === currentPractice);

  if (idx === -1) return null;

  return order[idx + 1] || null;
}

// current active stimuli presented to the user
export default function PracticeController() {
  const { trialId: practiceId = null } = useParams<{ trialId: string }>();
  
  const config = usePracticeConfig();
  const trialProvenance = createTrialProvenance();

  if (!practiceId || !config) return null;

  const stimulus = config.practice[practiceId];
  const response = config.response;
  
  return (
    <div key={practiceId}>
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
              stimulusID={practiceId}
              stimulus={stimulus.stimulus}
            />
          )}

          <PracticeResponseBlock responses={response} correctAnswer={stimulus.stimulus.correctAnswer} />
        </Suspense>
      </TrialProvenanceContext.Provider>
    </div>
  );
}
