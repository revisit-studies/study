import {
  Box, Button,
} from '@mantine/core';

import React, {
  useEffect, useMemo, useState, useCallback,
} from 'react';
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
import { generateInitFields, useAnswerField } from './utils';
import { ResponseSwitcher } from './ResponseSwitcher';
import { FeedbackAlert } from './FeedbackAlert';
import { FormElementProvenance, StoredAnswer, ValidationStatus } from '../../store/types';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { useStoredAnswer } from '../../store/hooks/useStoredAnswer';
import { responseAnswerIsCorrect } from '../../utils/correctAnswer';

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

export function ResponseBlock({
  config,
  location,
  status,
  style,
}: Props) {
  const { storageEngine } = useStorageEngine();
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
  const hasCorrectAnswerFeedback = provideFeedback && ((config?.correctAnswer?.length || 0) > 0);
  const allowFailedTraining = useMemo(() => config?.allowFailedTraining ?? studyConfig.uiConfig.allowFailedTraining ?? true, [config, studyConfig]);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const trainingAttempts = useMemo(() => config?.trainingAttempts ?? studyConfig.uiConfig.trainingAttempts ?? 2, [config, studyConfig]);
  const [enableNextButton, setEnableNextButton] = useState(false);
  const [hasCorrectAnswer, setHasCorrectAnswer] = useState(false);
  const usedAllAttempts = attemptsUsed >= trainingAttempts && trainingAttempts >= 0;
  const disabledAttempts = usedAllAttempts || hasCorrectAnswer;
  const showBtnsInLocation = useMemo(() => location === (config?.nextButtonLocation ?? studyConfig.uiConfig.nextButtonLocation ?? 'belowStimulus'), [config, studyConfig, location]);
  const identifier = useCurrentIdentifier();

  const answerValidator = useAnswerField(responsesWithDefaults, currentStep, storedAnswer || {});
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
    const ReactiveResponse = responsesWithDefaults.find((r) => r.type === 'reactive');
    if (reactiveAnswers && ReactiveResponse) {
      const answerId = ReactiveResponse.id;
      answerValidator.setValues({ ...answerValidator.values, [answerId]: reactiveAnswers[answerId] as string[] });
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
    trrack.apply('update', actions.updateFormAction(structuredClone(answerValidator.values)));

    storeDispatch(
      updateResponseBlockValidation({
        location,
        identifier,
        status: answerValidator.isValid(),
        values: structuredClone(answerValidator.values),
        provenanceGraph: trrack.graph.backend,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerValidator.values, identifier, location, storeDispatch, updateResponseBlockValidation]);
  const [alertConfig, setAlertConfig] = useState(Object.fromEntries(allResponsesWithDefaults.map((response) => ([response.id, {
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

    const correctAnswers = Object.fromEntries(allResponsesWithDefaults.map((response) => {
      const configCorrectAnswer = config?.correctAnswer?.find((answer) => answer.id === response.id)?.answer;
      const suppliedAnswer = allAnswers[response.id];

      return [response.id, responseAnswerIsCorrect(suppliedAnswer, configCorrectAnswer)];
    }));

    if (hasCorrectAnswerFeedback) {
      allResponsesWithDefaults.forEach((response) => {
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
            if (!allowFailedTraining && storageEngine) {
              storageEngine.rejectCurrentParticipant('Failed training')
                .then(() => {
                  setTimeout(() => {
                    navigate('./../__trainingFailed');
                  }, 5000);
                })
                .catch(() => {
                  console.error('Failed to reject participant who failed training');
                  setTimeout(() => {
                    navigate('./../__trainingFailed');
                  }, 5000);
                });
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
  }, [attemptsUsed, allResponsesWithDefaults, config, hasCorrectAnswerFeedback, trainingAttempts, allowFailedTraining, storageEngine, navigate, identifier, storeDispatch, alertConfig, saveIncorrectAnswer, trialValidation]);

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
    return () => {};
  }, [checkAnswerProvideFeedback, nextOnEnter]);

  const nextButtonText = useMemo(() => config?.nextButtonText ?? studyConfig.uiConfig.nextButtonText ?? 'Next', [config, studyConfig]);

  let index = 0;
  return (
    <>
      <Box className={`responseBlock responseBlock-${location}`} style={style}>
        {allResponsesWithDefaults.map((response) => {
          const configCorrectAnswer = config.correctAnswer?.find((answer) => answer.id === response.id)?.answer;
          const correctAnswer = Array.isArray(configCorrectAnswer) && configCorrectAnswer.length > 0 ? JSON.stringify(configCorrectAnswer) : configCorrectAnswer;
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
                        ...answerValidator.getInputProps(response.id, {
                          type: response.type === 'checkbox' ? 'checkbox' : 'input',
                        }),
                      }}
                      dontKnowCheckbox={{
                        ...answerValidator.getInputProps(`${response.id}-dontKnow`, { type: 'checkbox' }),
                      }}
                      otherInput={{
                        ...answerValidator.getInputProps(`${response.id}-other`),
                      }}
                      response={response}
                      index={index}
                      config={config}
                      disabled={disabledAttempts}
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
              ) : (
                <FeedbackAlert
                  response={response}
                  correctAnswer={correctAnswer}
                  alertConfig={alertConfig}
                  identifier={identifier}
                  attemptsUsed={attemptsUsed}
                  trainingAttempts={trainingAttempts}
                />
              )}
            </React.Fragment>
          );
        })}
      </Box>

      {showBtnsInLocation && (
      <NextButton
        disabled={(hasCorrectAnswerFeedback && !enableNextButton) || !answerValidator.isValid()}
        label={nextButtonText}
        config={config}
        location={location}
        checkAnswer={showBtnsInLocation && hasCorrectAnswerFeedback ? (
          <Button
            disabled={hasCorrectAnswer || (attemptsUsed >= trainingAttempts && trainingAttempts >= 0)}
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
