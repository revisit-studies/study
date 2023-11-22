import { useStoreSelector } from '../store';
import { useCurrentStep } from '../../routes';

/**
 *
 * @param trialId Trial id for which to get status
 * @returns StoredAnswer object with complete status and any answer if present
 */

export function useStoredAnswer() {
  const study = useStoreSelector((state) => state.trrackedSlice);
  const currentStep = useCurrentStep();
  return study.answers[currentStep];
}
