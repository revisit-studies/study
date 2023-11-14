import { useStoreSelector } from '../store';
import { useCurrentStep } from '../../routes';

export function useNextStep() {
  const currentStep = useCurrentStep();

  const config = useStoreSelector((state) => state.unTrrackedSlice.config);
  const { steps } = useStoreSelector((state) => state.unTrrackedSlice);

  if (currentStep === 'end' || currentStep === '') return null;

  if (!config) return null;

  return (
    currentStep && steps[currentStep] && (steps[currentStep].next || 'end')
  );
}
