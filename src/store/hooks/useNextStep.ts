import {
  useStoreSelector,
  useStoreActions,
  useStoreDispatch,
  useAreResponsesValid,
} from '../store';
import { useCurrentStep, useStudyId } from '../../routes';
import { useCallback, useMemo } from 'react';

import { useNavigate } from 'react-router-dom';
import { deepCopy } from '../../utils/deepCopy';
import { ValidationStatus } from '../types';
import { useStorageEngine } from '../storageEngineHooks';
import { useStoredAnswer } from './useStoredAnswer';
// import { useStoreSelector } from '../store';

export function useNextStep() {
  const currentStep = useCurrentStep();

  const { sequence, trialValidation } = useStoreSelector(
    (state) => state
  );

  const status = useStoredAnswer();

  const storeDispatch = useStoreDispatch();
  const { saveTrialAnswer, setIframeAnswers } = useStoreActions();
  const { storageEngine } = useStorageEngine();

  const areResponsesValid = useAreResponsesValid(currentStep);

  // Status of the next button. If false, the next button should be disabled
  const isNextDisabled = !areResponsesValid;

  const storedAnswer = status?.answer;

  const navigate = useNavigate();

  const nextStep = useMemo(() => {
    const currentStepIndex = sequence.indexOf(currentStep);
    const nextStep = sequence[currentStepIndex + 1];

    return nextStep || 'end';
  }, [currentStep, sequence]);

  const computedTo = `/${useStudyId()}/${nextStep}`;

  const startTime = useMemo(() => {
    return Date.now();
  }, []);

  const goToNextStep = useCallback(() => {
    // Get answer from across the 3 response blocks and the provenance graph
    const trialValidationCopy = deepCopy(trialValidation[currentStep]);
    const answer = Object.values(trialValidationCopy).reduce((acc, curr) => {
      if (Object.hasOwn(curr, 'values')) {
        return { ...acc, ...(curr as ValidationStatus).values };
      }
      return acc;
    }, {});
    const provenanceGraph = trialValidationCopy.provenanceGraph;
    const endTime = Date.now();

    if (Object.keys(storedAnswer || {}).length === 0) {
      storeDispatch(
        saveTrialAnswer({
          currentStep,
          answer,
          startTime,
          endTime,
          provenanceGraph,
        })
      );
      // Update database
      if (storageEngine) {
        storageEngine.saveAnswer(currentStep, {
          answer,
          startTime,
          endTime,
          provenanceGraph,
        });
      }
      storeDispatch(setIframeAnswers([]));
    }

    navigate(`${computedTo}${window.location.search}`);
  }, [
    setIframeAnswers,
    storageEngine,
    storeDispatch,
    storedAnswer,
    trialValidation,
    navigate,
    startTime,
    currentStep,
    saveTrialAnswer,
    computedTo,
  ]);

  return {
    nextStep,
    isDisabled: isNextDisabled,
    goToNextStep,
  };
}
