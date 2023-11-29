import { Button, Group, Text } from '@mantine/core';
import { useInputState } from '@mantine/hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  IndividualComponent,
  ResponseBlockLocation,
} from '../../parser/types';
import { useCurrentStep } from '../../routes';
import { useStoreDispatch, useAreResponsesValid, useStoreSelector, useStoreActions } from '../../store/store';
import { useNextStep } from '../../store/hooks/useNextStep';
import { deepCopy } from '../../utils/deepCopy';
import { NextButton } from '../NextButton';
import { useAnswerField } from '../stimuli/inputcomponents/utils';
import ResponseSwitcher from './ResponseSwitcher';
import React from 'react';
import { useStorageEngine } from '../../store/storageEngineHooks';
import { StoredAnswer, ValidationStatus } from '../../store/types';

type Props = {
  status: StoredAnswer;
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
  const { studyId = null } = useParams<{
    studyId: string;
  }>();
  const currentStep = useCurrentStep();
  const storedAnswer = status?.answer;

  const configInUse = (config) as IndividualComponent;

  const responses = configInUse?.response?.filter((r) =>
    r.location ? r.location === location : location === 'belowStimulus'
  ) || [];

  const storeDispatch = useStoreDispatch();
  const { saveTrialAnswer, updateResponseBlockValidation, setIframeAnswers } = useStoreActions();
  const answerValidator = useAnswerField(responses, currentStep, storedAnswer);
  const [disableNext, setDisableNext] = useInputState(!storedAnswer);
  const [checkClicked, setCheckClicked] = useState(false);
  const nextStep = useNextStep();
  const { iframeAnswers, trialValidation } = useStoreSelector((state) => state);
  const areResponsesValid = useAreResponsesValid(currentStep);

  const hasCorrectAnswer = ((configInUse?.correctAnswer?.length || 0) > 0);

  const startTime = useMemo(() => {
    return Date.now();
  }, []);

  const showNextBtn =
    location === (configInUse?.nextButtonLocation || 'belowStimulus');

  useEffect(() => {
    const iframeResponse = responses.find((r) => r.type === 'iframe');
    if (iframeResponse) {
      const answerId = `${currentStep}/${iframeResponse.id}`;
      answerValidator.setValues({...answerValidator.values, [answerId]: iframeAnswers});
    }
  }, [iframeAnswers]);



  useEffect(() => {
    if (storedAnswer) {
      answerValidator.setValues(storedAnswer);
    }
  }, [storedAnswer]);

  useEffect(() => {
    storeDispatch(
      updateResponseBlockValidation({
        location,
        currentStep,
        status: answerValidator.isValid(),
        values: deepCopy(answerValidator.values),
      })
    );
  }, [answerValidator.values, currentStep, location]);

  const { storageEngine } = useStorageEngine();

  const processNext = useCallback(() => {
    // Get answer from across the 3 response blocks and the provenance graph
    const trialValidationCopy = deepCopy(trialValidation[currentStep]);
    const answer = Object.values(trialValidationCopy).reduce((acc, curr) => {
      if (Object.hasOwn(curr, 'values')) {
        return {...acc, ...(curr as ValidationStatus).values};
      }
      return acc;
    }, {});
    const provenanceGraph = trialValidationCopy.provenanceGraph;
    const endTime = Date.now();

    if (Object.keys(storedAnswer || {}).length === 0) {
      storeDispatch(
        saveTrialAnswer({
          currentStep,
          answer,
          startTime,
          endTime,
          provenanceGraph,
        })
      );
      // Update database
      if (storageEngine) {
        storageEngine.saveAnswer(currentStep, { answer, startTime, endTime, provenanceGraph });
      }
      storeDispatch(setIframeAnswers([]));
    }

    setDisableNext(!disableNext);
  }, [
    answerValidator.values,
    storeDispatch,
    config?.type,
    currentStep,
    disableNext,
    saveTrialAnswer,
    status,
    setDisableNext,
  ]);

  return (
    <div style={style}>
      {responses.map((response) => (
        <React.Fragment key={`${response.id}-${currentStep}`}>
          {response.hidden ? (
            ''
          ) : (
            <>
              <ResponseSwitcher
                storedAnswer={ storedAnswer ? storedAnswer[`${currentStep}/${response.id}`] : undefined }
                answer={{
                  ...answerValidator.getInputProps(`${currentStep}/${response.id}`, {
                    type: response.type === 'checkbox' ? 'checkbox' : 'input',
                  }),
                }}
                response={response}
              />
              {hasCorrectAnswer && checkClicked && (
                <Text>The correct answer is: {configInUse.correctAnswer?.find((answer) => answer.id === response.id)?.answer}</Text>
              )}
            </>
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
            to={`/${studyId}/${nextStep}`}
            process={() => {
              setCheckClicked(false);
              processNext();
            }}
            label={configInUse.nextButtonText || 'Next'}
          />
        )}
      </Group>
    </div>
  );
}
