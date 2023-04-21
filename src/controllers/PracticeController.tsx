import { useParams } from 'react-router-dom';
import { PracticeComponent } from '../parser/types';
import { useCurrentStep } from '../routes';
import { useAppSelector } from '../store';

import StimulusController from './StimulusController';

export function usePracticeConfig() {
  const currentStep = useCurrentStep();

  return useAppSelector((state) => {
    const { config } = state.study;
    const component = currentStep ? config?.components[currentStep] : null;

    if (!config || !currentStep || component?.type !== 'practice') return null;

    return config.components[currentStep] as PracticeComponent;
  });
}

export default function PracticeController() {
    const { trialId = null } = useParams<{ trialId: string }>();
    const config = usePracticeConfig();
    
    if (!trialId || !config) return null;
  
    const trial = config.trials[trialId];
    
    const response = config.response;

    return <StimulusController trialId={trialId} stimulus={trial} response={response} type="practice"/>;
}
