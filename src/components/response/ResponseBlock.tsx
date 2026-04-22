import {
  Box, Button, Group, Text,
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

import React, {
  useEffect, useMemo, useState, useCallback, useRef,
} from 'react';
import isEqual from 'lodash.isequal';
import { useNavigate } from 'react-router';
import { Registry, initializeTrrack } from '@trrack/core';
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
  countBlockedResponses,
  generateInitFields,
  getResponseBlockingDetails,
  mergeReactiveAnswers,
  useAnswerField,
  usesStandaloneDontKnowField,
} from './utils';
import { ResponseSwitcher } from './ResponseSwitcher';
import { FeedbackAlert } from './FeedbackAlert';
import {
  CustomResponseField, FormElementProvenance, StoredAnswer, ValidationStatus,
} from '../../store/types';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { useStoredAnswer } from '../../store/hooks/useStoredAnswer';
import { responseAnswerIsCorrect } from '../../utils/correctAnswer';
import { getCustomResponseModule, getCustomResponseModuleLoadError } from './customResponseModules';
import { useIsAnalysis } from '../../store/hooks/useIsAnalysis';

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

function applyDefaultRequired(response: Response): Response {
  if (response.type === 'textOnly' || response.type === 'divider') {
    return response;
  }

  return {
    ...response,
    required: response.required === undefined ? true : response.required,
  };
}

