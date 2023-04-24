import { PracticeComponent, TrialsComponent } from '../parser/types';
import { useCurrentStep } from '../routes';
import { useAppSelector } from '../store';

export function usePracticeConfig() {
  const currentStep = useCurrentStep();

  return useAppSelector((state) => {
    const { config } = state.study;
    const component = currentStep ? config?.components[currentStep] : null;

    if (!config || !currentStep || component?.type !== 'practice') return null;

    return config.components[currentStep] as PracticeComponent;
  });
}

export function useTrialsConfig() {
  const currentStep = useCurrentStep();

  return useAppSelector((state) => {
    const { config } = state.study;
    const component = currentStep ? config?.components[currentStep] : null;

    if (!config || !currentStep || component?.type !== 'trials') return null;

    return config.components[currentStep] as TrialsComponent;
  });
}

export function useNextTrialId(currentTrial: string | null, type: 'trials' | 'practice' | 'survey') {
  if(type === 'survey') return null;

  const config = type === 'trials' ? useTrialsConfig() : usePracticeConfig();

  if (!currentTrial || !config) return null;

  const { order } = config;

  const idx = order.findIndex((t) => t === currentTrial);

  if (idx === -1) return null;

  return order[idx + 1] || null;
}
