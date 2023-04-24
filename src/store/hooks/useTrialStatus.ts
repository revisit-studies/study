import { useAppSelector } from '..';
import { StudyComponent } from '../../parser/types';
import { useCurrentStep } from '../../routes';
import { TrialResult } from '../types';

/**
 *
 * @param trialId Trial id for which to get status
 * @returns TrialResult object with complete status and any answer if present. Returns null if not in trial step
 */

export function useTrialStatus(trialId: string | null, type?: StudyComponent['type']): TrialResult | null {
  const currentStep = useCurrentStep();
  const study = useAppSelector((state) => state.study);

  if (
    currentStep.length === 0 ||
    !trialId ||
    !study.config ||
    study.config.components[currentStep]?.type !== type
  )
    return null;

  const status: TrialResult | null = type === 'trials' || type === 'practice' ? study[type][currentStep][trialId] : null;

  return (
    status || {
      complete: false,
      answer: null,
    }
  );
}
