import { Button, Group, Text } from '@mantine/core';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { IndividualComponent, ResponseBlockLocation } from '../../parser/types';
import {
  updateResponseBlockValidation,
  useAggregateResponses,
  useFlagsDispatch,
  useFlagsSelector,
} from '../../store/flags';

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

export default function ResponseBlock({
  config,
  location,
  status = null,
  style,
}: Props) {
  const id = useLocation().pathname;

  const configInUse = config as IndividualComponent;

  const responses =
    configInUse?.response?.filter((r) =>
      r.location ? r.location === location : location === 'belowStimulus'
    ) || [];

  const flagDispatch = useFlagsDispatch();
  const answerValidator = useAnswerField(responses, id);
  const aggregateResponses = useAggregateResponses(id);
  const [checkClicked, setCheckClicked] = useState(false);
  const flagsSelector = useFlagsSelector((state) => state);

  const hasCorrectAnswer = (configInUse?.correctAnswer?.length || 0) > 0;

  const showNextBtn =
    location === (configInUse?.nextButtonLocation || 'belowStimulus');

  useEffect(() => {
    const iframeResponse = responses.find((r) => r.type === 'iframe');
    if (iframeResponse) {
      const answerId = `${id}/${iframeResponse.id}`;
      answerValidator.setValues({
        ...answerValidator.values,
        [answerId]: flagsSelector.iframeAnswers,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            disabled={hasCorrectAnswer && !checkClicked}
            onClick={() => {
              setCheckClicked(false);
            }}
            label={configInUse.nextButtonText || 'Next'}
          />
        )}
      </Group>
    </div>
  );
}
