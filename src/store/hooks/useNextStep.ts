import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useStoreSelector,
  useStoreActions,
  useStoreDispatch,
  useAreResponsesValid,
  useFlatSequence,
} from '../store';
import { useCurrentStep, useStudyId } from '../../routes/utils';

import { deepCopy } from '../../utils/deepCopy';
import { ValidationStatus } from '../types';
import { useStorageEngine } from '../storageEngineHooks';
import { useStoredAnswer } from './useStoredAnswer';
import { useWindowEvents } from './useWindowEvents';

export function useNextStep() {
  const currentStep = useCurrentStep();
  const currentComponent = useFlatSequence()[currentStep];
  const identifier = `${currentComponent}_${currentStep}`;

  const { trialValidation } = useStoreSelector(
    (state) => state,
  );

  const status = useStoredAnswer();

  const storeDispatch = useStoreDispatch();
  const { saveTrialAnswer, setIframeAnswers } = useStoreActions();
  const { storageEngine } = useStorageEngine();

  const areResponsesValid = useAreResponsesValid(identifier);

  // Status of the next button. If false, the next button should be disabled
  const isNextDisabled = !areResponsesValid;

  const storedAnswer = status?.answer;

  const navigate = useNavigate();

  const nextStep = useMemo(() => currentStep + 1, [currentStep]);

  const computedTo = `/${useStudyId()}/${nextStep}`;

  const startTime = useMemo(() => Date.now(), []);

  const windowEvents = useWindowEvents();
  const goToNextStep = useCallback(() => {
    // Get answer from across the 3 response blocks and the provenance graph
    const trialValidationCopy = deepCopy(trialValidation[identifier]);
    const answer = Object.values(trialValidationCopy).reduce((acc, curr) => {
      if (Object.hasOwn(curr, 'values')) {
        return { ...acc, ...(curr as ValidationStatus).values };
      }
      return acc;
    }, {});
    const { provenanceGraph } = trialValidationCopy;
    const endTime = Date.now();

    // Get current window events. Splice empties the array and returns the removed elements, which handles clearing the array
    const currentWindowEvents = windowEvents && 'current' in windowEvents && windowEvents.current ? windowEvents.current.splice(0, windowEvents.current.length) : [];

    if (Object.keys(storedAnswer || {}).length === 0) {
      storeDispatch(
        saveTrialAnswer({
          identifier,
          answer,
          startTime,
          endTime,
          provenanceGraph,
          windowEvents: currentWindowEvents,
        }),
      );
      // Update database
      if (storageEngine) {
        storageEngine.saveAnswer(
          identifier,
          {
            answer,
            startTime,
            endTime,
            provenanceGraph,
            windowEvents: currentWindowEvents,
          },
        );
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
    saveTrialAnswer,
    computedTo,
    windowEvents,
    identifier,
  ]);

  return {
    nextStep,
    isNextDisabled,
    goToNextStep,
  };
}
