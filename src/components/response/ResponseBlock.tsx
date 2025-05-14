import {
  Alert, Anchor, Button, Group,
} from '@mantine/core';

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Registry, initializeTrrack } from '@trrack/core';
import {
  IndividualComponent,
  ResponseBlockLocation,
} from '../../parser/types';
import { useCurrentIdentifier, useCurrentStep, useStudyId } from '../../routes/utils';
import {
  useStoreDispatch, useStoreSelector, useStoreActions,
} from '../../store/store';

import { NextButton } from '../NextButton';
import { useAnswerField } from './utils';
import { ResponseSwitcher } from './ResponseSwitcher';
import { FormElementProvenance, StoredAnswer } from '../../store/types';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';

type Props = {
  status?: StoredAnswer;
  config: IndividualComponent | null;
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
    updateResponseBlockValidation, toggleShowHelpText, saveIncorrectAnswer, incrementHelpCounter,
  } = useStoreActions();
  const currentStep = useCurrentStep();
  const currentProvenance = useStoreSelector((state) => state.analysisProvState[location]) as FormElementProvenance | undefined;

  const storedAnswer = useMemo(() => currentProvenance?.form || status?.answer, [currentProvenance, status]);

  const studyId = useStudyId();

  const navigate = useNavigate();

  const configInUse = config as IndividualComponent;

  const responses = useMemo(() => configInUse?.response?.filter((r) => (r.location ? r.location === location : location === 'belowStimulus')) || [], [configInUse?.response, location]);

  const responsesWithDefaults = useMemo(() => responses.map((response) => {
    if (response.type !== 'textOnly') {
      return {
        ...response,
        required: response.required === undefined ? true : response.required,
      };
    }
    return response;
  }), [responses]);

  const answerValidator = useAnswerField(responsesWithDefaults, currentStep, storedAnswer || {});
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

  const hasCorrectAnswerFeedback = configInUse?.provideFeedback && ((configInUse?.correctAnswer?.length || 0) > 0);
  const allowFailedTraining = configInUse?.allowFailedTraining === undefined ? true : configInUse.allowFailedTraining;
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const trainingAttempts = configInUse?.trainingAttempts || 2;
  const [enableNextButton, setEnableNextButton] = useState(false);

  const identifier = useCurrentIdentifier();
  const studyConfig = useStudyConfig();

  const showNextBtn = location === (configInUse?.nextButtonLocation !== undefined ? configInUse.nextButtonLocation : studyConfig.uiConfig.nextButtonLocation || 'belowStimulus');
  const nextBtnText = configInUse?.nextButtonText !== undefined ? configInUse.nextButtonText : studyConfig.uiConfig.nextButtonText || 'Next';

  useEffect(() => {
    const ReactiveResponse = responsesWithDefaults.find((r) => r.type === 'reactive');
    if (reactiveAnswers && ReactiveResponse) {
      const answerId = ReactiveResponse.id;
      answerValidator.setValues({ ...answerValidator.values, [answerId]: reactiveAnswers[answerId] as string[] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reactiveAnswers]);

  useEffect(() => {
    // Checks if there are any matrix responses.
    const matrixResponse = responsesWithDefaults.filter((r) => r.type === 'matrix-radio' || r.type === 'matrix-checkbox');
    if (matrixAnswers && matrixResponse.length > 0) {
      // Create blank object with current values
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
      // update answerValidator
      answerValidator.setValues(updatedValues);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matrixAnswers]);

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
  const [alertConfig, setAlertConfig] = useState(Object.fromEntries(responsesWithDefaults.map((response) => ([response.id, {
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
  const checkAnswerProvideFeedback = () => {
    const newAttemptsUsed = attemptsUsed + 1;
    setAttemptsUsed(newAttemptsUsed);

    const correctAnswers = Object.fromEntries(responsesWithDefaults.map((response) => {
      const configCorrectAnswer = configInUse.correctAnswer?.find((answer) => answer.id === response.id)?.answer;
      const suppliedAnswer = (answerValidator.values as Record<string, unknown>)[response.id];

      return [response.id, Array.isArray(suppliedAnswer)
        ? (
          typeof configCorrectAnswer === 'string'
            ? (suppliedAnswer.length === 1 && configCorrectAnswer === suppliedAnswer[0])
            : (suppliedAnswer.length === configCorrectAnswer.length && suppliedAnswer.every((answer) => configCorrectAnswer.includes(answer)))
        )
        : configCorrectAnswer === suppliedAnswer];
    }));

    if (hasCorrectAnswerFeedback) {
      responsesWithDefaults.forEach((response) => {
        if (correctAnswers[response.id] && !alertConfig[response.id]?.message.includes('You\'ve failed to answer this question correctly')) {
          updateAlertConfig(response.id, true, 'Correct Answer', 'You have answered the question correctly.', 'green');
        } else {
          storeDispatch(saveIncorrectAnswer({ question: identifier, identifier: response.id, answer: (answerValidator.values as Record<string, unknown>)[response.id] }));
          let message = '';
          if (trainingAttempts === -1) {
            message = 'Please try again.';
          } else if (newAttemptsUsed >= trainingAttempts) {
            message = `You didn't answer this question correctly after ${trainingAttempts} attempts. ${allowFailedTraining ? 'You can continue to the next question.' : 'Unfortunately you have not met the criteria for continuing this study.'}`;

            // If the user has failed the training, wait 5 seconds and redirect to a fail page
            if (!allowFailedTraining && storageEngine) {
              storageEngine.rejectCurrentParticipant(studyId, 'Failed training')
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
            const correct = configInUse.correctAnswer?.find((answer) => answer.id === response.id)?.answer;

            const suppliedAnswer = (answerValidator.values as Record<string, unknown>)[response.id] as string[];
            const matches = findMatchingStrings(suppliedAnswer, correct);

            const tooManySelected = correct.length === matches.length && suppliedAnswer.length > correct.length ? 'However, you have selected too many boxes. ' : '';

            message = `You have successfully checked ${matches.length}/${correct.length} correct boxes. ${tooManySelected}${message}`;
          }
          updateAlertConfig(response.id, true, 'Incorrect Answer', message, 'red');
        }
      });

      setEnableNextButton(
        (
          allowFailedTraining && newAttemptsUsed >= trainingAttempts
        ) || (
          Object.values(correctAnswers).every((isCorrect) => isCorrect)
          && newAttemptsUsed <= trainingAttempts
        ),
      );
    }
  };

  let index = 0;
  return (
    <div style={style}>
      {responsesWithDefaults.map((response) => {
        const configCorrectAnswer = configInUse.correctAnswer?.find((answer) => answer.id === response.id)?.answer;

        // Increment index for each response, unless it is a textOnly response
        if (response.type !== 'textOnly') {
          index += 1;
        } else if (response.restartEnumeration) {
          index = 0;
        }

        return (
          <React.Fragment key={`${response.id}-${currentStep}`}>
            {response.hidden ? (
              ''
            ) : (
              <>
                <ResponseSwitcher
                  storedAnswer={storedAnswer}
                  answer={{
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
                  configInUse={configInUse}
                />
                {alertConfig[response.id]?.visible && (
                  <Alert mb="md" title={alertConfig[response.id].title} color={alertConfig[response.id].color}>
                    {alertConfig[response.id].message}
                    {alertConfig[response.id].message.includes('Please try again') && (
                      <>
                        <br />
                        <br />
                        If you&apos;re unsure
                        {' '}
                        <Anchor style={{ fontSize: 14 }} onClick={() => { storeDispatch(toggleShowHelpText()); storeDispatch(incrementHelpCounter({ identifier })); }}>review the help text.</Anchor>
                        {' '}
                      </>
                    )}
                    <br />
                    <br />
                    {attemptsUsed >= trainingAttempts && trainingAttempts >= 0 && configCorrectAnswer && ` The correct answer was: ${configCorrectAnswer}.`}
                  </Alert>
                )}
              </>
            )}
          </React.Fragment>
        );
      })}

      <Group justify="right" gap="xs">
        {hasCorrectAnswerFeedback && showNextBtn && (
          <Button
            onClick={() => checkAnswerProvideFeedback()}
            disabled={!answerValidator.isValid() || (attemptsUsed >= trainingAttempts && trainingAttempts >= 0)}
          >
            Check Answer
          </Button>
        )}
        {showNextBtn && (
          <NextButton
            disabled={(hasCorrectAnswerFeedback && !enableNextButton) || !answerValidator.isValid()}
            label={nextBtnText}
            configInUse={configInUse}
          />
        )}
      </Group>
    </div>
  );
}
