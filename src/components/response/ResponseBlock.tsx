import {
  Box, Button, Group, Kbd, Text, ThemeIcon,
} from '@mantine/core';

import React, {
  useEffect, useMemo, useCallback, useRef, useState,
} from 'react';
import isEqual from 'lodash.isequal';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { Registry } from '@trrack/core';
import { useGlobalStore } from '../../store/hooks/useGlobalStore';
import {
  IndividualComponent,
  ResponseBlockLocation,
  Response,
} from '../../parser/types';
import { useCurrentIdentifier, useCurrentStep } from '../../routes/utils';
import {
  useStoreDispatch, useStoreSelector, useStoreActions,
} from '../../store/store';

import { NextButton } from '../NextButton';
import {
  generateInitFields, mergeReactiveAnswers, useAnswerField,
} from './utils';
import {
  generateCustomResponseErrorMessage,
  getResponseIssueType,
  summarizeResponseIssues,
  usesStandaloneDontKnowField,
} from './responseErrors';
import { shouldUseStimulusValidation } from './stimulusErrors';
import { getApplicableCorrectAnswers, resolveResponseVisibility, responseValueKeys } from '../../utils/responseVisibility';
import { ResponseSwitcher } from './ResponseSwitcher';
import {
  FeedbackAlert, formatCorrectAnswer, formatTrainingFeedback, getTrainingFeedbackText,
} from './FeedbackAlert';
import {
  CustomResponseField, FormElementProvenance, StoredAnswer, TrrackedProvenance,
} from '../../store/types';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { useStoredAnswer } from '../../store/hooks/useStoredAnswer';
import { useNextStep } from '../../store/hooks/useNextStep';
import { useIsAnalysis } from '../../store/hooks/useIsAnalysis';
import {
  getSavedScoresForAnswer, hasResponseScorer, isRequiredResponseUngraded, isResponseAnsweredForScoring, isResponseScoreCorrect, scoreResponseAnswer, scoreResponseAnswerWithStatus,
  AnswerStatus, evaluateSelectionAnswer, getMatrixCheckboxRowStatuses,
} from '../../utils/correctAnswer';
import { getHelpTextPath } from '../../utils/handleComponentInheritance';
import { getCustomResponseModule, getCustomResponseModuleLoadError } from './customResponseModules';
import { appendStimulusShowErrorsToGraph } from './stimulusProvenance';
import { useManagedTrrack } from '../../store/hooks/useRevisitTrrack';
import { useTrialProvenance } from '../../store/hooks/useTrialProvenance';
import { initializeResumedTrrack } from '../../store/resumeProvenance';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { showNotification } from '../../utils/notifications';
import { getAnswersFromAllLocations, getPersistedAnswerValues, getPersistedAnswersFromAllLocations } from '../../utils/getAnswersFromAllLocations';
import { DelayedResponseWrapper } from './DelayedResponseWrapper';

type Props = {
  status?: StoredAnswer;
  config: IndividualComponent;
  location: ResponseBlockLocation;
  style?: React.CSSProperties;
};

function collectResponseValuesFromAnalysisState(
  analysisProvState: Partial<Record<ResponseBlockLocation, FormElementProvenance>>,
  status?: StoredAnswer,
  responses: Response[] = [],
): StoredAnswer['answer'] {
  return (['aboveStimulus', 'belowStimulus', 'sidebar'] as ResponseBlockLocation[]).reduce((acc, responseLocation) => {
    const locationProv = analysisProvState[responseLocation];
    // A non-null form is a complete snapshot, including deletions; null is the initial state.
    if (locationProv?.form != null) {
      responses.filter((response) => (response.location ?? 'belowStimulus') === responseLocation)
        .flatMap(responseValueKeys).forEach((key) => { delete acc[key]; });
    }
    return {
      ...acc,
      ...(locationProv?.form || {}),
    };
  }, { ...(status?.answer || {}) } as StoredAnswer['answer']);
}

