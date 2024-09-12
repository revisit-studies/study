import { useStoreSelector } from '../store';
import { useCurrentComponent, useCurrentStep } from '../../routes/utils';

export function useStoredAnswer() {
  const currentStep = useCurrentStep();
  const currentComponent = useCurrentComponent();
  const identifier = `${currentComponent}_${currentStep}`;
  const answers = useStoreSelector((state) => state.answers[identifier]);
  return answers;
}
