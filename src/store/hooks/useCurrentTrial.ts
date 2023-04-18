import { useLocation } from 'react-router-dom';
import { useAppSelector } from '..';
import { useCurrentStep } from '../../routes';

/**
 *
 * @returns Returns current trial if any else null
 */

export function useCurrentTrial() {
  const currentStep = useCurrentStep();

  const { config } = useAppSelector((state) => state.study);

  if (
    currentStep.length === 0 ||
    !config ||
    config.components[currentStep]?.type !== 'trials'
  )
    return null;

  const trialId = useLocation().pathname.split('/')[2]; // Assumes /<trialname>/:id

  return {
    trailName: currentStep,
    trialId,
  };
}
