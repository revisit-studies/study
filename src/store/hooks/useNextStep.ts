import { useAppDispatch, useAppSelector, useStoreActions } from '../store';
import { useCurrentStep, useStudyId } from '../../routes';
import { useCallback, useMemo } from 'react';
import {
  setIframeAnswers,
  useAggregateResponses,
  useAreResponsesValid,
  useFlagsDispatch,
  useFlagsSelector,
} from '../flags';
import { useLocation, useNavigate } from 'react-router-dom';
import { deepCopy } from '../../utils/deepCopy';
import { useComponentStatus } from './useComponentStatus';

export function useNextStep() {
  const currentStep = useCurrentStep();

  const config = useAppSelector((state) => state.unTrrackedSlice.config);
  const { steps } = useAppSelector((state) => state.unTrrackedSlice);

  const id = useLocation().pathname;
  const status = useComponentStatus();

  const aggregateResponses = useAggregateResponses(id);
  const flagsSelector = useFlagsSelector((state) => state);
  const appDispatch = useAppDispatch();
  const { saveTrialAnswer } = useStoreActions();
  const flagDispatch = useFlagsDispatch();

  const areResponsesValid = useAreResponsesValid(id);

  // Status of the next button. If false, the next button should be disabled
  const isNextDisabled = !status?.complete && !areResponsesValid;

  const navigate = useNavigate();

  const nextStep = useMemo(() => {
    return currentStep === 'end' || currentStep === '' || !config
      ? null
      : currentStep && steps[currentStep] && (steps[currentStep].next || 'end');
  }, [currentStep, steps, config]);

  const computedTo = `/${useStudyId()}/${nextStep}`;

  const startTime = useMemo(() => {
    return Date.now();
  }, []);

  const goToNextStep = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const answer = deepCopy(aggregateResponses!);

    const root = flagsSelector.trialRecord[id].provenanceRoot;

    if (!status?.complete) {
      appDispatch(
        saveTrialAnswer({
          trialName: currentStep,
          trialId: id || 'NoID',
          answer,
          provenanceRoot: root || undefined,
          startTime,
          endTime: Date.now(),
        })
      );
      flagDispatch(setIframeAnswers([]));
    }

    navigate(`${computedTo}${window.location.search}`);
  }, [
    aggregateResponses,
    flagDispatch,
    flagsSelector,
    id,
    navigate,
    startTime,
    appDispatch,
    currentStep,
    saveTrialAnswer,
    status,
    computedTo,
  ]);

  return {
    nextStep,
    isDisabled: isNextDisabled,
    goToNextStep,
  };
}
