import { useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  useStoreSelector,
  useStoreActions,
  useStoreDispatch,
  useFlatSequence,
} from '../store';
import {
  useCurrentIdentifier, useCurrentStep, useStudyId,
} from '../../routes/utils';

import { useStorageEngine } from '../../storage/storageEngineHooks';
import { getAnswersFromAllLocations } from '../../utils/getAnswersFromAllLocations';
import { useStoredAnswer } from './useStoredAnswer';
import { useWindowEvents } from './useWindowEvents';
import { findBlockForStep } from '../../utils/getSequenceFlatMap';
import { useStudyConfig } from './useStudyConfig';
import { decryptIndex, encryptIndex } from '../../utils/encryptDecryptIndex';
import { useIsAnalysis } from './useIsAnalysis';
import { showNotification } from '../../utils/notifications';
import {
  conditionIsTriggered,
  getConditionTargetIndex,
  getStoredAnswersForSkipEvaluation,
} from '../../utils/skipConditions';

export function useNextStep() {
  const currentStep = useCurrentStep();
  const participantSequence = useFlatSequence();

  const trialValidation = useStoreSelector((state) => state.trialValidation);
  const sequence = useStoreSelector((state) => state.sequence);
  const answers = useStoreSelector((state) => state.answers);
  const modes = useStoreSelector((state) => state.modes);
  const clickedPrevious = useStoreSelector((state) => state.clickedPrevious);
  const studyConfig = useStudyConfig();

  const { funcIndex } = useParams();
  const identifier = useCurrentIdentifier();
  const responseSubmitAttempted = useStoreSelector((state) => state.responseSubmitAttempted[identifier] ?? false);
  const checkAnswerState = useStoreSelector((state) => state.checkAnswer[identifier]);

  const storeDispatch = useStoreDispatch();
  const {
    saveTrialAnswer, setReactiveAnswers, setMatrixAnswersRadio, setMatrixAnswersCheckbox, setRankingAnswers, setAlertModal,
  } = useStoreActions();
  const { storageEngine } = useStorageEngine();

  const studyId = useStudyId();

  const { dataCollectionEnabled } = modes;

  // Status of the next button. If false, the next button should be disabled
  const isAnalysis = useIsAnalysis();
  const isNextDisabled = typeof currentStep !== 'number' || isAnalysis;

  const storedAnswer = useStoredAnswer();

  const navigate = useNavigate();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const startTime = useMemo(() => Date.now(), [funcIndex, currentStep]);

  const windowEvents = useWindowEvents();
  const goToNextStep = useCallback((collectData = true) => {
    try {
      if (typeof currentStep !== 'number') {
        return;
      }
      // Get answer from across the 3 response blocks and the provenance graph
      const validation = trialValidation[identifier];
      const answer = getAnswersFromAllLocations(validation);
      const provenanceGraph = validation?.provenanceGraph ? structuredClone(validation.provenanceGraph) : undefined;
      const endTime = Date.now();
      const answerToPersist = collectData ? answer : {};

      // Get current window events. Splice empties the array and returns the removed elements, which handles clearing the array
      const currentWindowEvents = windowEvents && 'current' in windowEvents && windowEvents.current ? windowEvents.current.splice(0, windowEvents.current.length) : [];

      if (dataCollectionEnabled && (storedAnswer.endTime === -1 || clickedPrevious)) {
        const toSave = {
          ...storedAnswer,
          answer: answerToPersist,
          startTime,
          endTime,
          windowEvents: currentWindowEvents,
          timedOut: !collectData,
          responseSubmitAttempted,
          checkAnswer: checkAnswerState,
        };
        const answersToPersist = { ...answers, [identifier]: toSave };

        if (storageEngine) {
          const onSaveFailure = (error: unknown) => {
            console.error('Failed to save participant response data', error);
            storeDispatch(setAlertModal({
              show: true,
              message: 'Your response could not be saved because the connection to the server was interrupted. Please check your internet connection, then click Retry. You can continue once your response is fully saved.',
              title: 'Failed to Save Response',
            }));
          };

          storageEngine.saveAnswers(answersToPersist).catch(onSaveFailure);
          if (provenanceGraph) {
            storageEngine.saveProvenance(provenanceGraph, identifier).catch(onSaveFailure);
          }
        }

        storeDispatch(
          saveTrialAnswer({
            ...toSave,
          }),
        );
        storeDispatch(setReactiveAnswers({}));
        storeDispatch(setMatrixAnswersCheckbox(null));
        storeDispatch(setMatrixAnswersRadio(null));
        storeDispatch(setRankingAnswers(null));
      }

      let nextStep = currentStep + 1;

      // Traverse through the sequence to find the block the current component is in
      const blocksForStep = findBlockForStep(sequence, currentStep);

      // If the current component is in a block that has a skip block (or is nested in a block that has a skip block), we need to check if the skip block should be triggered
      const hasSkipBlock = blocksForStep !== null && (blocksForStep.some((block) => block.currentBlock.skip && block.currentBlock.skip.length > 0));

      // Get the answers with the new answer added, since above is dispatching and async, but we need it synchronously
      const answersForSkipEvaluation = getStoredAnswersForSkipEvaluation(answers);

      if (collectData) {
        answersForSkipEvaluation[identifier] = {
          answer: answerToPersist,
          timedOut: false,
        };
      }

      // Check if the skip block should be triggered
      if (hasSkipBlock) {
        const skipConditions = [
          ...blocksForStep.flatMap((block) => (block.currentBlock.skip ? block.currentBlock.skip.map((condition) => ({ ...condition, firstIndex: block.firstIndex, lastIndex: currentStep })) : [])),
        ];

        // Loop over all conditions, use `.some()` to stop early if the condition is met
        skipConditions.some((condition) => {
          if (conditionIsTriggered(condition, answersForSkipEvaluation, studyConfig)) {
            const targetIndex = getConditionTargetIndex(condition, sequence, participantSequence);
            if (targetIndex !== null) {
              nextStep = targetIndex;
            }
            return true;
          }
          return false;
        });
      }

      if (funcIndex) {
        navigate(`/${studyId}/${encryptIndex(currentStep)}/${encryptIndex(decryptIndex(funcIndex) + 1)}${window.location.search}`);
      } else {
        navigate(`/${studyId}/${encryptIndex(nextStep)}${window.location.search}`);
      }
    } catch (error) {
      console.error('Failed to advance to next step', error);
      showNotification({
        title: 'Failed to Advance',
        message: 'Something went wrong while processing your response. Please try again.',
        color: 'red',
      });
    }
  }, [currentStep, trialValidation, identifier, storedAnswer, windowEvents, dataCollectionEnabled, clickedPrevious, sequence, answers, startTime, funcIndex, storeDispatch, saveTrialAnswer, storageEngine, setReactiveAnswers, setMatrixAnswersCheckbox, setMatrixAnswersRadio, setRankingAnswers, setAlertModal, studyConfig, participantSequence, navigate, studyId, responseSubmitAttempted, checkAnswerState]);

  return {
    isNextDisabled,
    goToNextStep,
  };
}
