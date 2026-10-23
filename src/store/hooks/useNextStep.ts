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
import { getPersistedAnswersFromAllLocations } from '../../utils/getAnswersFromAllLocations';
import type { Answer, Response } from '../../parser/types';
import { useStoredAnswer } from './useStoredAnswer';
import { useWindowEvents } from './useWindowEvents';
import { findBlockForStep } from '../../utils/getSequenceFlatMap';
import { useStudyConfig } from './useStudyConfig';
import { decryptIndex, encryptIndex } from '../../utils/encryptDecryptIndex';
import { useIsAnalysis } from './useIsAnalysis';
import { showNotification } from '../../utils/notifications';
import {
  answerSnapshotMatches, getSavedScoresForAnswer, hasResponseScorer, isRequiredResponseUngraded, isResponseAnsweredForScoring, isResponseScoreCorrect, scoreResponseAnswerWithStatus,
} from '../../utils/correctAnswer';
import { getApplicableCorrectAnswers, resolveResponseVisibility } from '../../utils/responseVisibility';
import { studyComponentToIndividualComponent } from '../../utils/handleComponentInheritance';
import {
  conditionIsTriggered,
  getConditionTargetIndex,
  getStoredAnswersForSkipEvaluation,
} from '../../utils/skipConditions';

export function useNextStep(responses?: Response[], correctAnswers?: Answer[]) {
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
  const assetStatus = trialValidation[identifier]?.assetStatus;
  const isNextDisabled = typeof currentStep !== 'number' || isAnalysis || (assetStatus !== undefined && assetStatus !== 'ready');

  const storedAnswer = useStoredAnswer();
  const currentComponentConfig = storedAnswer?.componentName
    ? studyConfig.components[storedAnswer.componentName]
    : undefined;
  const resolvedComponentConfig = useMemo(() => (currentComponentConfig
    ? studyComponentToIndividualComponent(currentComponentConfig, studyConfig)
    : undefined), [currentComponentConfig, studyConfig]);
  const responseConfig = useMemo(() => responses ?? resolvedComponentConfig?.response ?? [], [responses, resolvedComponentConfig]);
  const correctAnswerConfig = useMemo(() => correctAnswers
    ?? storedAnswer?.correctAnswer
    ?? resolvedComponentConfig?.correctAnswer
    ?? [], [correctAnswers, storedAnswer?.correctAnswer, resolvedComponentConfig]);

  const navigate = useNavigate();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const startTime = useMemo(() => Date.now(), [funcIndex, currentStep]);

  const windowEvents = useWindowEvents();
  const goToNextStep = useCallback((collectData = true) => {
    try {
      if (isNextDisabled) {
        return;
      }
      // Get answer from across the 3 response blocks and the provenance graph
      const validation = trialValidation[identifier];
      const answer = getPersistedAnswersFromAllLocations(validation, responseConfig, correctAnswerConfig, checkAnswerState);
      const savedScores = getSavedScoresForAnswer(checkAnswerState, answer);
      const applicableAnswers = collectData ? getApplicableCorrectAnswers(responseConfig, answer, correctAnswerConfig, savedScores) : [];
      const expectedAnswerIds = new Set(applicableAnswers.map((correctAnswer) => correctAnswer.id));
      const visibleResponseIds = collectData
        ? resolveResponseVisibility(responseConfig, answer, {}, correctAnswerConfig, savedScores).visibleIds
        : new Set<string>();
      const scores: Record<string, number> = {};
      const responseScores: Record<string, boolean> = {};
      const currentScores: Record<string, number> = {};
      let hasScoringError = false;
      let hasRequiredExpectedUnanswered = false;
      applicableAnswers.forEach((correctAnswer) => {
        const response = responseConfig.find((candidate) => candidate.id === correctAnswer.id);
        if (response?.required === false && !isResponseAnsweredForScoring(response, answer[correctAnswer.id], answer)) return;
        if (response?.required !== false && !isResponseAnsweredForScoring(response, answer[correctAnswer.id], answer)) {
          hasRequiredExpectedUnanswered = true;
          responseScores[correctAnswer.id] = false;
          return;
        }
        const savedScore = savedScores?.[correctAnswer.id];
        const { score, error } = savedScore === undefined
          ? scoreResponseAnswerWithStatus(answer[correctAnswer.id], correctAnswer, response, answer)
          : { score: savedScore, error: false };
        if (error) {
          hasScoringError = true;
          return;
        }
        if (score !== null) {
          currentScores[correctAnswer.id] = score;
          responseScores[correctAnswer.id] = isResponseScoreCorrect(score, correctAnswer.correctnessThreshold) ?? false;
          if (hasResponseScorer(response) || savedScores?.[correctAnswer.id] !== undefined) scores[correctAnswer.id] = score;
        }
      });
      responseConfig.forEach((response) => {
        if (!visibleResponseIds.has(response.id)
          || expectedAnswerIds.has(response.id)
          || !isResponseAnsweredForScoring(response, answer[response.id], answer)
          || !(hasResponseScorer(response) || !!response.path || Object.hasOwn(savedScores ?? {}, response.id))) return;
        const savedScore = savedScores?.[response.id];
        const { score, error } = savedScore === undefined
          ? scoreResponseAnswerWithStatus(answer[response.id], undefined, response, answer)
          : { score: savedScore, error: false };
        if (error) {
          hasScoringError = true;
          return;
        }
        if (score !== null) {
          currentScores[response.id] = score;
          responseScores[response.id] = isResponseScoreCorrect(score) ?? false;
          scores[response.id] = score;
        }
      });
      const hasRequiredUngradedResponse = responseConfig.some((response) => visibleResponseIds.has(response.id)
        && !expectedAnswerIds.has(response.id)
        && isRequiredResponseUngraded(response, answer[response.id], answer));
      const hasRequiredUnscoredResponse = responseConfig.some((response) => visibleResponseIds.has(response.id)
        && !expectedAnswerIds.has(response.id)
        && response.required !== false
        && hasResponseScorer(response)
        && !Object.hasOwn(currentScores, response.id));
      if (hasRequiredUngradedResponse || hasRequiredUnscoredResponse) {
        responseConfig.forEach((response) => {
          if (visibleResponseIds.has(response.id)
            && !expectedAnswerIds.has(response.id)
            && (isRequiredResponseUngraded(response, answer[response.id], answer)
              || (response.required !== false && hasResponseScorer(response) && !Object.hasOwn(currentScores, response.id)))) {
            responseScores[response.id] = false;
          }
        });
      }
      Object.entries(savedScores ?? {}).forEach(([responseId, score]) => {
        if (expectedAnswerIds.has(responseId) || responseConfig.some((response) => response.id === responseId)) return;
        currentScores[responseId] = score;
        responseScores[responseId] = isResponseScoreCorrect(score, correctAnswerConfig.find((candidate) => candidate.id === responseId)?.correctnessThreshold) === true;
        scores[responseId] = score;
      });
      const staleSavedScoreIds = answerSnapshotMatches(checkAnswerState, answer)
        ? []
        : Object.keys(checkAnswerState?.scores ?? {});
      const hasUnaccountedSavedScore = staleSavedScoreIds
        .some((responseId) => !Object.hasOwn(currentScores, responseId));
      let submissionCheckAnswer = checkAnswerState;
      if (collectData && ((checkAnswerState && (applicableAnswers.length > 0 || Object.keys(checkAnswerState.scores ?? {}).length > 0))
        || Object.keys(scores).length > 0
        || hasScoringError
        || hasRequiredExpectedUnanswered
        || hasRequiredUngradedResponse
        || hasRequiredUnscoredResponse)) {
        const hasSavedScores = Object.keys(scores).length > 0;
        submissionCheckAnswer = {
          attemptsUsed: checkAnswerState?.attemptsUsed ?? 0,
          correct: !hasScoringError && !hasUnaccountedSavedScore
            && !hasRequiredExpectedUnanswered
            && !hasRequiredUngradedResponse
            && !hasRequiredUnscoredResponse
            && Object.entries(currentScores).every(([responseId, score]) => isResponseScoreCorrect(
              score,
              correctAnswerConfig.find((candidate) => candidate.id === responseId)?.correctnessThreshold,
            ) === true),
          responses: checkAnswerState ? responseScores : {},
          ...(hasSavedScores ? { scores, answerSnapshot: structuredClone(answer) } : {}),
        };
      }
      const provenanceGraph = validation?.provenanceGraph ? structuredClone(validation.provenanceGraph) : undefined;
      const endTime = Date.now();
      const answerToPersist = collectData ? answer : {};

      // Get current window events. Splice empties the array and returns the removed elements, which handles clearing the array
      windowEvents.flushPending?.();
      const currentWindowEvents = windowEvents.current.splice(0, windowEvents.current.length);

      if (dataCollectionEnabled && (storedAnswer.endTime === -1 || clickedPrevious)) {
        const toSave = {
          ...storedAnswer,
          answer: answerToPersist,
          startTime: storedAnswer.startTime > 0 ? Math.min(storedAnswer.startTime, startTime) : startTime,
          endTime: Math.max(storedAnswer.endTime, endTime),
          windowEvents: [...(storedAnswer.windowEvents ?? []), ...currentWindowEvents],
          timedOut: !collectData,
          responseSubmitAttempted,
          checkAnswer: submissionCheckAnswer,
          correctAnswer: correctAnswerConfig,
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
          checkAnswer: submissionCheckAnswer,
          correctAnswer: correctAnswerConfig,
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
  }, [isNextDisabled, currentStep, trialValidation, identifier, storedAnswer, windowEvents, dataCollectionEnabled, clickedPrevious, sequence, answers, startTime, funcIndex, storeDispatch, saveTrialAnswer, storageEngine, setReactiveAnswers, setMatrixAnswersCheckbox, setMatrixAnswersRadio, setRankingAnswers, setAlertModal, studyConfig, participantSequence, navigate, studyId, responseSubmitAttempted, checkAnswerState, responseConfig, correctAnswerConfig]);

  return {
    isNextDisabled,
    goToNextStep,
  };
}
