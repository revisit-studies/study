import { useStoreSelector } from '../store';
import { useCurrentComponent, useCurrentStep } from '../../routes/utils';
import { StoredAnswer } from '../types';

export function useStoredAnswer() {
  const { answers } = useStoreSelector((state) => state);
  const currentStep = useCurrentStep();
  const currentComponent = useCurrentComponent();
  const identifier = `${currentComponent}_${currentStep}`;
  return answers[identifier] as StoredAnswer | undefined;
}
