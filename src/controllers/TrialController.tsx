import { lazy, Suspense, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { useParams } from "react-router-dom";
import { TrialsComponent } from "../parser/types";
import { useCurrentStep } from "../routes";
import {  useAppSelector } from "../store";

import {
  createTrialProvenance,
  TrialProvenanceContext,
} from '../store/trialProvenance';
import IframeController from './IframeController';

import ReactComponentController from './ReactComponentController';
import ResponseBlock from '../components/stimuli/inputcomponents/ResponseBlock';
import ImageController from './ImageController';


export function useTrialsConfig() {
  const currentStep = useCurrentStep();

  return useAppSelector((state) => {
    const { config } = state.study;
    const component = currentStep ? config?.components[currentStep] : null;

    if (!config || !currentStep || component?.type !== 'trials') return null;

    return config.components[currentStep] as TrialsComponent;
  });
}

export function useNextTrialId(currentTrial: string | null) {
  const config = useTrialsConfig();

  if (!currentTrial || !config) return null;

  const { order } = config;

  const idx = order.findIndex((t) => t === currentTrial);

  if (idx === -1) return null;

  return order[idx + 1] || null;
}

// current active stimuli presented to the user

export default function TrialController() {
  const { trialId = null } = useParams<{ trialId: string }>();
  const config = useTrialsConfig();

  const trialProvenance = createTrialProvenance();

  if (!trialId || !config) return null;

  const stimulus = config.trials[trialId];
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
          <ResponseBlock responses={response} />
        </Suspense>
      </TrialProvenanceContext.Provider>
    </div>
  );
}
