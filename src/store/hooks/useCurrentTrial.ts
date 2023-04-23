import { useLocation } from 'react-router-dom';
import { useCurrentStep } from '../../routes';

/**
 *
 * @returns Returns current trial if any else null
 */

export function useCurrentTrial() {
  const currentStep = useCurrentStep();

  const trialId = useLocation().pathname.split('/')[2] || null; // Assumes /<trialname>/:id

  return {
    trailName: currentStep,
    trialId,
  };
}
