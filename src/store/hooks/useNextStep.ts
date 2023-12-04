import { useStoreSelector } from '../store';
import { useCurrentStep } from '../../routes';

export function useNextStep() {
  const currentStep = useCurrentStep();

  const { sequence, config } = useStoreSelector((state) => state);

  if (currentStep === 'end' || currentStep === '') return null;

  if (!config) return null;

  const currentStepIndex = sequence.indexOf(currentStep);
  const nextStep = sequence[currentStepIndex + 1];

  return nextStep || 'end';
}
