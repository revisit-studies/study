import { useAppSelector } from '..';
import { useCurrentStep } from '../../routes';

export function useNextStep() {
  const currentStep = useCurrentStep();

  const { config, steps } = useAppSelector((state) => state.study);

  if (currentStep === 'end' || currentStep === '') return null;

  if (!config) return null;

  return (
    currentStep && steps[currentStep] && (steps[currentStep].next || 'end')
  );
}
