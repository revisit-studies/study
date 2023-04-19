/* eslint-disable linebreak-style */
import { useLocation } from 'react-router-dom';
import { useAppSelector } from '..';
import { useCurrentStep } from '../../routes';
import { current } from '@reduxjs/toolkit';

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
    (config.components[currentStep]?.type !== 'trials' && config.components[currentStep]?.type !== 'practice')
  )
    return null;

  const trialId = useLocation().pathname.split('/')[2]; // Assumes /<trialname>/:id

  return {
    trailName: currentStep,
    trialId,
  };
}
