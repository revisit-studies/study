import { PracticeComponent, TrialsComponent } from '../parser/types';
import { useCurrentStep } from '../routes';
import { useAppSelector } from '../store';
import { StudyComponent } from '../parser/types';

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

    if (!config || !currentStep || !['trials', 'practice'].includes(component?.type || '')) return null;

    return config.components[currentStep] as TrialsComponent;
  });
}

export function useNextTrialId(currentTrial: string | null, type?: StudyComponent['type']) {
  const trialsConfig = useTrialsConfig();
  const practiceConfig = usePracticeConfig();
  const config = type === 'trials' ? trialsConfig : practiceConfig;

  if (!currentTrial || !config) return null;

  const { order } = config;

  const idx = order.findIndex((t) => t === currentTrial);

  if (idx === -1) return null;

  return order[idx + 1] || null;
}
