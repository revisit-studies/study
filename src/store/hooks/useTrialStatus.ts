import { useAppSelector } from '..';
import { useCurrentStep } from '../../routes';
import { TrialResult } from '../types';

/**
 *
 * @param trialId Trial id for which to get status
 * @returns TrialResult object with complete status and any answer if present. Returns null if not in trial step
 */

export function useTrialStatus(trialId: string | null): TrialResult | null {
  const currentStep = useCurrentStep();
  const study = useAppSelector((state) => state.study);

  const type = study.config.components[currentStep]?.type;

  if (type !== 'trials' && type !== 'practice') return null;

  if (currentStep.length === 0 || !trialId || !study.config) return null;

  const status: TrialResult | null =
    type === 'trials' || type === 'practice'
      ? study[type][currentStep][trialId]
      : null;

  return (
    status || {
      complete: false,
      answer: null,
    }
  );
}
