import { useFlatSequence, useStoreSelector } from '../store';
import { useCurrentStep } from '../../routes/utils';

export function useStoredAnswer() {
  const { answers } = useStoreSelector((state) => state);
  const currentStep = useCurrentStep();
  const currentComponent = useFlatSequence()[currentStep];
  const identifier = `${currentComponent}_${currentStep}`;
  return answers[identifier];
}
