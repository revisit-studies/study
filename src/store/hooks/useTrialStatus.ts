import { useAppSelector } from '..';
import { useCurrentStep } from '../../routes';
import { TrialResult } from '../types';

/**
 *
 * @param trialId Trial id for which to get status
 * @returns TrialResult object with complete status and any answer if present. Returns null if not in trial step
 */

export function useTrialStatus(trialId: string | null, type: 'trials' | 'practice' ): TrialResult | null {
  const currentStep = useCurrentStep();
  const study = useAppSelector((state) => state.study);

  if (
    currentStep.length === 0 ||
    !trialId ||
    !study.config ||
    study.config.components[currentStep]?.type !== type
  )
    return null;

  const status: TrialResult | null = study[type][currentStep][trialId];

  return (
    status || {
      complete: false,
      answer: null,
    }
  );
}
