import { Button, Group, Text } from '@mantine/core';
import { useInputState } from '@mantine/hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import {
  IndividualComponent,
  ResponseBlockLocation,
} from '../../parser/types';
import { useCurrentStep } from '../../routes';
import { useAppDispatch, useStoreActions, useStudySelector } from '../../store/store';
import {
  setIframeAnswers,
  updateResponseBlockValidation,
  useAggregateResponses,
  useAreResponsesValid,
  useFlagsDispatch,
  useFlagsSelector,
} from '../../store/flags';
import { useNextStep } from '../../store/hooks/useNextStep';
import { TrialResult } from '../../store/types';
import { deepCopy } from '../../utils/deepCopy';
import { NextButton } from '../NextButton';
import { useAnswerField } from '../stimuli/inputcomponents/utils';
import ResponseSwitcher from './ResponseSwitcher';
import React from 'react';

type Props = {
  status: TrialResult | null;
  config: IndividualComponent | null;
  location: ResponseBlockLocation;
  style?: React.CSSProperties;
};

function useSavedSurvey() {
  const survey = useStudySelector().survey;
  return Object.keys(survey || {}).length > 0 ? survey : null;
}

export default function ResponseBlock({
  config,
  location,
  status = null,
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
  const savedSurvey = useSavedSurvey();

  const { saveTrialAnswer } = useStoreActions();
  const appDispatch = useAppDispatch();
  const flagDispatch = useFlagsDispatch();
  const answerValidator = useAnswerField(responses, id);
  const areResponsesValid = useAreResponsesValid(id);
  const aggregateResponses = useAggregateResponses(id);
  const [disableNext, setDisableNext] = useInputState(!storedAnswer);
  const [checkClicked, setCheckClicked] = useState(false);
  const currentStep = useCurrentStep();
  const nextStep = useNextStep();
  const flagsSelector = useFlagsSelector((state) => state);

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
      answerValidator.setValues({...answerValidator.values, [answerId]: flagsSelector.iframeAnswers});
    }
  }, [flagsSelector.iframeAnswers]);


  useEffect(() => {
    flagDispatch(
      updateResponseBlockValidation({
        location,
        trialId: id,
        status: answerValidator.isValid(),
        answers: deepCopy(answerValidator.values),
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerValidator.values, id]);

  const processNext = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const answer = deepCopy(aggregateResponses!);

    const root = flagsSelector.trialRecord[id].provenanceRoot;

    if (!status?.complete) {
      appDispatch(
        saveTrialAnswer({
          trialName: currentStep,
          trialId: id || 'NoID',
          answer,
          provenanceRoot: root || undefined,
          startTime,
          endTime: Date.now(),
        })
      );
      flagDispatch(setIframeAnswers([]));
    }

    setDisableNext(!disableNext);
  }, [
    aggregateResponses,
    answerValidator.values,
    appDispatch,
    savedSurvey,
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
          {response.hidden ? (
            ''
          ) : (
            <>
              <ResponseSwitcher
                status={status}
                storedAnswer={
                  response.type === 'iframe'
                    ? (aggregateResponses || {})[`${id}/${response.id}`]
                    : null
                  // isSurvey
                  //   ? savedSurvey
                  //     ? (savedSurvey as any)[`${id}/${response.id}`]
                  //     : null
                  //   : storedAnswer
                  //   ? (storedAnswer as any)[`${id}/${response.id}`]
                  //   : response.type === 'iframe'
                  //   ? (aggregateResponses || {})[`${id}/${response.id}`]
                  //   : null
                }
                answer={{
                  ...answerValidator.getInputProps(`${id}/${response.id}`, {
                    type: response.type === 'checkbox' ? 'checkbox' : 'input',
                  }),
                }}
                response={response}
              />
              {hasCorrectAnswer && checkClicked && (
                <Text>
                  The correct answer is:{' '}
                  {
                    configInUse.correctAnswer?.find(
                      (answer) => answer.id === response.id
                    )?.answer
                  }
                </Text>
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
                : !status?.complete && !areResponsesValid
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