export function ResponseBlock({
  config,
  location,
  status,
  style,
}: Props) {
  const storeDispatch = useStoreDispatch();
  const {
    updateResponseBlockValidation, saveIncorrectAnswer,
  } = useStoreActions();

  const currentStep = useCurrentStep();
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

  const responsesWithDefaults = useMemo(() => responses.map(applyDefaultRequired), [responses]);

  const allResponsesWithDefaults = useMemo(() => allResponses.map(applyDefaultRequired), [allResponses]);
  const feedbackResponses = useMemo(
    () => allResponsesWithDefaults.filter((response) => response.type !== 'textOnly' && response.type !== 'divider'),
    [allResponsesWithDefaults],
  );

  // Set up trrack to store provenance graph of the answerValidator status
  const { actions, trrack } = useMemo(() => {
    const reg = Registry.create();

    const updateFormAction = reg.register('update', (state, payload: StoredAnswer['answer']) => {
      state.form = payload;
      return state;
    });

    const trrackInst = initializeTrrack({
      registry: reg,
      initialState: {
        form: null,
      },
    });

    return {
      actions: {
        updateFormAction,
      },
      trrack: trrackInst,
    };
  }, []);

  const reactiveAnswers = useStoreSelector((state) => state.reactiveAnswers);

  const matrixAnswers = useStoreSelector((state) => state.matrixAnswers);
  const rankingAnswers = useStoreSelector((state) => state.rankingAnswers);

  const trialValidation = useStoreSelector((state) => state.trialValidation);

  const studyConfig = useStudyConfig();

  const provideFeedback = useMemo(() => config?.provideFeedback ?? studyConfig.uiConfig.provideFeedback, [config, studyConfig]);
  const hasCorrectAnswerFeedback = !!provideFeedback && ((config?.correctAnswer?.length || 0) > 0);
  const allowFailedTraining = useMemo(() => config?.allowFailedTraining ?? studyConfig.uiConfig.allowFailedTraining ?? true, [config, studyConfig]);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const trainingAttempts = useMemo(() => config?.trainingAttempts ?? studyConfig.uiConfig.trainingAttempts ?? 2, [config, studyConfig]);
  const [enableNextButton, setEnableNextButton] = useState(false);
  const [hasCorrectAnswer, setHasCorrectAnswer] = useState(false);
  const completed = useStoreSelector((state) => state.completed);
  const showUnanswered = useStoreSelector((state) => state.showUnanswered);
  const showStimulusValidation = useStoreSelector((state) => state.showStimulusValidation);
  const { setShowStimulusValidation, setShowUnanswered } = useStoreActions();
  const isAnalysis = useIsAnalysis();
  const effectiveShowUnanswered = showUnanswered && !isAnalysis && !completed;
  const effectiveShowStimulusValidation = showStimulusValidation && !isAnalysis && !completed;
  const shouldScrollToBlockedRef = useRef(false);
  const usedAllAttempts = attemptsUsed >= trainingAttempts && trainingAttempts >= 0;
  const bypassValidationForFailedTraining = hasCorrectAnswerFeedback && allowFailedTraining && usedAllAttempts;
  const disabledAttempts = usedAllAttempts || hasCorrectAnswer;
  const showBtnsInLocation = useMemo(() => location === (config?.nextButtonLocation ?? studyConfig.uiConfig.nextButtonLocation ?? 'belowStimulus'), [config, studyConfig, location]);
  const identifier = useCurrentIdentifier();

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

  const answerValidator = useAnswerField(
    responsesWithDefaults,
    currentStep,
    storedAnswer || {},
    customResponseValidators,
    customResponseLoadErrors,
  );
  useEffect(() => {
    if (storedAnswer) {
      answerValidator.setInitialValues(generateInitFields(responses, storedAnswer));
      answerValidator.reset();
      updateResponseBlockValidation({
        location,
        identifier,
        status: answerValidator.isValid(),
        values: structuredClone(answerValidator.values),
        provenanceGraph: trrack.graph.backend,
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
        provenanceGraph: trrack.graph.backend,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerValidator.values, bypassValidationForFailedTraining, identifier, location, storeDispatch, updateResponseBlockValidation]);
  const [alertConfig, setAlertConfig] = useState(Object.fromEntries(feedbackResponses.map((response) => ([response.id, {
    visible: false,
    title: 'Correct Answer',
    message: 'The correct answer is: ',
    color: 'green',
  }]))));
  const updateAlertConfig = (id: string, visible: boolean, title: string, message: string, color: string) => {
    setAlertConfig((conf) => ({
      ...conf,
      [id]: {
        visible,
        title,
        message,
        color,
      },
    }));
  };
  const checkAnswerProvideFeedback = useCallback(() => {
    const newAttemptsUsed = attemptsUsed + 1;
    setAttemptsUsed(newAttemptsUsed);

    const trialValidationCopy = structuredClone(trialValidation[identifier]);
    const allAnswers = (trialValidationCopy ? Object.values(trialValidationCopy).reduce((acc, curr) => {
      if (Object.hasOwn(curr, 'values')) {
        return { ...acc, ...(curr as ValidationStatus).values };
      }
      return acc;
    }, {}) : {}) as StoredAnswer['answer'];

    const correctAnswers = Object.fromEntries(feedbackResponses.map((response) => {
      const configCorrectAnswer = config?.correctAnswer?.find((answer) => answer.id === response.id);
      const suppliedAnswer = allAnswers[response.id];

      return [response.id, responseAnswerIsCorrect(
        suppliedAnswer,
        configCorrectAnswer?.answer,
        configCorrectAnswer?.acceptableLow,
        configCorrectAnswer?.acceptableHigh,
        { ignoreArrayOrder: response.type === 'checkbox' || response.type === 'dropdown' },
      )];
    }));

    if (hasCorrectAnswerFeedback) {
      feedbackResponses.forEach((response) => {
        if (correctAnswers[response.id] && !alertConfig[response.id]?.message.includes('You\'ve failed to answer this question correctly')) {
          updateAlertConfig(response.id, true, 'Correct Answer', 'You have answered the question correctly.', 'green');
        } else {
          storeDispatch(saveIncorrectAnswer({ question: identifier, identifier: response.id, answer: allAnswers[response.id] }));
          let message = '';
          if (trainingAttempts === -1) {
            message = 'Please try again.';
          } else if (newAttemptsUsed >= trainingAttempts) {
            message = `You didn't answer this question correctly after ${trainingAttempts} attempts. ${allowFailedTraining ? 'You can continue to the next question.' : 'Unfortunately you have not met the criteria for continuing this study.'}`;

            // If the user has failed the training, wait 5 seconds and redirect to a fail page
            if (!allowFailedTraining) {
              setTimeout(() => {
                navigate(`./../__trainingFailed${window.location.search}`);
              }, 5000);
            }
          } else if (trainingAttempts - newAttemptsUsed === 1) {
            message = 'Please try again. You have 1 attempt left.';
          } else {
            message = `Please try again. You have ${trainingAttempts - newAttemptsUsed} attempts left.`;
          }
          if (response.type === 'checkbox') {
            const correct = config?.correctAnswer?.find((answer) => answer.id === response.id)?.answer;

            const suppliedAnswer = allAnswers[response.id] as string[];
            const matches = findMatchingStrings(suppliedAnswer, correct);

            const tooManySelected = correct.length === matches.length && suppliedAnswer.length > correct.length ? 'However, you have selected too many boxes. ' : '';

            message = `You have successfully checked ${matches.length}/${correct.length} correct boxes. ${tooManySelected}${message}`;
          }
          updateAlertConfig(response.id, true, 'Incorrect Answer', message, 'red');
        }
      });

      setHasCorrectAnswer(Object.values(correctAnswers).every((isCorrect) => isCorrect));
      setEnableNextButton(
        (
          allowFailedTraining && newAttemptsUsed >= trainingAttempts
        ) || (
          Object.values(correctAnswers).every((isCorrect) => isCorrect)
          && newAttemptsUsed <= trainingAttempts
        ),
      );
    }
  }, [attemptsUsed, feedbackResponses, config, hasCorrectAnswerFeedback, trainingAttempts, allowFailedTraining, navigate, identifier, storeDispatch, alertConfig, saveIncorrectAnswer, trialValidation]);

  const nextOnEnter = config?.nextOnEnter ?? studyConfig.uiConfig.nextOnEnter;

  useEffect(() => {
    if (nextOnEnter) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Enter') {
          checkAnswerProvideFeedback();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
    return () => { };
  }, [checkAnswerProvideFeedback, nextOnEnter]);

  const nextButtonText = useMemo(() => config?.nextButtonText ?? studyConfig.uiConfig.nextButtonText ?? 'Next', [config, studyConfig]);
  const currentValidation = useMemo(
    () => trialValidation[identifier],
    [identifier, trialValidation],
  );
  const isStimulusInvalid = !!currentValidation && !currentValidation.stimulus.valid;

  const allCurrentAnswers = useMemo(() => {
    const blockAnswers = trialValidation[identifier]
      ? Object.values(trialValidation[identifier]).reduce((acc, curr) => {
        if (typeof curr === 'object' && curr !== null && 'values' in curr) {
          return { ...acc, ...(curr as ValidationStatus).values };
        }

        return acc;
      }, {} as StoredAnswer['answer'])
      : {};

    return {
      ...blockAnswers,
      ...answerValidator.values,
    };
  }, [trialValidation, identifier, answerValidator.values]);

  const responseBlockingDetailsById = useMemo(
    () => Object.fromEntries(
      allResponsesWithDefaults.map((response) => [
        response.id,
        getResponseBlockingDetails(
          response,
          allCurrentAnswers,
          customResponseValidators[response.id],
          customResponseLoadErrors[response.id],
        ),
      ]),
    ) as Record<string, ReturnType<typeof getResponseBlockingDetails>>,
    [allResponsesWithDefaults, allCurrentAnswers, customResponseLoadErrors, customResponseValidators],
  );

  const blockedCounts = useMemo(
    () => countBlockedResponses(
      allResponsesWithDefaults,
      allCurrentAnswers,
      customResponseValidators,
      customResponseLoadErrors,
    ),
    [allResponsesWithDefaults, allCurrentAnswers, customResponseLoadErrors, customResponseValidators],
  );
  const { unansweredCount, invalidCount } = blockedCounts;
  const totalBlockedCount = unansweredCount + invalidCount;
  const showBlockedResponses = effectiveShowUnanswered && !isStimulusInvalid && totalBlockedCount > 0;
  const showNextQuestionAction = showBlockedResponses && totalBlockedCount > 1;
  const blockedReviewMessage = useMemo(() => {
    const parts: string[] = [];

    if (unansweredCount > 0) {
      parts.push(`${unansweredCount} unanswered ${unansweredCount === 1 ? 'question' : 'questions'}`);
    }

    if (invalidCount > 0) {
      parts.push(`${invalidCount} invalid ${invalidCount === 1 ? 'question' : 'questions'}`);
    }

    return parts.length > 0 ? `Please review ${parts.join(' and ')} to continue.` : '';
  }, [invalidCount, unansweredCount]);
  const focusFirstInteractiveElement = useCallback((element: HTMLElement) => {
    // Wait for the smooth scroll and any layout updates to settle before moving focus.
    window.setTimeout(() => {
      const focusTarget = element.querySelector<HTMLElement>(
        'input:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      focusTarget?.focus({ preventScroll: true });
    }, 200);
  }, []);
  const scrollBlockedElementIntoView = useCallback((element: HTMLElement) => {
    const elementRect = element.getBoundingClientRect();
    const targetScrollTop = Math.max(
      0,
      window.scrollY + elementRect.top - ((window.innerHeight - elementRect.height) / 2),
    );

    window.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth',
    });
  }, []);
  const goToBlockedStimulus = useCallback(() => {
    const blockedStimulus = document.querySelector<HTMLElement>('[data-blocked-stimulus="true"]');

    if (!blockedStimulus) {
      return false;
    }

    scrollBlockedElementIntoView(blockedStimulus);

    return true;
  }, [scrollBlockedElementIntoView]);
  const goToNextBlockedQuestion = useCallback(() => {
    const blockedElements = Array.from(
      document.querySelectorAll<HTMLElement>('[data-blocked-response="true"]'),
    );

    if (blockedElements.length === 0) {
      return;
    }

    const nextBlocked = blockedElements[0];

    scrollBlockedElementIntoView(nextBlocked);
    focusFirstInteractiveElement(nextBlocked);
  }, [focusFirstInteractiveElement, scrollBlockedElementIntoView]);
  const goToFirstBlockedTarget = useCallback(() => {
    if (goToBlockedStimulus()) {
      return;
    }

    goToNextBlockedQuestion();
  }, [goToBlockedStimulus, goToNextBlockedQuestion]);
  const revealStimulusValidation = useCallback(() => {
    shouldScrollToBlockedRef.current = true;
    storeDispatch(setShowStimulusValidation(true));
  }, [setShowStimulusValidation, storeDispatch]);
  const revealResponseValidation = useCallback(() => {
    shouldScrollToBlockedRef.current = true;
    storeDispatch(setShowUnanswered(true));
  }, [setShowUnanswered, storeDispatch]);
  const handleBlockedNavigation = useCallback(() => {
    if (isStimulusInvalid) {
      if (effectiveShowStimulusValidation) {
        goToBlockedStimulus();
      } else {
        revealStimulusValidation();
      }
      return true;
    }

    if (totalBlockedCount > 0) {
      if (showBlockedResponses) {
        goToNextBlockedQuestion();
      } else {
        revealResponseValidation();
      }
      return true;
    }

    return false;
  }, [
    effectiveShowStimulusValidation,
    goToBlockedStimulus,
    goToNextBlockedQuestion,
    isStimulusInvalid,
    revealResponseValidation,
    revealStimulusValidation,
    showBlockedResponses,
    totalBlockedCount,
  ]);

  useEffect(() => {
    const hasRevealedBlockedTarget = (effectiveShowStimulusValidation && isStimulusInvalid)
      || (showBlockedResponses && totalBlockedCount > 0);

    if (!showBtnsInLocation || !hasRevealedBlockedTarget || !shouldScrollToBlockedRef.current) {
      return undefined;
    }

    shouldScrollToBlockedRef.current = false;
    const animationFrameId = window.requestAnimationFrame(() => {
      goToFirstBlockedTarget();
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [effectiveShowStimulusValidation, goToFirstBlockedTarget, isStimulusInvalid, showBlockedResponses, showBtnsInLocation, totalBlockedCount]);

  let index = 0;
  return (
    <>
      <Box
        className={`responseBlock responseBlock-${location}`}
        style={style}
      >
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
                  <>
                    <ResponseSwitcher
                      storedAnswer={storedAnswer}
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
                        ? (responseBlockingDetailsById[response.id]?.message ?? undefined)
                        : undefined}
                      blockingStatus={responseBlockingDetailsById[response.id]?.status ?? 'satisfied'}
                      response={response}
                      index={index}
                      config={config}
                      disabled={disabledAttempts}
                      showUnanswered={showBlockedResponses}
                    />
                    <FeedbackAlert
                      response={response}
                      correctAnswer={correctAnswer}
                      alertConfig={alertConfig}
                      identifier={identifier}
                      attemptsUsed={attemptsUsed}
                      trainingAttempts={trainingAttempts}
                    />
                  </>
                )
              ) : null}
            </React.Fragment>
          );
        })}
      </Box>

      {showBtnsInLocation && (
        <NextButton
          disabled={hasCorrectAnswerFeedback && !enableNextButton}
          label={nextButtonText}
          config={config}
          location={location}
          sticky={showBlockedResponses}
          helperAction={showNextQuestionAction ? (
            <Button
              variant="subtle"
              color="orange"
              size="compact-sm"
              onClick={goToFirstBlockedTarget}
            >
              Next question
            </Button>
          ) : null}
          helperContent={showBlockedResponses ? (
            <Group gap="sm" wrap="nowrap" align="flex-start">
              <Box pt={2}>
                <IconAlertTriangle size={18} color="var(--mantine-color-orange-6)" />
              </Box>
              <Box style={{ minWidth: 0 }}>
                <Text size="sm" lh={1.4}>
                  {blockedReviewMessage}
                </Text>
              </Box>
            </Group>
          ) : null}
          onNextAttempted={() => {
            if (!bypassValidationForFailedTraining && !isAnalysis) {
              handleBlockedNavigation();
            }
          }}
          checkAnswer={showBtnsInLocation && hasCorrectAnswerFeedback ? (
            <Button
              disabled={hasCorrectAnswer || (attemptsUsed >= trainingAttempts && trainingAttempts >= 0)}
              onClick={() => {
                if (handleBlockedNavigation()) {
                  return;
                }

                checkAnswerProvideFeedback();
              }}
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
