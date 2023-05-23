import { useAppSelector } from '..';
import { useCurrentStep } from '../../routes';
import { TrialResult } from '../types';
import { useCurrentTrial } from './useCurrentTrial';

/**
 *
 * @param trialId Trial id for which to get status
 * @returns TrialResult object with complete status and any answer if present. Returns null if not in trial step
 */

export function useComponentStatus(): TrialResult | null {
  const study = useAppSelector((state) => state.study);

  const currentStep = useCurrentStep();
  const currentTrial = useCurrentTrial();

  const type = study.config.components[currentStep]?.type;

  let status: TrialResult | null = null;

  if (type === 'container' && currentTrial !== null) {
    status = study[currentStep][currentTrial];
  } else {
    status = study[currentStep];
  }

  return status;
}
