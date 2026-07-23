import {
  Box, Button, Group, Text, ThemeIcon,
} from '@mantine/core';

import React, {
  useEffect, useMemo, useCallback, useRef,
} from 'react';
import isEqual from 'lodash.isequal';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { Registry } from '@trrack/core';
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
import { ResponseSwitcher } from './ResponseSwitcher';
import { FeedbackAlert } from './FeedbackAlert';
import {
  CustomResponseField, FormElementProvenance, StoredAnswer, TrrackedProvenance,
} from '../../store/types';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { useStoredAnswer } from '../../store/hooks/useStoredAnswer';
import { useNextStep } from '../../store/hooks/useNextStep';
import { useIsAnalysis } from '../../store/hooks/useIsAnalysis';
import { responseAnswerIsCorrect } from '../../utils/correctAnswer';
import { getCustomResponseModule, getCustomResponseModuleLoadError } from './customResponseModules';
import { appendStimulusShowErrorsToGraph } from './stimulusProvenance';
import { useManagedTrrack } from '../../store/hooks/useRevisitTrrack';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { showNotification } from '../../utils/notifications';
import { getAnswersFromAllLocations } from '../../utils/getAnswersFromAllLocations';

type Props = {
  status?: StoredAnswer;
  config: IndividualComponent;
  location: ResponseBlockLocation;
  style?: React.CSSProperties;
};

function findMatchingStrings(arr1: string[], arr2: string[]): string[] {
  const matches: string[] = [];
  for (const str1 of arr1) {
    if (arr2.includes(str1)) {
      matches.push(str1);
    }
  }
  return matches;
}

