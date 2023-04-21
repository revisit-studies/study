import { lazy, Suspense, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { useParams } from 'react-router-dom';
import {SurveyComponent, TrialsComponent} from '../parser/types';
import { useCurrentStep } from '../routes';
import {  useAppSelector } from '../store';

import {
  createTrialProvenance,
  TrialProvenanceContext,
} from '../store/trialProvenance';
import IframeController from './IframeController';

import ReactComponentController from './ReactComponentController';
import ResponseBlock from '../components/stimuli/inputcomponents/ResponseBlock';
import ImageController from './ImageController';
import SurveyResponseBlock from '../components/stimuli/inputcomponents/SurveyResponseBlock';


export function useSurveyConfig() {
  const currentStep = useCurrentStep();

  return useAppSelector((state) => {
    const { config } = state.study;
    const component = currentStep ? config?.components[currentStep] : null;

    if (!config || !currentStep || component?.type !== 'survey') return null;

    return config.components[currentStep] as SurveyComponent;
  });
}


// current active stimuli presented to the user

export default function SurveyController() {
  const config = useSurveyConfig();

  const trialProvenance = createTrialProvenance();

  if (!config || !config) return null;

  const questions = config.questions;
  return (

    <div key={'survey'}>
      <TrialProvenanceContext.Provider value={trialProvenance}>
        <ResponseBlock responses={questions} stage={'survey'}/>
      </TrialProvenanceContext.Provider>
    </div>
  );
}
