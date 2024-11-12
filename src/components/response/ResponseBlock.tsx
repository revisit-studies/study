/* eslint-disable no-nested-ternary */
import {
  Alert, Anchor, Button, Group,
} from '@mantine/core';

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
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
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { useNextStep } from '../../store/hooks/useNextStep';

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
  const { updateResponseBlockValidation, toggleShowHelpText } = useStoreActions();
  const currentStep = useCurrentStep();
  const currentComponent = useCurrentComponent();
  const storedAnswer = status?.answer;

  const studyId = useStudyId();
  const studyConfig = useStudyConfig();

  const navigate = useNavigate();

  const configInUse = config as IndividualComponent;

  const responses = useMemo(() => configInUse?.response?.filter((r) => (r.location ? r.location === location : location === 'belowStimulus')) || [], [configInUse?.response, location]);

  const answerValidator = useAnswerField(responses, currentStep, storedAnswer || {});
  const [provenanceGraph, setProvenanceGraph] = useState<TrrackedProvenance | undefined>(undefined);
  const iframeAnswers = useStoreSelector((state) => state.iframeAnswers);
  const iframeProvenance = useStoreSelector((state) => state.iframeProvenance);

  const hasCorrectAnswerFeedback = configInUse?.provideFeedback && ((configInUse?.correctAnswer?.length || 0) > 0);
  const allowFailedTraining = configInUse?.allowFailedTraining === undefined ? true : configInUse.allowFailedTraining;
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const trainingAttempts = configInUse?.trainingAttempts || 2;
  const [enableNextButton, setEnableNextButton] = useState(false);

  const showNextBtn = location === (configInUse?.nextButtonLocation || 'belowStimulus');

  const nextButtonDisableTime = configInUse?.nextButtonDisableTime;
  const nextButtonEnableTime = configInUse?.nextButtonEnableTime || 0;
  const [timer, setTimer] = useState<number | undefined>(undefined);
  // Start a timer on first render, update timer every 100ms
  useEffect(() => {
    let time = 0;
    const interval = setInterval(() => {
      time += 100;
      setTimer(time);
    }, 500);
    return () => {
      clearInterval(interval);
    };
  }, []);
  useEffect(() => {
    if (timer && nextButtonDisableTime && timer >= nextButtonDisableTime && studyConfig.uiConfig.timeoutReject) {
      navigate('./__timeout');
    }
  }, [nextButtonDisableTime, timer, navigate, studyConfig.uiConfig.timeoutReject]);

  useEffect(() => {
    const iframeResponse = responses.find((r) => r.type === 'iframe');
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
  const [alertConfig, setAlertConfig] = useState(Object.fromEntries(responses.map((response) => ([response.id, {
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

    const correctAnswers = Object.fromEntries(responses.map((response) => {
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
      responses.forEach((response) => {
        if (correctAnswers[response.id] && !alertConfig[response.id]?.message.includes('You\'ve failed to answer this question correctly')) {
          updateAlertConfig(response.id, true, 'Correct Answer', 'You have answered the question correctly.', 'green');
        } else {
          let message = '';
          if (newAttemptsUsed >= trainingAttempts) {
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

  const buttonTimerSatisfied = useMemo(
    () => {
      const nextButtonDisableSatisfied = nextButtonDisableTime && timer ? timer <= nextButtonDisableTime : true;
      const nextButtonEnableSatisfied = timer ? timer >= nextButtonEnableTime : true;
      return nextButtonDisableSatisfied && nextButtonEnableSatisfied;
    },
    [nextButtonDisableTime, nextButtonEnableTime, timer],
  );

  const { goToNextStep } = useNextStep();

  return (
    <div style={style}>
      {responses.map((response, index) => {
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
                        Please
                        {' '}
                        <Anchor style={{ fontSize: 14 }} onClick={() => storeDispatch(toggleShowHelpText())}>click here</Anchor>
                        {' '}
                        and read the help text carefully.
                      </>
                      )}
                    <br />
                    <br />
                    {attemptsUsed >= trainingAttempts && configCorrectAnswer && ` The correct answer was: ${configCorrectAnswer}.`}
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
            disabled={!answerValidator.isValid() || attemptsUsed >= trainingAttempts}
          >
            Check Answer
          </Button>
        )}
        {showNextBtn && (
          <NextButton
            disabled={(hasCorrectAnswerFeedback && !enableNextButton) || !answerValidator.isValid() || !buttonTimerSatisfied}
            label={configInUse.nextButtonText || 'Next'}
          />
        )}
      </Group>
      {showNextBtn && nextButtonEnableTime > 0 && timer && timer < nextButtonEnableTime && (
      <Alert mt="md" title="Please wait" color="blue" icon={<IconInfoCircle />}>
        The next button will be enabled in
        {' '}
        {Math.ceil((nextButtonEnableTime - timer) / 1000)}
        {' '}
        seconds.
      </Alert>
      )}
      {showNextBtn && nextButtonDisableTime && timer && (nextButtonDisableTime - timer) < 10000 && (
        (nextButtonDisableTime - timer) > 0
          ? (
            <Alert mt="md" title="Next button disables soon" color="yellow" icon={<IconAlertTriangle />}>
              The next button disables in
              {' '}
              {Math.ceil((nextButtonDisableTime - timer) / 1000)}
              {' '}
              seconds.
            </Alert>
          ) : !studyConfig.uiConfig.timeoutReject && (
            <Alert mt="md" title="Next button disabled" color="red" icon={<IconAlertTriangle />}>
              The next button has timed out and is now disabled.
              <Group justify="right" mt="sm">
                <Button onClick={() => goToNextStep(false)} variant="link" color="red">Proceed</Button>
              </Group>
            </Alert>
          ))}
    </div>
  );
}
