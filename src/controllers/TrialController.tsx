import { useParams } from 'react-router-dom';
import { TrialsComponent} from '../parser/types';
import { useCurrentStep } from '../routes';
import { useAppSelector } from '../store';
import StimulusController from './StimulusController';


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

  if (!trialId || !config) return null;

  const trial = config.trials[trialId]; 
  
  const response = config.response;

  return <StimulusController trialId={trialId} stimulus={trial} response={response} type="trials"/>;
}