export function ResponseBlock({
  config,
  location,
  status,
  style,
}: Props) {
  const globalStoreSubmitting = useStoreSelector((state) => state.globalStoreSubmitting);
  const globalStore = useGlobalStore();
  const storeDispatch = useStoreDispatch();
  const {
    clearResponseAnswers, updateProvenance, updateResponseBlockValidation, saveIncorrectAnswer, saveTrialAnswer, setResponseSubmitAttempt, setStimulusSubmitAttempt, setCheckAnswerResult,
    setButtonAutoAdvancePending, clearButtonAutoAdvancePending, setButtonSelection,
  } = useStoreActions();

  const currentStep = useCurrentStep();
  const identifier = useCurrentIdentifier();
  const isAnalysis = useIsAnalysis();
  const currentProvenance = useStoreSelector((state) => state.analysisProvState[location]) as FormElementProvenance | undefined;

  const retainedProvenance = useTrialProvenance(location);
  const restoredForm = useMemo(() => (retainedProvenance && !retainedProvenance.resetToInitialState
    ? (initializeResumedTrrack({ registry: Registry.create(), initialState: {} }, retainedProvenance).getState() as FormElementProvenance).form
    : undefined), [retainedProvenance]);
  const storedAnswer = useMemo(() => currentProvenance?.form ?? restoredForm ?? status?.answer, [currentProvenance, restoredForm, status]);
  const storedAnswerData = useStoredAnswer();
  const formOrders: Record<string, string[]> = useMemo(() => storedAnswerData?.formOrder || {}, [storedAnswerData]);

  const navigate = useNavigate();

  const allResponses = useMemo(() => (formOrders?.response
    ? formOrders.response
      .map((id) => config?.response?.find((r) => r.id === id))
      .filter((r): r is Response => r !== undefined)
    : config?.response ?? []
  ), [config?.response, formOrders]);

  const responses = useMemo(() => allResponses.filter((r) => (r.location ? r.location === location : location === 'belowStimulus')), [allResponses, location]);

  const responsesWithDefaults = useMemo(() => responses.map((response) => {
    if (response.type !== 'textOnly' && response.type !== 'divider') {
      return {
        ...response,
        required: response.required === undefined ? true : response.required,
      };
    }
    return response;
  }), [responses]);

  const allResponsesWithDefaults = useMemo(() => allResponses.map((response) => {
    if (response.type !== 'textOnly' && response.type !== 'divider') {
      return {
        ...response,
        required: response.required === undefined ? true : response.required,
      };
    }
    return response;
  }), [allResponses]);
  // Set up trrack to store provenance graph of the answerValidator status
  const lastInteractionSourceRef = useRef<'keyboard' | 'click'>('click');
  const pendingDontKnowSelectionRef = useRef<string | null>(null);
  const { actions, registry } = useMemo(() => {
    const reg = Registry.create();

    const updateFormAction = reg.register('update', (state, payload: { values: StoredAnswer['answer']; interactionSource: 'keyboard' | 'click'; selectedButtonResponses: string[] }) => {
      state.form = payload.values;
      state.interactionSource = payload.interactionSource;
      state.selectedButtonResponses = payload.selectedButtonResponses;
      return state;
    });
    const updateShowResponseErrorsAction = reg.register('show-response-errors', (state, payload: boolean) => {
      state.showResponseErrors = payload;
      return state;
    });

    return {
      actions: {
        updateFormAction,
        updateShowResponseErrorsAction,
      },
      registry: reg,
    };
  }, []);
  const reportProvenance = useCallback((provenanceGraph: TrrackedProvenance) => {
    if (isAnalysis) return;
    storeDispatch(updateProvenance({
      location,
      identifier,
      provenanceGraph,
    }));
  }, [identifier, isAnalysis, location, storeDispatch, updateProvenance]);
  const trrack = useManagedTrrack({
    registry,
    initialState: {
      form: null,
      selectedButtonResponses: [],
      showResponseErrors: false,
      interactionSource: 'click',
    },
  }, reportProvenance, identifier, isAnalysis ? undefined : retainedProvenance);
  const [selectedButtonResponses, setSelectedButtonResponses] = useState<string[]>(
    () => (trrack.getState() as unknown as FormElementProvenance).selectedButtonResponses ?? [],
  );
  const restoredButtonSelectionsRef = useRef<string[]>([]);
  const restoredAutoAdvanceResponseIdRef = useRef<string | null>(null);
  useEffect(() => {
    const restoredSelections = (trrack.getState() as unknown as FormElementProvenance).selectedButtonResponses ?? [];
    setSelectedButtonResponses(restoredSelections);
    restoredButtonSelectionsRef.current = restoredSelections;
    restoredSelections.forEach((responseId) => storeDispatch(setButtonSelection({ identifier, responseId, selected: true })));
  }, [identifier, storeDispatch, trrack, setButtonSelection]);

  const reactiveAnswers = useStoreSelector((state) => state.reactiveAnswers);

  const matrixAnswers = useStoreSelector((state) => state.matrixAnswers);
  const rankingAnswers = useStoreSelector((state) => state.rankingAnswers);

  const trialValidation = useStoreSelector((state) => state.trialValidation);
  const analysisProvState = useStoreSelector((state) => state.analysisProvState);
  const buttonAutoAdvancePending = useStoreSelector((state) => state.buttonAutoAdvancePending[identifier]);
  const globalStoreError = useStoreSelector((state) => state.globalStoreError);
  const buttonSelectionIds = useStoreSelector((state) => state.buttonSelectionIds[identifier]);
  const { goToNextStep, getNextStepTiming, isNextDisabled } = useNextStep(config.response, config.correctAnswer);

  const studyConfig = useStudyConfig();

  const provideFeedback = useMemo(() => config.provideFeedback
    ?? (config.correctAnswer?.some((answer) => answer.feedback !== undefined) || studyConfig.uiConfig.provideFeedback), [config, studyConfig]);
  const hasCorrectAnswerFeedback = !!provideFeedback && (
    (config?.correctAnswer?.length || 0) > 0 || (config?.response ?? []).some(hasResponseScorer)
  );
  const allowFailedTraining = useMemo(() => config?.allowFailedTraining ?? studyConfig.uiConfig.allowFailedTraining ?? true, [config, studyConfig]);
  const trainingAttempts = useMemo(() => config?.trainingAttempts ?? studyConfig.uiConfig.trainingAttempts ?? 2, [config, studyConfig]);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const autoAdvanceTimerOwnerRef = useRef<{ identifier: string; responseId: string; location: ResponseBlockLocation } | undefined>(undefined);
  const autoAdvanceTriggeredRef = useRef(false);
  const pendingAutoAdvanceAttemptRef = useRef<number | null>(null);
  const autoAdvanceContinuationDueAtRef = useRef<number | null>(null);
  const autoAdvanceActionRef = useRef<() => void>(() => {});
  const autoAdvanceRunnerRef = useRef<() => void>(() => {});
  const autoAdvanceContinuationRef = useRef<() => void>(() => {});

  useEffect(() => () => {
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    const timerOwner = autoAdvanceTimerOwnerRef.current;
    autoAdvanceTimerRef.current = undefined;
    autoAdvanceTimerOwnerRef.current = undefined;
    if (timerOwner?.identifier === identifier && timerOwner.location === location) {
      storeDispatch(clearButtonAutoAdvancePending(timerOwner.identifier));
    }
  }, [clearButtonAutoAdvancePending, identifier, location, storeDispatch]);
  const savedSubmitAttempt = storedAnswerData?.responseSubmitAttempted ?? status?.responseSubmitAttempted ?? false;
  const currentSubmitAttempt = useStoreSelector((state) => state.responseSubmitAttempted[identifier]);
  const liveErrors = currentSubmitAttempt ?? savedSubmitAttempt;
  const savedCheckAnswer = storedAnswerData?.checkAnswer ?? status?.checkAnswer;
  const currentCheckAnswer = useStoreSelector((state) => state.checkAnswer[identifier]);
  const storeAnswers = useStoreSelector((state) => state.answers);
  const dataCollectionEnabled = useStoreSelector((state) => state.modes.dataCollectionEnabled);
  const { storageEngine } = useStorageEngine();
  const attemptsUsed = currentCheckAnswer?.attemptsUsed ?? 0;
  const usedAllAttempts = attemptsUsed >= trainingAttempts && trainingAttempts >= 0;
  const showBtnsInLocation = useMemo(() => location === (config?.nextButtonLocation ?? studyConfig.uiConfig.nextButtonLocation ?? 'belowStimulus'), [config, studyConfig, location]);
  const analysisErrors = useMemo(
    () => ['aboveStimulus', 'belowStimulus', 'sidebar'].some((responseLocation) => (
      (analysisProvState[responseLocation as ResponseBlockLocation] as FormElementProvenance | undefined)?.showResponseErrors
    )),
    [analysisProvState],
  );
  const hasAnalysisResponseProvenance = useMemo(
    () => ['aboveStimulus', 'belowStimulus', 'sidebar'].some((responseLocation) => (
      !!analysisProvState[responseLocation as ResponseBlockLocation]
    )),
    [analysisProvState],
  );
  const stimulusValidation = useMemo(
    () => trialValidation[identifier]?.stimulus,
    [identifier, trialValidation],
  );
  const usesStimulusValidation = useMemo(
    () => shouldUseStimulusValidation(config),
    [config],
  );
  const hasStimulusIssue = useMemo(
    () => usesStimulusValidation
      && !!stimulusValidation
      && !stimulusValidation.valid,
    [usesStimulusValidation, stimulusValidation],
  );
  // Submit attempt flag, but gated so response errors stay hidden while the stimulus is still invalid
  const errors = (isAnalysis
    ? (hasAnalysisResponseProvenance ? analysisErrors : savedSubmitAttempt)
    : liveErrors) && !hasStimulusIssue;

  const customResponses = useMemo(
    () => allResponsesWithDefaults
      .filter((response): response is Extract<(typeof allResponsesWithDefaults)[number], { type: 'custom' }> => response.type === 'custom'),
    [allResponsesWithDefaults],
  );

  const customResponseModules = useMemo(() => Object.fromEntries(
    customResponses.map((response) => [response.id, {
      response,
      module: getCustomResponseModule(response),
    }]),
  ) as Record<string, {
    response: (typeof customResponses)[number];
    module: ReturnType<typeof getCustomResponseModule>;
  }>, [customResponses]);

  const customResponseValidators = useMemo(
    () => Object.fromEntries(
      Object.entries(customResponseModules)
        .filter(([, customResponseModule]) => !!customResponseModule.module?.default)
        .map(([responseId, customResponseModule]) => [responseId, customResponseModule.module?.validate]),
    ),
    [customResponseModules],
  );

  const customResponseLoadErrors = useMemo(
    () => Object.fromEntries(
      Object.entries(customResponseModules)
        .filter(([, customResponseModule]) => !customResponseModule.module?.default)
        .map(([responseId, customResponseModule]) => [responseId, getCustomResponseModuleLoadError(customResponseModule.response)]),
    ),
    [customResponseModules],
  );
  const combinedLiveValues = useMemo<StoredAnswer['answer']>(() => {
    const initialValues: StoredAnswer['answer'] = generateInitFields(allResponses, { ...status?.answer, ...storedAnswer });
    // Locations mount independently. Until each publishes a snapshot, use its
    // restored values/defaults so dependents do not clear valid restored answers.
    allResponses.forEach((response) => {
      const responseLocation = response.location ?? 'belowStimulus';
      if (trialValidation[identifier]?.[responseLocation]?.initialized) {
        responseValueKeys(response).forEach((key) => { delete initialValues[key]; });
      }
    });
    return { ...initialValues, ...getAnswersFromAllLocations(trialValidation[identifier]) };
  }, [allResponses, status?.answer, storedAnswer, identifier, trialValidation]);
  const combinedAnalysisValues = useMemo(
    () => collectResponseValuesFromAnalysisState(
      analysisProvState as Partial<Record<ResponseBlockLocation, FormElementProvenance>>,
      status,
      allResponses,
    ),
    [analysisProvState, status, allResponses],
  );
  const combinedValues = useMemo(
    () => (isAnalysis ? combinedAnalysisValues : combinedLiveValues),
    [combinedAnalysisValues, combinedLiveValues, isAnalysis],
  );
  const hasCorrectAnswer = currentCheckAnswer?.correct ?? false;
  const checkAnswerResponses = hasCorrectAnswerFeedback ? currentCheckAnswer?.responses : undefined;
  const checkedAnswerValues = currentCheckAnswer?.checkedAnswers
    ?? (savedCheckAnswer ? status?.answer ?? storedAnswer : undefined);
  const checkAnswerScores = currentCheckAnswer?.scores;
  // Unlock Next after a correct answer, or once attempts run out if failed training is allowed.
  const canContinueAfterFeedback = attemptsUsed > 0 && (hasCorrectAnswer || (allowFailedTraining && usedAllAttempts));
  const bypassValidationForFailedTraining = hasCorrectAnswerFeedback && allowFailedTraining && usedAllAttempts;
  const disabledAttempts = hasCorrectAnswerFeedback && (usedAllAttempts || hasCorrectAnswer);
  const persistedVisibilityScores = isAnalysis
    ? getSavedScoresForAnswer(status?.checkAnswer, getPersistedAnswerValues(
      combinedValues,
      allResponsesWithDefaults,
      config.correctAnswer,
      status?.checkAnswer,
      globalStore,
    ))
    : undefined;
  const answerValidator = useAnswerField(
    responsesWithDefaults,
    currentStep,
    storedAnswer || {},
    customResponseValidators,
    customResponseLoadErrors,
    allResponsesWithDefaults,
    combinedValues,
    isAnalysis,
    config.correctAnswer,
    persistedVisibilityScores,
    globalStore,
  );
  const visibilityValues = { ...combinedValues };
  responses.forEach((response) => responseValueKeys(response).forEach((key) => { delete visibilityValues[key]; }));
  const { visibleIds } = resolveResponseVisibility(allResponsesWithDefaults, {
    ...visibilityValues,
    ...answerValidator.values,
  }, {}, config.correctAnswer, persistedVisibilityScores, globalStore);
  const applicableResponses = allResponsesWithDefaults.filter((response) => visibleIds.has(response.id));
  const autoAdvanceButtonsEnabled = applicableResponses.some((response) => !response.hidden && response.type === 'buttons' && response.autoAdvanceToNextStep);
  const selectedButtonResponseIds = new Set([...(buttonSelectionIds ?? []), ...selectedButtonResponses]);
  const hasLockedAutoAdvanceSelection = applicableResponses.some((response) => (
    response.type === 'buttons'
    && response.autoAdvanceToNextStep
    && response.allowResponseChange === false
    && selectedButtonResponseIds.has(response.id)
  ));
  autoAdvanceRunnerRef.current = () => {
    if (autoAdvanceTriggeredRef.current) return;
    const pending = buttonAutoAdvancePending;
    const response = pending && allResponses.find((candidate) => candidate.id === pending.responseId);
    if (response && (response.location ?? 'belowStimulus') !== location) {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = undefined;
      autoAdvanceTimerOwnerRef.current = undefined;
      return;
    }
    const hasSelection = !!response && selectedButtonResponseIds.has(response.id);
    if (!pending || !response || response.hidden || !visibleIds.has(response.id) || !hasSelection) {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = undefined;
      autoAdvanceTimerOwnerRef.current = undefined;
      if (pending) storeDispatch(clearButtonAutoAdvancePending(identifier));
      return;
    }

    const selectionDelayRemaining = pending.dueAt - Date.now();
    if (selectionDelayRemaining > 0) {
      autoAdvanceTimerOwnerRef.current = { identifier, responseId: response.id, location };
      autoAdvanceTimerRef.current = setTimeout(() => {
        autoAdvanceTimerRef.current = undefined;
        autoAdvanceRunnerRef.current();
      }, selectionDelayRemaining);
      return;
    }

    if (isNextDisabled) return;

    const timing = getNextStepTiming();
    if (!timing.eligible) {
      if (timing.retryAfterMs !== undefined) {
        autoAdvanceTimerOwnerRef.current = { identifier, responseId: response.id, location };
        autoAdvanceTimerRef.current = setTimeout(() => {
          autoAdvanceTimerRef.current = undefined;
          autoAdvanceRunnerRef.current();
        }, timing.retryAfterMs);
      } else {
        autoAdvanceTimerRef.current = undefined;
        autoAdvanceTimerOwnerRef.current = undefined;
        storeDispatch(clearButtonAutoAdvancePending(identifier));
      }
      return;
    }

    autoAdvanceTriggeredRef.current = true;
    autoAdvanceActionRef.current();
  };
  useEffect(() => {
    if (!isNextDisabled && buttonAutoAdvancePending && !autoAdvanceTimerRef.current) autoAdvanceRunnerRef.current();
  }, [buttonAutoAdvancePending, isNextDisabled]);
  useEffect(() => {
    if (!buttonAutoAdvancePending) return;
    const response = allResponses.find((candidate) => candidate.id === buttonAutoAdvancePending.responseId);
    if (response && (response.location ?? 'belowStimulus') !== location) {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = undefined;
      autoAdvanceTimerOwnerRef.current = undefined;
      return;
    }
    if (response && !response.hidden && visibleIds.has(response.id)) return;
    if (response && (response.location ?? 'belowStimulus') === location && autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = undefined;
      autoAdvanceTimerOwnerRef.current = undefined;
    }
    storeDispatch(clearButtonAutoAdvancePending(identifier));
  }, [allResponses, buttonAutoAdvancePending, identifier, location, storeDispatch, clearButtonAutoAdvancePending, visibleIds]);
  useEffect(() => {
    const hiddenSelections = responses.filter((response) => (
      response.type === 'buttons'
      && response.visibleIf
      && (!visibleIds.has(response.id)
        || ((answerValidator.values[response.id] === undefined || answerValidator.values[response.id] === '')
          && answerValidator.values[`${response.id}-dontKnow`] !== true))
      && ((buttonSelectionIds ?? []).includes(response.id) || selectedButtonResponses.includes(response.id))
    ));
    if (!hiddenSelections.length) return;

    const hiddenIds = new Set(hiddenSelections.map((response) => response.id));
    setSelectedButtonResponses((previous) => previous.filter((id) => !hiddenIds.has(id)));
    hiddenSelections.forEach((response) => storeDispatch(setButtonSelection({ identifier, responseId: response.id, selected: false })));
    if (buttonAutoAdvancePending && hiddenIds.has(buttonAutoAdvancePending.responseId)) {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = undefined;
      autoAdvanceTimerOwnerRef.current = undefined;
      storeDispatch(clearButtonAutoAdvancePending(identifier));
    }
  }, [responses, visibleIds, answerValidator.values, buttonSelectionIds, selectedButtonResponses, buttonAutoAdvancePending, identifier, storeDispatch, setButtonSelection, clearButtonAutoAdvancePending]);
  useEffect(() => {
    if (isAnalysis) return;
    const hiddenIds = responses.filter((response) => response.visibleIf && !visibleIds.has(response.id))
      .map((response) => response.id)
      .filter((id) => Object.hasOwn(reactiveAnswers, id) || Object.hasOwn(matrixAnswers, id) || Object.hasOwn(rankingAnswers, id));
    if (hiddenIds.length) storeDispatch(clearResponseAnswers(hiddenIds));
  }, [responses, visibleIds, reactiveAnswers, matrixAnswers, rankingAnswers, isAnalysis, storeDispatch, clearResponseAnswers]);
  const responseIssueSummary = useMemo(
    () => summarizeResponseIssues(
      applicableResponses.filter((response) => !response.hidden),
      combinedValues,
      customResponseValidators,
      customResponseLoadErrors,
    ),
    [applicableResponses, combinedValues, customResponseLoadErrors, customResponseValidators],
  );
  const summaryMessage = useMemo(() => {
    const unanswered = responseIssueSummary.unansweredCount;
    const invalid = responseIssueSummary.invalidCount;

    if (unanswered === 0 && invalid === 0) {
      return null;
    }

    const unansweredPart = unanswered > 0 ? (
      <>
        <strong>{unanswered}</strong>
        {' '}
        {unanswered === 1 ? 'unanswered question' : 'unanswered questions'}
      </>
    ) : null;

    const invalidPart = invalid > 0 ? (
      <>
        <strong>{invalid}</strong>
        {' '}
        {invalid === 1 ? 'invalid answer' : 'invalid answers'}
      </>
    ) : null;

    return (
      <>
        Please review
        {' '}
        {unansweredPart}
        {unansweredPart && invalidPart && ' and '}
        {invalidPart}
        {' '}
        to continue.
      </>
    );
  }, [responseIssueSummary.invalidCount, responseIssueSummary.unansweredCount]);
  const hasResponseIssues = useMemo(
    () => responseIssueSummary.unansweredCount > 0 || responseIssueSummary.invalidCount > 0,
    [responseIssueSummary.invalidCount, responseIssueSummary.unansweredCount],
  );
  const unresolvedResponseIds = useMemo(
    () => applicableResponses
      .filter((response) => !response.hidden)
      .filter((response) => getResponseIssueType(
        response,
        combinedValues,
        customResponseValidators[response.id],
        customResponseLoadErrors[response.id],
      ) !== null)
      .map((response) => response.id),
    [applicableResponses, combinedValues, customResponseLoadErrors, customResponseValidators],
  );
  const revealStimulusErrors = useCallback(() => {
    storeDispatch(setStimulusSubmitAttempt({ identifier, attempted: true }));

    const currentStimulusValidation = trialValidation[identifier]?.stimulus;
    if (!currentStimulusValidation) {
      return;
    }

    storeDispatch(updateResponseBlockValidation({
      location: 'stimulus',
      identifier,
      status: currentStimulusValidation.valid,
      values: {},
      provenanceGraph: appendStimulusShowErrorsToGraph(trialValidation[identifier]?.provenanceGraph.stimulus),
    }));
  }, [identifier, setStimulusSubmitAttempt, storeDispatch, trialValidation, updateResponseBlockValidation]);

  const scrollToFirstUnresolvedQuestion = useCallback(() => {
    if (unresolvedResponseIds.length === 0) {
      return;
    }
    // Pick the unresolved question that is visually topmost on the page — this
    // is robust across multiple response blocks (aboveStimulus / belowStimulus
    // / sidebar) whose config order may not match DOM order.
    let topmostElement: HTMLElement | null = null;
    let topmostOffset = Number.POSITIVE_INFINITY;
    unresolvedResponseIds.forEach((id) => {
      const el = document.querySelector(`[data-question-id="${CSS.escape(id)}"]`);
      if (el instanceof HTMLElement) {
        const { top } = el.getBoundingClientRect();
        if (top < topmostOffset) {
          topmostElement = el;
          topmostOffset = top;
        }
      }
    });
    const target = topmostElement as HTMLElement | null;
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Focus the first focusable element within the target element
    const focusable = target?.querySelector<HTMLElement>(
      'button:not(:disabled), input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus({ preventScroll: true });
  }, [unresolvedResponseIds]);
  const stickyVisibleRef = useRef(false);
  const stickyVisible = showBtnsInLocation && errors && !!summaryMessage;
  useEffect(() => {
    if (stickyVisible && !stickyVisibleRef.current && !isAnalysis) {
      scrollToFirstUnresolvedQuestion();
    }
    stickyVisibleRef.current = stickyVisible;
  }, [stickyVisible, scrollToFirstUnresolvedQuestion, isAnalysis]);

  const trackInputChange = useCallback((responseId: string, value: unknown, source: 'keyboard' | 'click' = 'click') => {
    lastInteractionSourceRef.current = source;
    restoredAutoAdvanceResponseIdRef.current = null;
    const targetValue = typeof value === 'object' && value !== null && 'target' in value && value.target && typeof value.target === 'object' && 'value' in value.target
      ? value.target.value
      : value;
    answerValidator.setFieldValue(responseId, targetValue as never);
    const response = allResponses.find((candidate) => candidate.id === responseId);
    if (response?.type === 'buttons') {
      const isDontKnowSelection = pendingDontKnowSelectionRef.current === responseId;
      pendingDontKnowSelectionRef.current = null;
      const selected = !!targetValue || isDontKnowSelection;
      setSelectedButtonResponses((previous) => (selected
        ? [...new Set([...previous, responseId])]
        : previous.filter((id) => id !== responseId)));
      storeDispatch(setButtonSelection({ identifier, responseId, selected }));

      if (response.autoAdvanceToNextStep) {
        const ownsPendingSelection = buttonAutoAdvancePending?.responseId === responseId;
        if (selected || ownsPendingSelection) {
          if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
          autoAdvanceTimerRef.current = undefined;
          autoAdvanceTimerOwnerRef.current = undefined;
          autoAdvanceTriggeredRef.current = false;
          if (selected) {
            const delay = response.autoAdvanceDelay ?? 300;
            storeDispatch(setButtonAutoAdvancePending({ identifier, responseId, dueAt: Date.now() + delay }));
            autoAdvanceTimerOwnerRef.current = { identifier, responseId, location };
            autoAdvanceTimerRef.current = setTimeout(() => {
              autoAdvanceTimerRef.current = undefined;
              autoAdvanceRunnerRef.current();
            }, delay);
          } else {
            storeDispatch(clearButtonAutoAdvancePending(identifier));
          }
        }
      }
    }
  }, [allResponses, answerValidator, buttonAutoAdvancePending, clearButtonAutoAdvancePending, identifier, location, setButtonAutoAdvancePending, setButtonSelection, storeDispatch]);
  const revealResponseErrors = useCallback(() => {
    storeDispatch(setResponseSubmitAttempt({ identifier, attempted: true }));
    answerValidator.validate();
  }, [answerValidator, identifier, setResponseSubmitAttempt, storeDispatch]);
  const hasRecordedShowErrorsRef = useRef(savedSubmitAttempt);

  useEffect(() => {
    hasRecordedShowErrorsRef.current = savedSubmitAttempt;
  }, [identifier, location, savedSubmitAttempt]);

  useEffect(() => {
    if (storedAnswer) {
      answerValidator.setInitialValues(generateInitFields(responses, storedAnswer));
      answerValidator.reset();
      updateResponseBlockValidation({
        location,
        identifier,
        status: answerValidator.isValid(),
        values: structuredClone(answerValidator.values),
      });
    }
    // Disable exhaustive-deps because we only want this to run when there is a new storedAnswer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responses, storedAnswer]);
  useEffect(() => {
    if (reactiveAnswers) {
      const mergedValues = mergeReactiveAnswers(responsesWithDefaults, answerValidator.values, reactiveAnswers);
      if (!isEqual(mergedValues, answerValidator.values)) {
        answerValidator.setValues(mergedValues);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reactiveAnswers]);

  useEffect(() => {
    // Checks if there are any matrix or ranking responses.
    const matrixResponse = responsesWithDefaults.filter((r) => r.type === 'matrix-radio' || r.type === 'matrix-checkbox');
    // Create blank object with current values
    const rankingResponse = responsesWithDefaults.filter((r) => r.type === 'ranking-sublist' || r.type === 'ranking-categorical' || r.type === 'ranking-pairwise');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatedValues: Record<string, any> = { ...answerValidator.values };
    // Adjust object to have new matrix response values
    matrixResponse.forEach((r) => {
      const { id } = r;
      updatedValues[id] = {
        ...answerValidator.getInputProps(id).value,
        ...matrixAnswers[id],
      };
    });

    rankingResponse.forEach((r) => {
      const { id } = r;
      updatedValues[id] = {
        ...answerValidator.getInputProps(id).value,
        ...rankingAnswers[id],
      };
    });

    // update answerValidator
    answerValidator.setValues(updatedValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matrixAnswers, rankingAnswers]);

  const validationIsValid = answerValidator.isValid() || bypassValidationForFailedTraining;
  useEffect(() => {
    if (isAnalysis) return;
    const interactionSource = lastInteractionSourceRef.current;
    lastInteractionSourceRef.current = 'click';
    const currentFormState = trrack.getState() as unknown as FormElementProvenance;
    if (!isEqual(currentFormState.form, answerValidator.values)
      || !isEqual(currentFormState.selectedButtonResponses ?? [], selectedButtonResponses)) {
      trrack.apply(`Update form field (${interactionSource})`, actions.updateFormAction({
        values: structuredClone(answerValidator.values),
        interactionSource,
        selectedButtonResponses,
      }));
    }

    storeDispatch(
      updateResponseBlockValidation({
        location,
        identifier,
        status: validationIsValid,
        replaceValues: true,
        values: structuredClone(answerValidator.values),
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerValidator.values, validationIsValid, identifier, location, storeDispatch, updateResponseBlockValidation, selectedButtonResponses]);
  useEffect(() => {
    if (isAnalysis || !liveErrors || hasRecordedShowErrorsRef.current) {
      return;
    }

    hasRecordedShowErrorsRef.current = true;
    trrack.apply('Show response errors', actions.updateShowResponseErrorsAction(true));
    storeDispatch(
      updateResponseBlockValidation({
        location,
        identifier,
        status: validationIsValid,
        replaceValues: true,
        values: structuredClone(answerValidator.values),
      }),
    );
  }, [actions, answerValidator, validationIsValid, identifier, isAnalysis, liveErrors, location, storeDispatch, trrack, updateResponseBlockValidation]);
  const matrixRowFeedback = useMemo(() => Object.fromEntries(allResponsesWithDefaults.flatMap((response) => {
    if (response.type !== 'matrix-checkbox' || !checkedAnswerValues || !checkAnswerResponses || !Object.hasOwn(checkAnswerResponses, response.id)) return [];
    if (checkAnswerScores?.[response.id] !== undefined || hasResponseScorer(response)) return [];
    const answer = config.correctAnswer?.find((correct) => correct.id === response.id);
    return answer ? [[response.id, getMatrixCheckboxRowStatuses(response, checkedAnswerValues[response.id], answer)]] : [];
  })), [allResponsesWithDefaults, checkedAnswerValues, checkAnswerResponses, checkAnswerScores, config.correctAnswer]);
  const responseStatuses = useMemo(() => {
    if (!checkAnswerResponses) return {};
    return Object.fromEntries(allResponsesWithDefaults.flatMap((response) => {
      if (!Object.hasOwn(checkAnswerResponses, response.id)) return [];
      const score = checkAnswerScores?.[response.id];
      if (score !== undefined || hasResponseScorer(response)) {
        const scoredStatus: AnswerStatus = checkAnswerResponses[response.id]
          ? 'correct'
          : score !== undefined && score > 0 ? 'partially correct' : 'incorrect';
        return [[response.id, scoredStatus]];
      }
      const answer = config.correctAnswer?.find((correct) => correct.id === response.id);
      const answerStatus: AnswerStatus = response.type === 'matrix-checkbox'
        ? (() => {
          const rowStatuses = Object.values(matrixRowFeedback[response.id] ?? {});
          if (rowStatuses.length === 0) return checkAnswerResponses[response.id] ? 'correct' : 'incorrect';
          if (rowStatuses.every((rowStatus) => rowStatus === 'correct') && checkAnswerResponses[response.id]) return 'correct';
          if (rowStatuses.every((rowStatus) => rowStatus === 'incorrect')) return 'incorrect';
          return 'partially correct';
        })()
        : response.type === 'checkbox' && answer
          ? checkAnswerResponses[response.id]
            ? 'correct'
            : checkedAnswerValues
              && evaluateSelectionAnswer(checkedAnswerValues[response.id], answer.answer, answer.acceptableAnswers) === 'partially correct'
              ? 'partially correct'
              : 'incorrect'
          : checkAnswerResponses[response.id] ? 'correct' : 'incorrect';
      return [[response.id, answerStatus]];
    }));
  }, [allResponsesWithDefaults, checkAnswerResponses, checkAnswerScores, checkedAnswerValues, config.correctAnswer, matrixRowFeedback]);
  const alertConfig = useMemo(() => Object.fromEntries(allResponsesWithDefaults.map((response) => {
    const hiddenAlert = {
      visible: false,
      title: 'Correct Answer',
      message: 'The correct answer is: ',
      color: 'green',
    };
    if (!hasCorrectAnswerFeedback || !checkAnswerResponses || !Object.hasOwn(checkAnswerResponses, response.id) || response.type === 'textOnly' || response.type === 'divider') {
      return [response.id, hiddenAlert];
    }
    const responseFeedback = config.correctAnswer?.find((answer) => answer.id === response.id)?.feedback;
    const responseStatus = responseStatuses[response.id];
    const formatMessage = (text: string) => formatTrainingFeedback(text, attemptsUsed, trainingAttempts);
    if (responseStatus === 'correct') {
      return [response.id, {
        visible: true, title: 'Correct Answer', message: formatMessage(getTrainingFeedbackText(responseFeedback?.correctText, attemptsUsed) ?? 'You have answered the question correctly.'), color: 'green', retryAllowed: false, showHelpTextLink: false, fitHeight: responseFeedback !== undefined,
      }];
    }
    let message = '';
    const partialScore = checkAnswerScores?.[response.id];
    // -1 gives unlimited attempts
    if (trainingAttempts === -1) {
      message = 'Please try again.';
    } else if (attemptsUsed >= trainingAttempts) {
      message = `You didn't answer this question correctly after ${trainingAttempts} attempts. ${allowFailedTraining ? 'You can continue to the next question.' : 'Unfortunately you have not met the criteria for continuing this study.'}`;
    } else if (trainingAttempts - attemptsUsed === 1) {
      message = 'Please try again. You have 1 attempt left.';
    } else {
      message = `Please try again. You have ${trainingAttempts - attemptsUsed} attempts left.`;
    }
    const exhausted = trainingAttempts >= 0 && attemptsUsed >= trainingAttempts;
    const isPartiallyCorrect = responseStatus === 'partially correct';
    message = formatMessage(getTrainingFeedbackText(exhausted ? responseFeedback?.exhaustedText ?? responseFeedback?.incorrectText : responseFeedback?.incorrectText, attemptsUsed) ?? message);
    if (isPartiallyCorrect) message = `Your answer is partially correct. ${message}`;
    const hint = exhausted ? undefined : getTrainingFeedbackText(responseFeedback?.hints, attemptsUsed);
    if (partialScore !== undefined && partialScore >= 0 && partialScore <= 1) {
      message = `You scored ${Math.round(partialScore * 100)}% on this question. ${message}`;
    }
    return [response.id, {
      visible: true, title: isPartiallyCorrect ? 'Partially Correct' : 'Incorrect Answer', message, color: isPartiallyCorrect ? 'orange' : 'red', retryAllowed: !exhausted, showHelpTextLink: responseFeedback === undefined && getHelpTextPath(config, studyConfig) !== undefined, fitHeight: responseFeedback !== undefined, hint: hint === undefined ? undefined : formatMessage(hint),
    }];
  })), [allResponsesWithDefaults, allowFailedTraining, attemptsUsed, checkAnswerResponses, checkAnswerScores, config, hasCorrectAnswerFeedback, responseStatuses, studyConfig, trainingAttempts]);
  const checkAnswerProvideFeedback = useCallback(() => {
    if (hasStimulusIssue) {
      revealStimulusErrors();
      return false;
    }

    if (hasResponseIssues) {
      revealResponseErrors();
      return false;
    }

    const newAttemptsUsed = attemptsUsed + 1;

    const allAnswers = getPersistedAnswerValues(
      getAnswersFromAllLocations(trialValidation[identifier]),
      allResponsesWithDefaults,
      config.correctAnswer,
      currentCheckAnswer,
      globalStore,
    );

    const applicableCorrectAnswers = getApplicableCorrectAnswers(allResponsesWithDefaults, allAnswers, config.correctAnswer, undefined, globalStore)
      .filter((answer) => {
        const response = allResponsesWithDefaults.find((candidate) => candidate.id === answer.id);
        return response?.required !== false || isResponseAnsweredForScoring(response, allAnswers[answer.id], allAnswers);
      });
    const scores: Record<string, number> = {};
    const scoringErrors: string[] = [];
    applicableCorrectAnswers.forEach((answer) => {
      const response = allResponsesWithDefaults.find((r) => r.id === answer.id);
      if (response?.path && isResponseAnsweredForScoring(response, allAnswers[answer.id], allAnswers)) {
        const score = scoreResponseAnswer(
          allAnswers[answer.id],
          answer,
          response,
          allAnswers,
        );
        if (score === null) {
          scoringErrors.push(response.id);
        } else if (hasResponseScorer(response)) {
          scores[answer.id] = score;
        }
      }
    });
    if (scoringErrors.length > 0) {
      showNotification({
        title: 'Unable to Check Answer',
        message: `The scoring configuration could not be loaded for: ${scoringErrors.join(', ')}. Please contact the study administrator.`,
        color: 'red',
      });
      return false;
    }
    const responseCorrectness: Record<string, boolean> = Object.fromEntries(
      applicableCorrectAnswers.map((configCorrectAnswer) => {
        const response = allResponsesWithDefaults.find((r) => r.id === configCorrectAnswer.id);
        const suppliedAnswer = allAnswers[configCorrectAnswer.id];
        if (response?.required !== false && !isResponseAnsweredForScoring(response, suppliedAnswer, allAnswers)) {
          return [configCorrectAnswer.id, false];
        }
        const score = Object.hasOwn(scores, configCorrectAnswer.id)
          ? scores[configCorrectAnswer.id]
          : scoreResponseAnswerWithStatus(suppliedAnswer, configCorrectAnswer, response, allAnswers).score;
        return [configCorrectAnswer.id, isResponseScoreCorrect(score, configCorrectAnswer.correctnessThreshold) === true];
      }),
    );
    const expectedAnswerIds = new Set(applicableCorrectAnswers.map((answer) => answer.id));
    const visibleResponseIds = resolveResponseVisibility(
      allResponsesWithDefaults,
      allAnswers,
      {},
      config.correctAnswer,
      undefined,
      globalStore,
    ).visibleIds;
    allResponsesWithDefaults.forEach((response) => {
      if (!visibleResponseIds.has(response.id)
        || expectedAnswerIds.has(response.id)
        || !response.path
        || !isResponseAnsweredForScoring(response, allAnswers[response.id], allAnswers)) return;

      const { score, error } = scoreResponseAnswerWithStatus(
        allAnswers[response.id],
        undefined,
        response,
        allAnswers,
      );
      if (error) {
        scoringErrors.push(response.id);
      } else if (score !== null) {
        scores[response.id] = score;
        responseCorrectness[response.id] = isResponseScoreCorrect(score) === true;
      } else if (response.required !== false && hasResponseScorer(response)) {
        responseCorrectness[response.id] = false;
      }
    });
    allResponsesWithDefaults.forEach((response) => {
      if (visibleResponseIds.has(response.id)
        && !expectedAnswerIds.has(response.id)
        && isRequiredResponseUngraded(response, allAnswers[response.id], allAnswers)) {
        responseCorrectness[response.id] = false;
      }
    });
    if (scoringErrors.length > 0) {
      showNotification({
        title: 'Unable to Check Answer',
        message: `The scoring configuration could not be loaded for: ${[...new Set(scoringErrors)].join(', ')}. Please contact the study administrator.`,
        color: 'red',
      });
      return false;
    }
    const allCorrect = Object.values(responseCorrectness).every((isCorrect) => isCorrect);

    if (hasCorrectAnswerFeedback) {
      allResponsesWithDefaults.forEach((response) => {
        if (response.type === 'textOnly' || response.type === 'divider') {
          return;
        }
        if (responseCorrectness[response.id] === false) {
          storeDispatch(saveIncorrectAnswer({ question: identifier, identifier: response.id, answer: allAnswers[response.id] }));
        }
      });
    }

    storeDispatch(setCheckAnswerResult({
      identifier,
      attemptsUsed: newAttemptsUsed,
      correct: allCorrect,
      responses: responseCorrectness,
      ...(Object.keys(scores).length > 0 ? { scores, answerSnapshot: structuredClone(allAnswers) } : {}),
      checkedAnswers: structuredClone(allAnswers),
    }));
    return true;
  }, [globalStore, allResponsesWithDefaults, attemptsUsed, config, currentCheckAnswer, hasCorrectAnswerFeedback, hasResponseIssues, hasStimulusIssue, identifier, revealResponseErrors, revealStimulusErrors, saveIncorrectAnswer, setCheckAnswerResult, storeDispatch, trialValidation]);

  const checkAnswerManually = useCallback(() => {
    if (pendingAutoAdvanceAttemptRef.current !== null || autoAdvanceContinuationDueAtRef.current !== null) return;
    if (!checkAnswerProvideFeedback() || !autoAdvanceButtonsEnabled) return;
    autoAdvanceContinuationDueAtRef.current = buttonAutoAdvancePending?.dueAt ?? Date.now();
    pendingAutoAdvanceAttemptRef.current = attemptsUsed;
    autoAdvanceTriggeredRef.current = true;
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    autoAdvanceTimerRef.current = undefined;
    autoAdvanceTimerOwnerRef.current = undefined;
    if (buttonAutoAdvancePending) storeDispatch(clearButtonAutoAdvancePending(identifier));
  }, [attemptsUsed, autoAdvanceButtonsEnabled, buttonAutoAdvancePending, checkAnswerProvideFeedback, clearButtonAutoAdvancePending, identifier, storeDispatch]);

  const nextButtonText = useMemo(() => config?.nextButtonText ?? studyConfig.uiConfig.nextButtonText ?? 'Next', [config, studyConfig]);

  useEffect(() => {
    if (isAnalysis || currentSubmitAttempt !== undefined) {
      return;
    }

    storeDispatch(setResponseSubmitAttempt({ identifier, attempted: savedSubmitAttempt }));
  }, [currentSubmitAttempt, identifier, isAnalysis, savedSubmitAttempt, setResponseSubmitAttempt, storeDispatch]);

  useEffect(() => {
    // If in analysis or does not have a saved check answer, do not set the check answer result
    if (isAnalysis || currentCheckAnswer !== undefined || savedCheckAnswer === undefined) {
      return;
    }

    storeDispatch(setCheckAnswerResult({ identifier, ...savedCheckAnswer }));
  }, [currentCheckAnswer, identifier, isAnalysis, savedCheckAnswer, setCheckAnswerResult, storeDispatch]);

  useEffect(() => {
    const storedAnswerForIdentifier = storeAnswers[identifier];
    // Dynamic block navigation briefly uses a loading identifier. Never persist
    // against it, even if a malformed loading record was restored from storage.
    if (isAnalysis || !showBtnsInLocation || identifier.includes('__dynamicLoading') || currentCheckAnswer === undefined || storedAnswerForIdentifier === undefined || currentCheckAnswer.attemptsUsed === storedAnswerForIdentifier.checkAnswer?.attemptsUsed) {
      return;
    }

    const draftAnswer = {
      ...storedAnswerForIdentifier,
      // The resolved route key is authoritative for legacy records that were
      // persisted without their internal identifier.
      identifier,
      answer: studyConfig.globalVariables !== undefined && storedAnswerForIdentifier.endTime > 0
        ? storedAnswerForIdentifier.answer
        : getPersistedAnswersFromAllLocations(trialValidation[identifier], config.response, config.correctAnswer, currentCheckAnswer, globalStore),
      checkAnswer: currentCheckAnswer,
    };

    storeDispatch(saveTrialAnswer(draftAnswer));

    if (dataCollectionEnabled && storageEngine) {
      storageEngine.saveAnswers({
        ...storeAnswers,
        [identifier]: draftAnswer,
      }).catch((error) => {
        console.error('Failed to save Check Answer progress', error);
        showNotification({
          title: 'Failed to Save Response',
          message: 'Your response could not be saved. Please check your connection and try again.',
          color: 'red',
        });
      });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCheckAnswer, dataCollectionEnabled, identifier, isAnalysis, saveTrialAnswer, showBtnsInLocation, storageEngine, storeAnswers, storeDispatch]);

  // If the user has failed the training, wait 5 seconds and redirect to a fail page
  useEffect(() => {
    if (isAnalysis || !showBtnsInLocation || !hasCorrectAnswerFeedback || currentCheckAnswer === undefined || hasCorrectAnswer || allowFailedTraining || !usedAllAttempts) {
      return undefined;
    }

    const timer = setTimeout(() => {
      navigate(`./../__trainingFailed${window.location.search}`);
    }, 5000);
    return () => clearTimeout(timer);
  }, [allowFailedTraining, currentCheckAnswer, hasCorrectAnswer, hasCorrectAnswerFeedback, isAnalysis, navigate, showBtnsInLocation, usedAllAttempts]);

  const handleNextClick = useCallback((enforceTimeRestrictions?: boolean) => {
    if (hasStimulusIssue) {
      revealStimulusErrors();
      return;
    }

    if (bypassValidationForFailedTraining || !hasResponseIssues) {
      goToNextStep(true, enforceTimeRestrictions);
      return;
    }

    revealResponseErrors();
  }, [bypassValidationForFailedTraining, goToNextStep, hasResponseIssues, hasStimulusIssue, revealResponseErrors, revealStimulusErrors]);

  autoAdvanceContinuationRef.current = () => {
    const dueAt = autoAdvanceContinuationDueAtRef.current;
    if (dueAt === null) return;
    if (isNextDisabled) return;
    const delay = dueAt - Date.now();
    const timing = getNextStepTiming();
    const retryAfter = delay > 0 ? delay : timing.retryAfterMs;
    if (retryAfter !== undefined) {
      autoAdvanceTimerRef.current = setTimeout(() => {
        autoAdvanceTimerRef.current = undefined;
        autoAdvanceContinuationRef.current();
      }, retryAfter);
      return;
    }
    if (hasStimulusIssue || hasResponseIssues) {
      handleNextClick(true);
      return;
    }
    autoAdvanceContinuationDueAtRef.current = null;
    if (timing.eligible) handleNextClick(true);
  };
  useEffect(() => {
    const restoredSelections = restoredButtonSelectionsRef.current;
    if (restoredSelections.length === 0) return;
    restoredButtonSelectionsRef.current = [];
    const response = applicableResponses.find((candidate) => (
      restoredSelections.includes(candidate.id)
      && candidate.type === 'buttons'
      && candidate.autoAdvanceToNextStep
      && candidate.allowResponseChange === false
    ));
    if (!response || response.type !== 'buttons') return;
    restoredAutoAdvanceResponseIdRef.current = response.id;
    storeDispatch(setButtonAutoAdvancePending({
      identifier,
      responseId: response.id,
      dueAt: Date.now() + (response.autoAdvanceDelay ?? 300),
    }));
  }, [applicableResponses, identifier, setButtonAutoAdvancePending, storeDispatch]);
  useEffect(() => {
    if (!isNextDisabled && autoAdvanceContinuationDueAtRef.current !== null && !autoAdvanceTimerRef.current) autoAdvanceContinuationRef.current();
  }, [isNextDisabled]);
  useEffect(() => {
    if (!hasStimulusIssue && !hasResponseIssues && autoAdvanceContinuationDueAtRef.current !== null && !autoAdvanceTimerRef.current) {
      autoAdvanceContinuationRef.current();
    }
  }, [hasResponseIssues, hasStimulusIssue]);

  autoAdvanceActionRef.current = () => {
    if (hasStimulusIssue || hasResponseIssues) {
      autoAdvanceTriggeredRef.current = false;
      handleNextClick(true);
      return;
    }
    if (!hasCorrectAnswerFeedback) {
      restoredAutoAdvanceResponseIdRef.current = null;
      storeDispatch(clearButtonAutoAdvancePending(identifier));
      handleNextClick(true);
      return;
    }
    const pendingResponseId = buttonAutoAdvancePending?.responseId;
    const checkedAnswers = currentCheckAnswer?.checkedAnswers ?? savedCheckAnswer?.checkedAnswers;
    const isRestoredSelection = pendingResponseId !== undefined
      && restoredAutoAdvanceResponseIdRef.current === pendingResponseId;
    const currentAnswerSnapshot = getPersistedAnswerValues(
      combinedValues,
      allResponsesWithDefaults,
      config.correctAnswer,
      currentCheckAnswer ?? savedCheckAnswer,
      globalStore,
    );
    const alreadyChecked = isRestoredSelection && attemptsUsed > 0 && (checkedAnswers === undefined
      || isEqual(checkedAnswers, currentAnswerSnapshot));
    if (isRestoredSelection) restoredAutoAdvanceResponseIdRef.current = null;
    if (alreadyChecked) {
      storeDispatch(clearButtonAutoAdvancePending(identifier));
      if (canContinueAfterFeedback) {
        autoAdvanceContinuationDueAtRef.current = buttonAutoAdvancePending?.dueAt ?? Date.now();
        autoAdvanceContinuationRef.current();
      }
      return;
    }
    pendingAutoAdvanceAttemptRef.current = attemptsUsed;
    checkAnswerProvideFeedback();
  };
  useEffect(() => {
    if (!hasStimulusIssue && !hasResponseIssues && buttonAutoAdvancePending && !autoAdvanceTimerRef.current) {
      autoAdvanceRunnerRef.current();
    }
  }, [buttonAutoAdvancePending, hasResponseIssues, hasStimulusIssue]);

  useEffect(() => {
    const pendingAttempt = pendingAutoAdvanceAttemptRef.current;
    if (pendingAttempt === null || attemptsUsed <= pendingAttempt) return;
    pendingAutoAdvanceAttemptRef.current = null;
    if (canContinueAfterFeedback) {
      storeDispatch(clearButtonAutoAdvancePending(identifier));
      autoAdvanceTimerOwnerRef.current = undefined;
      if (autoAdvanceContinuationDueAtRef.current === null) {
        autoAdvanceContinuationDueAtRef.current = Date.now();
      }
      autoAdvanceContinuationRef.current();
    } else {
      storeDispatch(clearButtonAutoAdvancePending(identifier));
      autoAdvanceTimerOwnerRef.current = undefined;
      autoAdvanceContinuationDueAtRef.current = null;
    }
  }, [attemptsUsed, canContinueAfterFeedback, clearButtonAutoAdvancePending, identifier, location, storeDispatch]);

  useEffect(() => {
    autoAdvanceTriggeredRef.current = false;
    pendingAutoAdvanceAttemptRef.current = null;
    autoAdvanceContinuationDueAtRef.current = null;
  }, [identifier]);

  const showLockedTrainingRetry = showBtnsInLocation
    && autoAdvanceButtonsEnabled
    && !config.showNextButtonOnAutoAdvance
    && config.hideCheckAnswerButton
    && hasCorrectAnswerFeedback
    && hasLockedAutoAdvanceSelection
    && !buttonAutoAdvancePending
    && attemptsUsed > 0
    && !canContinueAfterFeedback
    && !disabledAttempts
    && !isAnalysis
    && !globalStoreSubmitting;

  let index = 0;
  return (
    <>
      <Box className={`responseBlock responseBlock-${location}`} style={style}>
        {applicableResponses.map((response) => {
          const configCorrectAnswer = config.correctAnswer?.find((answer) => answer.id === response.id);
          const correctAnswer = configCorrectAnswer ? formatCorrectAnswer(configCorrectAnswer) : undefined;
          // Check if this response is in the current location
          const isInCurrentLocation = responses.some((r) => r.id === response.id);

          const isNonQuestion = response.type === 'textOnly' || response.type === 'divider';
          if (isInCurrentLocation && !response.hidden) {
            if (isNonQuestion) {
              if ('restartEnumeration' in response && Boolean(response.restartEnumeration)) {
                index = 0;
              }
              // Do NOT increment index for non-question elements
            } else {
              index += 1;
            }
          }
          const currentIndex = index;

          return (
            <React.Fragment key={`${response.id}-${currentStep}`}>
              {isInCurrentLocation ? (
                response.hidden ? '' : (
                  <div data-question-id={response.id}>
                    <DelayedResponseWrapper delay={response.delay}>
                      {(isDelayedDisabled: boolean) => (
                        <ResponseSwitcher
                          storedAnswer={storedAnswer}
                          answerFinalized={!!status && status.endTime !== -1}
                          buttonSelectionMade={selectedButtonResponseIds.has(response.id)}
                          form={{
                            ...answerValidator.getInputProps(response.id),
                            onChange: (value: unknown, source: 'keyboard' | 'click' = 'click') => trackInputChange(response.id, value, source),
                          }}
                          dontKnowCheckbox={usesStandaloneDontKnowField(response)
                            ? {
                              ...answerValidator.getInputProps(`${response.id}-dontKnow`, { type: 'checkbox' }),
                              onChange: (checked: boolean) => {
                                if (response.type === 'buttons') {
                                  pendingDontKnowSelectionRef.current = checked ? response.id : null;
                                }
                                answerValidator.getInputProps(`${response.id}-dontKnow`, { type: 'checkbox' }).onChange(checked);
                              },
                            }
                            : undefined}
                          otherInput={{
                            ...answerValidator.getInputProps(`${response.id}-other`),
                          }}
                          field={response.type === 'custom'
                            ? {
                              getInputProps: () => answerValidator.getInputProps(response.id),
                              setValue: (value) => answerValidator.setFieldValue(response.id, value),
                              onBlur: () => answerValidator.getInputProps(response.id).onBlur?.(),
                            } as CustomResponseField
                            : undefined}
                          validationContext={{ ...combinedValues, ...answerValidator.values }}
                          customError={response.type === 'custom'
                            ? generateCustomResponseErrorMessage(
                              response,
                              answerValidator.values[response.id],
                              { ...combinedValues, ...answerValidator.values },
                              customResponseValidators[response.id],
                              customResponseLoadErrors[response.id],
                              { showRequiredErrors: errors },
                            )
                            : undefined}
                          response={response}
                          index={currentIndex}
                          config={config}
                          matrixRowFeedback={matrixRowFeedback[response.id]}
                          disabled={disabledAttempts || !!globalStoreSubmitting}
                          isDelayedDisabled={isDelayedDisabled}
                          errors={errors}
                        />
                      )}
                    </DelayedResponseWrapper>
                    {response.type === 'likert' && responseStatuses[response.id] && (
                      <Text
                        role="status"
                        size="sm"
                        mt="xs"
                        c={responseStatuses[response.id] === 'correct' ? 'green' : responseStatuses[response.id] === 'partially correct' ? 'orange' : 'red'}
                      >
                        {responseStatuses[response.id]}
                      </Text>
                    )}
                    <FeedbackAlert
                      response={response}
                      correctAnswer={correctAnswer}
                      alertConfig={alertConfig}
                      identifier={identifier}
                      attemptsUsed={attemptsUsed}
                      trainingAttempts={trainingAttempts}
                    />
                  </div>
                )
              ) : null}
            </React.Fragment>
          );
        })}
      </Box>

      {showBtnsInLocation && errors && summaryMessage && (
        <Box
          mt="sm"
          p="sm"
          style={{
            position: 'sticky',
            bottom: 12,
            zIndex: 10,
            border: '1px solid var(--mantine-color-default-border)',
            backgroundColor: 'var(--mantine-color-body)',
            borderRadius: 'var(--mantine-radius-md)',
            boxShadow: 'var(--mantine-shadow-sm)',
          }}
        >
          <Group gap="sm" wrap="nowrap" align="center">
            <ThemeIcon variant="transparent" color="orange" size="md">
              <IconAlertTriangle size={16} />
            </ThemeIcon>
            <Text size="sm">
              {summaryMessage}
            </Text>
          </Group>
        </Box>
      )}

      {showBtnsInLocation && (
        <NextButton
          disabled={hasCorrectAnswerFeedback && !canContinueAfterFeedback && (!config.hideCheckAnswerButton || disabledAttempts)}
          label={nextButtonText}
          config={config}
          location={location}
          onNext={handleNextClick}
          hideNextButton={autoAdvanceButtonsEnabled
            && !config.showNextButtonOnAutoAdvance}
          onCheckAnswer={!isAnalysis && hasCorrectAnswerFeedback && !disabledAttempts ? checkAnswerManually : undefined}
          checkAnswer={hasCorrectAnswerFeedback && !config.hideCheckAnswerButton ? (
            <Button
              disabled={isAnalysis || disabledAttempts || !!globalStoreSubmitting}
              onClick={checkAnswerManually}
              aria-label="Check Answer"
              rightSection={(config.nextOnEnter ?? studyConfig.uiConfig.nextOnEnter) ? <Kbd size="xs" aria-hidden="true">↵ Enter</Kbd> : undefined}
            >
              Check Answer
            </Button>
          ) : undefined}
        />
      )}
      {showBtnsInLocation && globalStoreError && autoAdvanceButtonsEnabled && !config.showNextButtonOnAutoAdvance && (
        <Button onClick={() => handleNextClick(true)}>Retry submission</Button>
      )}
      {showLockedTrainingRetry && (
        <Button onClick={checkAnswerManually} aria-label="Try again">Try again</Button>
      )}
    </>
  );
}
