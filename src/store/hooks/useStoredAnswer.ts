import { useStoreSelector } from '../store';
import { useCurrentStep } from '../../routes/utils';

/**
 *
 * @param trialId Trial id for which to get status
 * @returns StoredAnswer object with complete status and any answer if present
 */

export function useStoredAnswer() {
  const { answers } = useStoreSelector((state) => state);
  const currentStep = useCurrentStep();
  const currentComponent = useStoreSelector((state) => state.sequence[currentStep]);
  return answers[currentComponent];
}
