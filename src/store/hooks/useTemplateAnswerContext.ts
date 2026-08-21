import { useMemo } from 'react';
import { useFlatSequence, useStoreSelector } from '../store';
import { useCurrentStep } from '../../routes/utils';

export function useTemplateAnswerContext() {
  const answers = useStoreSelector((state) => state.answers);
  const flatSequence = useFlatSequence();
  const currentStep = useCurrentStep();
  return useMemo(() => ({ answers, flatSequence, currentStep }), [answers, flatSequence, currentStep]);
}
