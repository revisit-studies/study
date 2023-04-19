/* eslint-disable linebreak-style */
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
  const { config, trials, practice } = useAppSelector((state) => state.study);

  if (
    currentStep.length === 0 ||
    !trialId ||
    !config ||
    (config.components[currentStep]?.type !== 'trials' && config.components[currentStep]?.type !== 'practice')
  )
    return null;

  const status: TrialResult | null = (config.components[currentStep]?.type == 'trials') ? trials[currentStep][trialId] : practice[currentStep][trialId];

  return (
    status || {
      complete: false,
      answer: null,
    }
  );
}
