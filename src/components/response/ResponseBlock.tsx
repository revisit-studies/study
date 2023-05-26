import { Button, Group, Text } from '@mantine/core';
import { useInputState } from '@mantine/hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useNextTrialId } from '../../controllers/utils';
import {
  ContainerComponent,
  ResponseBlockLocation,
  StudyComponent,
} from '../../parser/types';
import { useCurrentStep } from '../../routes';
import { useAppDispatch, useStoreActions, useStudySelector } from '../../store';
import {
  updateResponseBlockValidation,
  useAggregateResponses,
  useAreResponsesValid,
  useFlagsDispatch,
} from '../../store/flags';
import { useNextStep } from '../../store/hooks/useNextStep';
import { TrialResult } from '../../store/types';
import { deepCopy } from '../../utils/deepCopy';
import { NextButton } from '../NextButton';
import { useAnswerField } from '../stimuli/inputcomponents/utils';
import ResponseSwitcher from './ResponseSwitcher';

type Props = {
  status: TrialResult | null;
  config: StudyComponent | ContainerComponent;
  location: ResponseBlockLocation;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
};

function useSavedSurvey() {
  const survey = useStudySelector().survey;
  return Object.keys(survey || {}).length > 0 ? survey : null;
}

export default function ResponseBlock({
  config,
  location,
  status = null,
}: Props) {
  const { trialId = null, studyId = null } = useParams<{
    trialId: string;
    studyId: string;
  }>();
  const id = useLocation().pathname;

  const storedAnswer = status?.answer;

  const responses = config?.response?.filter((r) =>
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
  const nextTrialId = useNextTrialId(trialId);
  const nextStep = useNextStep();

  const hasCorrectAnswer = trialId !== null ? (config as ContainerComponent)?.components[trialId]?.correctAnswer?.length || 0 > 0 : false;

  const startTime = useMemo(() => {
    return Date.now();
  }, [trialId]);

  const showNextBtn =
    location === (config?.nextButtonLocation || 'belowStimulus');

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

    if (!status?.complete) {
      appDispatch(
        saveTrialAnswer({
          trialName: currentStep,
          trialId: trialId || 'NoID',
          answer,
          type: config?.type,
          startTime,
          endTime: Date.now(),
        })
      );
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
    <div>
      {responses.map((response) => (
        <>
          <ResponseSwitcher
            key={`${response.id}-${id}`}
            status={status}
            storedAnswer={ null
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
            <Text>The correct answer is: {(config as ContainerComponent)?.components[trialId]?.correctAnswer.find((answer) => answer.id === response.id).answer}</Text>
          )}
        </>
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
            to={
              nextTrialId
                ? `/${studyId}/${currentStep}/${nextTrialId}`
                : `/${studyId}/${nextStep}`
            }
            process={() => {setCheckClicked(false); processNext();}}
            label={config?.nextButtonText || 'Next'}
          />
        )}
      </Group>
    </div>
  );
}
