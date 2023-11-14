import { Button, Group, Text } from '@mantine/core';
import { useInputState } from '@mantine/hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import {
  IndividualComponent,
  ResponseBlockLocation,
} from '../../parser/types';
import { useCurrentStep } from '../../routes';
import { useStoreDispatch, useTrrackedActions, useAreResponsesValid, useAggregateResponses, useStoreSelector, useUntrrackedActions } from '../../store/store';
import { useNextStep } from '../../store/hooks/useNextStep';
import { TrialResult, TrrackedAnswer } from '../../store/types';
import { deepCopy } from '../../utils/deepCopy';
import { NextButton } from '../NextButton';
import { useAnswerField } from '../stimuli/inputcomponents/utils';
import ResponseSwitcher from './ResponseSwitcher';
import React from 'react';
import { useStorageEngine } from '../../store/contexts/storage';

type Props = {
  status: TrialResult | null;
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
  const { trialId = null, studyId = null } = useParams<{
    trialId: string;
    studyId: string;
  }>();
  const id = useLocation().pathname;
  const storedAnswer = status?.answer;

  const configInUse = (config) as IndividualComponent;

  const responses = configInUse?.response?.filter((r) =>
    r.location ? r.location === location : location === 'belowStimulus'
  ) || [];

  const { saveTrialAnswer } = useTrrackedActions();
  const storeDispatch = useStoreDispatch();
  const answerValidator = useAnswerField(responses, id, storedAnswer as TrrackedAnswer);
  const areResponsesValid = useAreResponsesValid(id);
  const aggregateResponses = useAggregateResponses(id);
  const [disableNext, setDisableNext] = useInputState(!storedAnswer);
  const [checkClicked, setCheckClicked] = useState(false);
  const currentStep = useCurrentStep();
  const nextStep = useNextStep();
  const storeSelector = useStoreSelector((state) => state);

  const hasCorrectAnswer = ((configInUse?.correctAnswer?.length || 0) > 0);

  const startTime = useMemo(() => {
    return Date.now();
  }, []);

  const showNextBtn =
    location === (configInUse?.nextButtonLocation || 'belowStimulus');

  useEffect(() => {
    const iframeResponse = responses.find((r) => r.type === 'iframe');
    if (iframeResponse) {
      const answerId = `${id}/${iframeResponse.id}`;
      answerValidator.setValues({...answerValidator.values, [answerId]: storeSelector.unTrrackedSlice.iframeAnswers});
    }
  }, [storeSelector.unTrrackedSlice.iframeAnswers]);

  const unTrrackedActions = useUntrrackedActions();

  useEffect(() => {
    if (storedAnswer) {
      answerValidator.setValues(storedAnswer);
    }
  }, [storedAnswer]);

  useEffect(() => {
    console.log('here');
    storeDispatch(
      unTrrackedActions.updateResponseBlockValidation({
        location,
        trialId: id,
        status: answerValidator.isValid(),
        answers: deepCopy(answerValidator.values),
      })
    );
    console.log(location, answerValidator.isValid(), answerValidator.values, storedAnswer);
  }, [answerValidator.values,]);

  const { storageEngine } = useStorageEngine();

  const processNext = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const answer = deepCopy(aggregateResponses!);

    const graph = storeSelector.unTrrackedSlice.trialRecord[id].provenanceGraph;

    if (!storedAnswer) {
      storeDispatch(
        saveTrialAnswer({
          trialName: currentStep,
          trialId: trialId || 'NoID',
          answer,
          provenanceGraph: graph || undefined,
          startTime,
          endTime: Date.now(),
        })
      );
      storeDispatch(unTrrackedActions.setIframeAnswers([]));

      // Update database
      if (storageEngine) {
        storageEngine.saveAnswer(currentStep, answer);
      }
    }

    setDisableNext(!disableNext);
  }, [
    aggregateResponses,
    answerValidator.values,
    storeDispatch,
    config?.type,
    currentStep,
    disableNext,
    saveTrialAnswer,
    status,
    setDisableNext,
    trialId,
  ]);

  return (
    <div style={style}>
      {responses.map((response) => (
        <React.Fragment key={`${response.id}-${id}`}>
          <ResponseSwitcher
            status={status}
            storedAnswer={ response.type === 'iframe' ? (aggregateResponses || {})[`${id}/${response.id}`]
              : (storedAnswer as any)[`${id}/${response.id}`]
            }
            answer={{
              ...answerValidator.getInputProps(`${id}/${response.id}`, {
                type: response.type === 'checkbox' ? 'checkbox' : 'input',
              }),
            }}
            response={response}
          />
          {hasCorrectAnswer && checkClicked && (
            <Text>The correct answer is: {configInUse.correctAnswer?.find((answer) => answer.id === response.id)?.answer}</Text>
          )}
        </React.Fragment>
      ))}

      <Group position="right" spacing="xs" mt="xl">
        {hasCorrectAnswer && showNextBtn && (
          <Button
            onClick={() => setCheckClicked(true)}
            disabled={!answerValidator.isValid()}
          >
            Check Answer
          </Button>
        )}
        {showNextBtn && (
          <NextButton
            disabled={
              hasCorrectAnswer
                ? !checkClicked
                : !areResponsesValid
            }
            to={
                `/${studyId}/${nextStep}`
            }
            process={() => {setCheckClicked(false); processNext();}}
            label={configInUse.nextButtonText || 'Next'}
          />
        )}
      </Group>
    </div>
  );
}