function collectResponseValuesFromAnalysisState(
  analysisProvState: Partial<Record<ResponseBlockLocation, FormElementProvenance>>,
  status?: StoredAnswer,
): StoredAnswer['answer'] {
  return (['aboveStimulus', 'belowStimulus', 'sidebar'] as ResponseBlockLocation[]).reduce((acc, responseLocation) => {
    const locationProv = analysisProvState[responseLocation];
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
  const storeDispatch = useStoreDispatch();
  const {
    updateProvenance, updateResponseBlockValidation, saveIncorrectAnswer, saveTrialAnswer, setResponseSubmitAttempt, setStimulusSubmitAttempt, setCheckAnswerResult,
  } = useStoreActions();

  const currentStep = useCurrentStep();
  const identifier = useCurrentIdentifier();
  const isAnalysis = useIsAnalysis();
  const currentProvenance = useStoreSelector((state) => state.analysisProvState[location]) as FormElementProvenance | undefined;

  const storedAnswer = useMemo(() => currentProvenance?.form || status?.answer, [currentProvenance, status]);
  const storedAnswerData = useStoredAnswer();
  const formOrders: Record<string, string[]> = useMemo(() => storedAnswerData?.formOrder || {}, [storedAnswerData]);

  const navigate = useNavigate();

  const allResponses = useMemo(() => (formOrders?.response
    ? formOrders.response
      .map((id) => config?.response?.find((r) => r.id === id))
      .filter((r): r is Response => r !== undefined)
    : []
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
  const { actions, registry } = useMemo(() => {
    const reg = Registry.create();

    const updateFormAction = reg.register('update', (state, payload: StoredAnswer['answer']) => {
      state.form = payload;
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
      showResponseErrors: false,
    },
  }, reportProvenance, identifier);

  const reactiveAnswers = useStoreSelector((state) => state.reactiveAnswers);

  const matrixAnswers = useStoreSelector((state) => state.matrixAnswers);
  const rankingAnswers = useStoreSelector((state) => state.rankingAnswers);

  const trialValidation = useStoreSelector((state) => state.trialValidation);
  const analysisProvState = useStoreSelector((state) => state.analysisProvState);
  const { goToNextStep } = useNextStep();

  const studyConfig = useStudyConfig();

  const provideFeedback = useMemo(() => config?.provideFeedback ?? studyConfig.uiConfig.provideFeedback, [config, studyConfig]);
  const hasCorrectAnswerFeedback = !!provideFeedback && ((config?.correctAnswer?.length || 0) > 0);
  const allowFailedTraining = useMemo(() => config?.allowFailedTraining ?? studyConfig.uiConfig.allowFailedTraining ?? true, [config, studyConfig]);
  const trainingAttempts = useMemo(() => config?.trainingAttempts ?? studyConfig.uiConfig.trainingAttempts ?? 2, [config, studyConfig]);
  const savedSubmitAttempt = storedAnswerData?.responseSubmitAttempted ?? status?.responseSubmitAttempted ?? false;
  const currentSubmitAttempt = useStoreSelector((state) => state.responseSubmitAttempted[identifier]);
  const liveErrors = currentSubmitAttempt ?? savedSubmitAttempt;
  const savedCheckAnswer = storedAnswerData?.checkAnswer ?? status?.checkAnswer;
  const currentCheckAnswer = useStoreSelector((state) => state.checkAnswer[identifier]);
  const storeAnswers = useStoreSelector((state) => state.answers);
  const dataCollectionEnabled = useStoreSelector((state) => state.modes.dataCollectionEnabled);
  const { storageEngine } = useStorageEngine();
  const attemptsUsed = currentCheckAnswer?.attemptsUsed ?? 0;
  const hasCorrectAnswer = currentCheckAnswer?.correct ?? false;
  const checkAnswerResponses = currentCheckAnswer?.responses;
  const usedAllAttempts = attemptsUsed >= trainingAttempts && trainingAttempts >= 0;
  // Unlock Next after a correct answer, or once attempts run out if failed training is allowed. usedAllAttempts excludes -1, so unlimited attempts require a correct answer
  const enableNextButton = hasCorrectAnswerFeedback && attemptsUsed > 0 && (hasCorrectAnswer || (allowFailedTraining && usedAllAttempts));
  const bypassValidationForFailedTraining = hasCorrectAnswerFeedback && allowFailedTraining && usedAllAttempts;
  const disabledAttempts = usedAllAttempts || hasCorrectAnswer;
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
  const combinedLiveValues = useMemo(() => getAnswersFromAllLocations(trialValidation[identifier]), [identifier, trialValidation]);
  const combinedAnalysisValues = useMemo(
    () => collectResponseValuesFromAnalysisState(
      analysisProvState as Partial<Record<ResponseBlockLocation, FormElementProvenance>>,
      status,
    ),
    [analysisProvState, status],
  );
  const combinedValues = useMemo(
    () => (isAnalysis ? combinedAnalysisValues : combinedLiveValues),
    [combinedAnalysisValues, combinedLiveValues, isAnalysis],
  );
  const responseIssueSummary = useMemo(
    () => summarizeResponseIssues(
      allResponsesWithDefaults.filter((response) => !response.hidden),
      combinedValues,
      customResponseValidators,
      customResponseLoadErrors,
    ),
    [allResponsesWithDefaults, combinedValues, customResponseLoadErrors, customResponseValidators],
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
    () => allResponsesWithDefaults
      .filter((response) => !response.hidden)
      .filter((response) => getResponseIssueType(
        response,
        combinedValues,
        customResponseValidators[response.id],
        customResponseLoadErrors[response.id],
      ) !== null)
      .map((response) => response.id),
    [allResponsesWithDefaults, combinedValues, customResponseLoadErrors, customResponseValidators],
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

  const answerValidator = useAnswerField(
    responsesWithDefaults,
    currentStep,
    storedAnswer || {},
    customResponseValidators,
    customResponseLoadErrors,
  );
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

  useEffect(() => {
    trrack.apply('Update form field', actions.updateFormAction(structuredClone(answerValidator.values)));

    storeDispatch(
      updateResponseBlockValidation({
        location,
        identifier,
        status: answerValidator.isValid() || bypassValidationForFailedTraining,
        values: structuredClone(answerValidator.values),
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerValidator.values, bypassValidationForFailedTraining, identifier, location, storeDispatch, updateResponseBlockValidation]);
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
        status: answerValidator.isValid() || bypassValidationForFailedTraining,
        values: structuredClone(answerValidator.values),
      }),
    );
  }, [actions, answerValidator, bypassValidationForFailedTraining, identifier, isAnalysis, liveErrors, location, storeDispatch, trrack, updateResponseBlockValidation]);
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
    if (checkAnswerResponses[response.id]) {
      return [response.id, {
        visible: true, title: 'Correct Answer', message: 'You have answered the question correctly.', color: 'green',
      }];
    }
    let message = '';
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
    if (response.type === 'checkbox') {
      const correct = config?.correctAnswer?.find((answer) => answer.id === response.id)?.answer;
      const incorrectValues = storeAnswers[identifier]?.incorrectAnswers?.[response.id]?.value;
      const lastIncorrect = incorrectValues?.[incorrectValues.length - 1];
      if (Array.isArray(correct)) {
        const suppliedAnswer = Array.isArray(lastIncorrect) ? lastIncorrect as string[] : [];
        const matches = findMatchingStrings(suppliedAnswer, correct);

        const tooManySelected = correct.length === matches.length && suppliedAnswer.length > correct.length ? 'However, you have selected too many boxes. ' : '';

        message = `You have successfully checked ${matches.length}/${correct.length} correct boxes. ${tooManySelected}${message}`;
      }
    }
    return [response.id, {
      visible: true, title: 'Incorrect Answer', message, color: 'red',
    }];
  })), [allResponsesWithDefaults, allowFailedTraining, attemptsUsed, checkAnswerResponses, config, hasCorrectAnswerFeedback, identifier, storeAnswers, trainingAttempts]);
  const checkAnswerProvideFeedback = useCallback(() => {
    if (hasStimulusIssue) {
      revealStimulusErrors();
      return;
    }

    if (hasResponseIssues) {
      revealResponseErrors();
      return;
    }

    const newAttemptsUsed = attemptsUsed + 1;

    const allAnswers = getAnswersFromAllLocations(trialValidation[identifier]);

    const correctAnswers = Object.fromEntries(
      (config?.correctAnswer ?? []).map((configCorrectAnswer) => {
        const response = allResponsesWithDefaults.find((r) => r.id === configCorrectAnswer.id);
        const suppliedAnswer = allAnswers[configCorrectAnswer.id];

        return [configCorrectAnswer.id, responseAnswerIsCorrect(
          suppliedAnswer,
          configCorrectAnswer.answer,
          configCorrectAnswer.acceptableLow,
          configCorrectAnswer.acceptableHigh,
          { ignoreArrayOrder: response?.type === 'checkbox' || response?.type === 'dropdown' },
        )];
      }),
    );
    const allCorrect = Object.values(correctAnswers).every((isCorrect) => isCorrect);

    if (hasCorrectAnswerFeedback) {
      (config?.correctAnswer ?? []).forEach((configCorrectAnswer) => {
        const response = allResponsesWithDefaults.find((r) => r.id === configCorrectAnswer.id);
        if (!response || response.type === 'textOnly' || response.type === 'divider') {
          return;
        }
        if (!correctAnswers[response.id]) {
          storeDispatch(saveIncorrectAnswer({ question: identifier, identifier: response.id, answer: allAnswers[response.id] }));
        }
      });
    }

    storeDispatch(setCheckAnswerResult({
      identifier,
      attemptsUsed: newAttemptsUsed,
      correct: allCorrect,
      responses: correctAnswers,
    }));
  }, [allResponsesWithDefaults, attemptsUsed, config, hasCorrectAnswerFeedback, hasResponseIssues, hasStimulusIssue, identifier, revealResponseErrors, revealStimulusErrors, saveIncorrectAnswer, setCheckAnswerResult, storeDispatch, trialValidation]);

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
    // Do not save the check answer result if in analysis, if the buttons are not shown in this location, if there is no current check answer, or if the current check answer has the same number of attempts used as the stored answer
    if (isAnalysis || !showBtnsInLocation || currentCheckAnswer === undefined || currentCheckAnswer.attemptsUsed === storeAnswers[identifier]?.checkAnswer?.attemptsUsed) {
      return;
    }

    const draftAnswer = {
      ...storeAnswers[identifier],
      answer: getAnswersFromAllLocations(trialValidation[identifier]),
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
    if (isAnalysis || !showBtnsInLocation || currentCheckAnswer === undefined || hasCorrectAnswer || allowFailedTraining || !usedAllAttempts) {
      return undefined;
    }

    const timer = setTimeout(() => {
      navigate(`./../__trainingFailed${window.location.search}`);
    }, 5000);
    return () => clearTimeout(timer);
  }, [allowFailedTraining, currentCheckAnswer, hasCorrectAnswer, isAnalysis, navigate, showBtnsInLocation, usedAllAttempts]);

  const handleNextClick = useCallback(() => {
    if (hasStimulusIssue) {
      revealStimulusErrors();
      return;
    }

    if (bypassValidationForFailedTraining || !hasResponseIssues) {
      goToNextStep();
      return;
    }

    revealResponseErrors();
  }, [bypassValidationForFailedTraining, goToNextStep, hasResponseIssues, hasStimulusIssue, revealResponseErrors, revealStimulusErrors]);

  let index = 0;
  return (
    <>
      <Box className={`responseBlock responseBlock-${location}`} style={style}>
        {allResponsesWithDefaults.map((response) => {
          const configCorrectAnswer = config.correctAnswer?.find((answer) => answer.id === response.id)?.answer;
          const correctAnswer = configCorrectAnswer === undefined
            ? undefined
            : (typeof configCorrectAnswer === 'object' ? JSON.stringify(configCorrectAnswer) : `${configCorrectAnswer}`);
          // Check if this response is in the current location
          const isInCurrentLocation = responses.some((r) => r.id === response.id);

          if (isInCurrentLocation) {
            // Increment index for each response, unless it is a textOnly response
            if (response.type !== 'textOnly') {
              index += 1;
            } else if (response.restartEnumeration) {
              index = 0;
            }
          }

          return (
            <React.Fragment key={`${response.id}-${currentStep}`}>
              {isInCurrentLocation ? (
                response.hidden ? '' : (
                  <div data-question-id={response.id}>
                    <ResponseSwitcher
                      storedAnswer={storedAnswer}
                      answerFinalized={!!status && status.endTime !== -1}
                      form={{
                        ...answerValidator.getInputProps(response.id),
                      }}
                      dontKnowCheckbox={usesStandaloneDontKnowField(response)
                        ? {
                          ...answerValidator.getInputProps(`${response.id}-dontKnow`, { type: 'checkbox' }),
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
                      customError={response.type === 'custom'
                        ? generateCustomResponseErrorMessage(
                          response,
                          answerValidator.values[response.id],
                          answerValidator.values,
                          customResponseValidators[response.id],
                          customResponseLoadErrors[response.id],
                          { showRequiredErrors: errors },
                        )
                        : undefined}
                      response={response}
                      index={index}
                      config={config}
                      disabled={disabledAttempts}
                      errors={errors}
                    />
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
            border: '1px solid var(--mantine-color-gray-2)',
            backgroundColor: 'white',
            borderRadius: 'var(--mantine-radius-md)',
            boxShadow: 'var(--mantine-shadow-sm)',
          }}
        >
          <Group gap="sm" wrap="nowrap" align="center">
            <ThemeIcon variant="transparent" color="orange" size="md">
              <IconAlertTriangle size={16} />
            </ThemeIcon>
            <Text c="black" size="sm">
              {summaryMessage}
            </Text>
          </Group>
        </Box>
      )}

      {showBtnsInLocation && (
        <NextButton
          disabled={(hasCorrectAnswerFeedback && !enableNextButton)}
          label={nextButtonText}
          config={config}
          location={location}
          onNext={handleNextClick}
          onCheckAnswer={!isAnalysis && hasCorrectAnswerFeedback && !disabledAttempts ? checkAnswerProvideFeedback : undefined}
          checkAnswer={showBtnsInLocation && hasCorrectAnswerFeedback ? (
            <Button
              disabled={disabledAttempts}
              onClick={() => checkAnswerProvideFeedback()}
              px={location === 'sidebar' ? 8 : undefined}
            >
              Check Answer
            </Button>
          ) : null}
        />
      )}
    </>
  );
}
