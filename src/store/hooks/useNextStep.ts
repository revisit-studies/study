import { openConfirmModal } from '@mantine/modals';
import isEqual from 'lodash.isequal';
import { useCallback, useContext, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTrialAssetIdentifier } from './useTrialAssetIdentifier';
import { summarizeResponseIssues } from '../../components/response/responseErrors';
import { getCustomResponseModule, getCustomResponseModuleLoadError } from '../../components/response/customResponseModules';
import { useGlobalStore } from './useGlobalStore';
import { evaluateGlobalStoreUpdates, resolveGlobalStoreResponses } from '../../utils/globalStore';
import { createGlobalStoreSubmission, getGlobalStoreNodeState } from '../globalStoreProvenance';
import { projectGlobalStoreAnswers } from '../globalStoreProjection';
import {
  StudyStoreContext,
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
import { useStartupInteractionBlocked } from '../../components/StartupContext';

export function useNextStep(responses?: Response[], correctAnswers?: Answer[]) {
  const context = useContext(StudyStoreContext);
  const assetIdentifier = useTrialAssetIdentifier();
  const entryStore = useGlobalStore();
  const submitting = useStoreSelector((state) => state.globalStoreSubmitting);
  const completed = useStoreSelector((state) => state.completed);
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
    setGlobalStoreSubmitting, setGlobalStoreError, acceptGlobalStoreSubmission, setResponseSubmitAttempt, setStimulusSubmitAttempt, saveTrialAnswer, setReactiveAnswers, setMatrixAnswersRadio, setMatrixAnswersCheckbox, setRankingAnswers, setAlertModal,
  } = useStoreActions();
  const { storageEngine } = useStorageEngine();

  const studyId = useStudyId();
  const startupInteractionBlocked = useStartupInteractionBlocked();

  const { dataCollectionEnabled } = modes;

  // Status of the next button. If false, the next button should be disabled
  const isAnalysis = useIsAnalysis();
  const assetStatus = trialValidation[identifier]?.assetStatus;
  const isNextDisabled = typeof currentStep !== 'number' || isAnalysis || completed || !!submitting || (assetStatus !== undefined && assetStatus !== 'ready' && assetStatus !== 'missing');

  const storedAnswer = useStoredAnswer();
  const currentComponentConfig = storedAnswer?.componentName
    ? studyConfig.components[storedAnswer.componentName]
    : undefined;
  const resolvedComponentConfig = useMemo(() => (currentComponentConfig
    ? studyComponentToIndividualComponent(currentComponentConfig, studyConfig)
    : undefined), [currentComponentConfig, studyConfig]);
  const responseConfig = useMemo(() => resolveGlobalStoreResponses(resolvedComponentConfig?.response ?? responses ?? [], entryStore), [responses, resolvedComponentConfig, entryStore]);
  const correctAnswerConfig = useMemo(() => correctAnswers
    ?? storedAnswer?.correctAnswer
    ?? resolvedComponentConfig?.correctAnswer
    ?? [], [correctAnswers, storedAnswer?.correctAnswer, resolvedComponentConfig]);

  const navigate = useNavigate();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const startTime = useMemo(() => Date.now(), [funcIndex, currentStep]);

  const windowEvents = useWindowEvents();
  const goToNextStep = useCallback(async (collectData = true) => {
    const usesGlobalStore = studyConfig.globalVariables !== undefined;
    let locked = false;
    let navigated = false;
    let bypassResponseValidation = false;
    const route = window.location.href;
    if (startupInteractionBlocked) return;
    try {
      if (isNextDisabled) {
        return;
      }
      const live = usesGlobalStore ? context.store.getState() : undefined;
      if (usesGlobalStore) {
        if (live!.globalStoreSubmitting || live!.completed) return;
        if (collectData) {
          const validation = live!.trialValidation[identifier];
          const locations = ['aboveStimulus', 'belowStimulus', 'sidebar', 'stimulus'] as const;
          if (!validation || locations.some((location) => !validation[location].valid)) {
            storeDispatch(setResponseSubmitAttempt({ identifier, attempted: true }));
            storeDispatch(setStimulusSubmitAttempt({ identifier, attempted: true }));
            return;
          }
          const feedback = resolvedComponentConfig?.provideFeedback
            ?? (correctAnswerConfig.some((item) => item.feedback !== undefined) || studyConfig.uiConfig.provideFeedback);
          const training = feedback && (correctAnswerConfig.length > 0 || responseConfig.some(hasResponseScorer));
          const attempts = live!.checkAnswer[identifier]?.attemptsUsed ?? storedAnswer.checkAnswer?.attemptsUsed ?? 0;
          const limit = resolvedComponentConfig?.trainingAttempts ?? studyConfig.uiConfig.trainingAttempts ?? 2;
          const allowFailed = resolvedComponentConfig?.allowFailedTraining ?? studyConfig.uiConfig.allowFailedTraining ?? true;
          bypassResponseValidation = !!training && allowFailed && limit >= 0 && attempts >= limit;
          if (training && !(attempts > 0 && (live!.checkAnswer[identifier]?.correct || (allowFailed && limit >= 0 && attempts >= limit)))) return;
          const elapsed = Date.now() - startTime;
          const enableAfter = resolvedComponentConfig?.nextButtonEnableTime ?? studyConfig.uiConfig.nextButtonEnableTime ?? 0;
          const disableAfter = resolvedComponentConfig?.nextButtonDisableTime ?? studyConfig.uiConfig.nextButtonDisableTime;
          if (elapsed < enableAfter || (disableAfter !== undefined && elapsed > disableAfter)) return;
        }
        storeDispatch(setGlobalStoreSubmitting(identifier));
        locked = true;
      }
      // Get answer from across the 3 response blocks and the provenance graph
      const validation = trialValidation[identifier];
      const answer = getPersistedAnswersFromAllLocations(validation, responseConfig, correctAnswerConfig, checkAnswerState, entryStore);
      if (usesGlobalStore && collectData && !bypassResponseValidation) {
        const visible = resolveResponseVisibility(responseConfig, answer, {}, correctAnswerConfig, getSavedScoresForAnswer(checkAnswerState, answer), entryStore).visibleIds;
        const applicable = responseConfig.filter((response) => visible.has(response.id) && !response.hidden);
        const custom = applicable.filter((response) => response.type === 'custom');
        const validators = Object.fromEntries(custom.map((response) => [response.id, getCustomResponseModule(response)?.validate]));
        const loadErrors = Object.fromEntries(custom.map((response) => [response.id, getCustomResponseModule(response)?.default ? undefined : getCustomResponseModuleLoadError(response)]));
        const issues = summarizeResponseIssues(applicable, answer, validators, loadErrors);
        if (issues.invalidCount || issues.unansweredCount) {
          storeDispatch(setResponseSubmitAttempt({ identifier, attempted: true }));
          return;
        }
      }
      const savedScores = getSavedScoresForAnswer(checkAnswerState, answer);
      const applicableAnswers = collectData ? getApplicableCorrectAnswers(responseConfig, answer, correctAnswerConfig, savedScores, entryStore) : [];
      const expectedAnswerIds = new Set(applicableAnswers.map((correctAnswer) => correctAnswer.id));
      const visibleResponseIds = collectData
        ? resolveResponseVisibility(responseConfig, answer, {}, correctAnswerConfig, savedScores, entryStore).visibleIds
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
      const currentWindowEvents = windowEvents.current.slice();

      let committedValues = { ...entryStore };
      let activeAnswers = answers;
      const toSave = {
        ...storedAnswer,
        identifier,
        ...(usesGlobalStore ? { assetIdentifier, globalStoreEntry: { ...entryStore } } : {}),
        answer: answerToPersist,
        startTime: usesGlobalStore ? startTime : storedAnswer.startTime > 0 ? Math.min(storedAnswer.startTime, startTime) : startTime,
        endTime: Math.max(storedAnswer.endTime, endTime),
        windowEvents: [...(usesGlobalStore ? [] : storedAnswer.windowEvents ?? []), ...currentWindowEvents],
        timedOut: !collectData,
        responseSubmitAttempted,
        checkAnswer: submissionCheckAnswer,
        correctAnswer: correctAnswerConfig,
      };
      if (usesGlobalStore) {
        const updater = context.globalStoreUpdaters.get(identifier);
        let timer: ReturnType<typeof setTimeout> | undefined;
        let patch: unknown = {};
        try {
          if (collectData && updater) {
            patch = await Promise.race([
              Promise.resolve().then(() => updater({ store: Object.freeze({ ...entryStore }), answers: Object.freeze(structuredClone(answer)) })),
              new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('The global store updater did not finish. Please try again.')), 10000); }),
            ]);
          }
        } finally { clearTimeout(timer); }
        const preparationIsCurrent = () => {
          const current = context.store.getState();
          const currentValidation = current.trialValidation[identifier];
          return route === window.location.href && !current.completed && current.participantId === live!.participantId
            && current.globalStoreRevision === live!.globalStoreRevision
            && (!collectData || (updater === context.globalStoreUpdaters.get(identifier)
              && currentValidation && (currentValidation.assetStatus === undefined || currentValidation.assetStatus === 'ready')
              && (['aboveStimulus', 'belowStimulus', 'sidebar', 'stimulus'] as const).every((location) => currentValidation[location].valid)))
            && isEqual(answer, getPersistedAnswersFromAllLocations(currentValidation, responseConfig, correctAnswerConfig, checkAnswerState, entryStore));
        };
        if (!preparationIsCurrent()) return;
        const update = collectData
          ? evaluateGlobalStoreUpdates(studyConfig.globalVariables!, entryStore, responseConfig, answer, patch)
          : { values: { ...entryStore }, operations: [] };
        const next = createGlobalStoreSubmission(live!.globalStoreGraph, studyConfig.globalVariables!, toSave, update.values, update.operations, provenanceGraph ?? {});
        if (next.invalidated.length > 0) {
          const confirmed = await new Promise<boolean>((resolve) => {
            openConfirmModal({
              title: 'Change earlier answers?',
              children: 'Changing this answer will clear your later answers and recalculate the global store. Your previous answers remain in the study history.',
              labels: { cancel: 'Cancel', confirm: 'Change answers' },
              onCancel: () => resolve(false),
              onConfirm: () => resolve(true),
              onClose: () => resolve(false),
            });
          });
          if (!confirmed || !preparationIsCurrent()) return;
        }
        const replacing = !!getGlobalStoreNodeState(next.graph, next.nodeId).submission?.replaces && !next.unchanged;
        activeAnswers = projectGlobalStoreAnswers(answers, toSave, replacing);
        const revision = (live!.globalStoreRevision ?? 0) + 1;
        if (!storageEngine) throw new Error('Storage is unavailable. Please reload and try again.');
        await storageEngine.saveGlobalStoreSubmission(activeAnswers, next.graph, revision, identifier, provenanceGraph ?? {
          aboveStimulus: undefined, belowStimulus: undefined, sidebar: undefined, stimulus: undefined,
        });
        if (context.store.getState().participantId !== live!.participantId) return;
        storeDispatch(acceptGlobalStoreSubmission({
          graph: next.graph, answers: activeAnswers, revision, invalidateAfter: replacing ? toSave.trialOrder : undefined,
        }));
        // Local acceptance belongs to this participant even if browser navigation moved on.
        if (route !== window.location.href) return;
        committedValues = next.unchanged ? update.values : getGlobalStoreNodeState(next.graph).values;
      } else if (dataCollectionEnabled && (storedAnswer.endTime === -1 || clickedPrevious)) {
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

      windowEvents.current.splice(0, currentWindowEvents.length);
      let nextStep = currentStep + 1;
      let skipped = false;

      // Traverse through the sequence to find the block the current component is in
      const blocksForStep = findBlockForStep(sequence, currentStep);

      // If the current component is in a block that has a skip block (or is nested in a block that has a skip block), we need to check if the skip block should be triggered
      const hasSkipBlock = blocksForStep !== null && (blocksForStep.some((block) => block.currentBlock.skip && block.currentBlock.skip.length > 0));

      // Get the answers with the new answer added, since above is dispatching and async, but we need it synchronously
      const answersForSkipEvaluation = getStoredAnswersForSkipEvaluation(activeAnswers);

      if (collectData) {
        answersForSkipEvaluation[identifier] = {
          answer: answerToPersist,
          timedOut: false,
          checkAnswer: submissionCheckAnswer,
          correctAnswer: correctAnswerConfig,
          store: entryStore,
        };
      }

      // Check if the skip block should be triggered
      if (hasSkipBlock) {
        const skipConditions = [
          ...blocksForStep.flatMap((block) => (block.currentBlock.skip ? block.currentBlock.skip.map((condition) => ({ ...condition, firstIndex: block.firstIndex, lastIndex: currentStep })) : [])),
        ];

        // Loop over all conditions, use `.some()` to stop early if the condition is met
        skipConditions.some((condition) => {
          if (conditionIsTriggered(condition, answersForSkipEvaluation, studyConfig, committedValues)) {
            const targetIndex = getConditionTargetIndex(condition, sequence, participantSequence);
            if (targetIndex !== null) {
              nextStep = targetIndex;
              skipped = true;
            }
            return true;
          }
          return false;
        });
      }

      navigated = true;
      if (funcIndex && !skipped) {
        navigate(`/${studyId}/${encryptIndex(currentStep)}/${encryptIndex(decryptIndex(funcIndex) + 1)}${window.location.search}`);
      } else {
        navigate(`/${studyId}/${encryptIndex(nextStep)}${window.location.search}`);
      }
    } catch (error) {
      if (usesGlobalStore) {
        storeDispatch(setGlobalStoreError(error instanceof Error ? error.message : 'The response could not be saved. Please try again.'));
        return;
      }
      console.error('Failed to advance to next step', error);
      showNotification({
        title: 'Failed to Advance',
        message: 'Something went wrong while processing your response. Please try again.',
        color: 'red',
      });
    } finally {
      if (locked && !navigated) storeDispatch(setGlobalStoreSubmitting(false));
    }
  }, [startupInteractionBlocked, assetIdentifier, context, entryStore, setGlobalStoreSubmitting, setGlobalStoreError, acceptGlobalStoreSubmission, setResponseSubmitAttempt, setStimulusSubmitAttempt, resolvedComponentConfig, isNextDisabled, currentStep, trialValidation, identifier, storedAnswer, windowEvents, dataCollectionEnabled, clickedPrevious, sequence, answers, startTime, funcIndex, storeDispatch, saveTrialAnswer, storageEngine, setReactiveAnswers, setMatrixAnswersCheckbox, setMatrixAnswersRadio, setRankingAnswers, setAlertModal, studyConfig, participantSequence, navigate, studyId, responseSubmitAttempted, checkAnswerState, responseConfig, correctAnswerConfig]);

  return {
    isNextDisabled: isNextDisabled || startupInteractionBlocked,
    goToNextStep,
  };
}
