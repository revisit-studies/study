/* eslint-disable no-nested-ternary */
import {
  Alert, Anchor, Button, Group,
} from '@mantine/core';

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IndividualComponent,
  ResponseBlockLocation,
} from '../../parser/types';
import { useCurrentComponent, useCurrentStep, useStudyId } from '../../routes/utils';
import {
  useStoreDispatch, useStoreSelector, useStoreActions,
} from '../../store/store';

import { deepCopy } from '../../utils/deepCopy';
import { NextButton } from '../NextButton';
import { useAnswerField } from './utils';
import ResponseSwitcher from './ResponseSwitcher';
import { StoredAnswer, TrrackedProvenance } from '../../store/types';
import { useStorageEngine } from '../../storage/storageEngineHooks';

type Props = {
  status?: StoredAnswer;
  config: IndividualComponent | null;
  location: ResponseBlockLocation;
  style?: React.CSSProperties;
};

export default function ResponseBlock({
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
  const currentComponent = useCurrentComponent();
  const storedAnswer = status?.answer;

  const studyId = useStudyId();

  const navigate = useNavigate();

  const configInUse = config as IndividualComponent;

  const responses = useMemo(() => configInUse?.response?.filter((r) => (r.location ? r.location === location : location === 'belowStimulus')) || [], [configInUse?.response, location]);
  const responsesWithDefaults = useMemo(() => responses.map((response) => ({
    ...response,
    required: response.required === undefined ? true : response.required,
  })), [responses]);

  const answerValidator = useAnswerField(responsesWithDefaults, currentStep, storedAnswer || {});
  const [provenanceGraph, setProvenanceGraph] = useState<TrrackedProvenance | undefined>(undefined);
  const iframeAnswers = useStoreSelector((state) => state.iframeAnswers);
  const iframeProvenance = useStoreSelector((state) => state.iframeProvenance);
  const matrixAnswers = useStoreSelector((state) => state.matrixAnswers);

  const hasCorrectAnswerFeedback = configInUse?.provideFeedback && ((configInUse?.correctAnswer?.length || 0) > 0);
  const allowFailedTraining = configInUse?.allowFailedTraining === undefined ? true : configInUse.allowFailedTraining;
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const trainingAttempts = configInUse?.trainingAttempts || 2;
  const [enableNextButton, setEnableNextButton] = useState(false);

  const showNextBtn = location === (configInUse?.nextButtonLocation || 'belowStimulus');

  useEffect(() => {
    const iframeResponse = responsesWithDefaults.find((r) => r.type === 'iframe');
    if (iframeAnswers && iframeResponse) {
      const answerId = iframeResponse.id;
      answerValidator.setValues({ ...answerValidator.values, [answerId]: iframeAnswers[answerId] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iframeAnswers]);

  useEffect(() => {
    if (iframeProvenance) {
      setProvenanceGraph(iframeProvenance);
    }
  }, [iframeProvenance]);

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
    storeDispatch(
      updateResponseBlockValidation({
        location,
        identifier: `${currentComponent}_${currentStep}`,
        status: answerValidator.isValid(),
        values: deepCopy(answerValidator.values),
        provenanceGraph,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerValidator.values, currentComponent, currentStep, location, storeDispatch, updateResponseBlockValidation, provenanceGraph]);
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
          storeDispatch(saveIncorrectAnswer({ question: `${currentComponent}_${currentStep}`, identifier: response.id, answer: (answerValidator.values as Record<string, unknown>)[response.id] }));
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
                    navigate('./__trainingFailed');
                  }, 5000);
                })
                .catch(() => {
                  console.error('Failed to reject participant who failed training');
                  setTimeout(() => {
                    navigate('./__trainingFailed');
                  }, 5000);
                });
            }
          } else if (trainingAttempts - newAttemptsUsed === 1) {
            message = 'Please try again. You have 1 attempt left.';
          } else {
            message = `Please try again. You have ${trainingAttempts - newAttemptsUsed} attempts left.`;
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

  return (
    <div style={style}>
      {responsesWithDefaults.map((response, index) => {
        const configCorrectAnswer = configInUse.correctAnswer?.find((answer) => answer.id === response.id)?.answer;

        return (
          <React.Fragment key={`${response.id}-${currentStep}`}>
            {response.hidden ? (
              ''
            ) : (
              <>
                <ResponseSwitcher
                  storedAnswer={storedAnswer ? storedAnswer[response.id] : undefined}
                  answer={{
                    ...answerValidator.getInputProps(response.id, {
                      type: response.type === 'checkbox' ? 'checkbox' : 'input',
                    }),
                  }}
                  response={response}
                  index={index + 1}
                />
                {alertConfig[response.id].visible && (
                  <Alert mb="md" title={alertConfig[response.id].title} color={alertConfig[response.id].color}>
                    {alertConfig[response.id].message}
                    {' '}
                    {alertConfig[response.id].message.includes('Please try again') && (
                      <>
                        <br />
                        <br />
                        If you&apos;re unsure
                        {' '}
                        <Anchor style={{ fontSize: 14 }} onClick={() => { storeDispatch(toggleShowHelpText()); storeDispatch(incrementHelpCounter({ identifier: `${currentComponent}_${currentStep}` })); }}>review the help text.</Anchor>
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
            label={configInUse.nextButtonText || 'Next'}
            configInUse={configInUse}
          />
        )}
      </Group>
    </div>
  );
}
