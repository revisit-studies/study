import { useStoreSelector } from '../store';
import { useCurrentStep } from '../../routes';
import { TrialResult } from '../types';

/**
 *
 * @param trialId Trial id for which to get status
 * @returns TrialResult object with complete status and any answer if present. Returns null if not in trial step
 */

export function useComponentStatus(): TrialResult | null {
  const study = useStoreSelector((state) => state.trrackedSlice);

  const currentStep = useCurrentStep();

  const status = (study.answers[currentStep] as any as TrialResult);

  return status;
}
