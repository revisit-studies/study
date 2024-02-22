import { Button, Group, Text } from '@mantine/core';

import React, { useEffect, useState } from 'react';
import {
  IndividualComponent,
  ResponseBlockLocation,
} from '../../parser/types';
import { useCurrentStep } from '../../routes/utils';
import { useStoreDispatch, useStoreSelector, useStoreActions } from '../../store/store';

import { deepCopy } from '../../utils/deepCopy';
import { NextButton } from '../NextButton';
import { useAnswerField } from './utils';
import ResponseSwitcher from './ResponseSwitcher';
import { StoredAnswer } from '../../store/types';

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
  const currentStep = useCurrentStep();
  const currentComponent = useStoreSelector((state) => state.sequence[currentStep]);
  const storedAnswer = status?.answer;

  const configInUse = config as IndividualComponent;

  const responses = configInUse?.response?.filter((r) => (r.location ? r.location === location : location === 'belowStimulus')) || [];

  const storeDispatch = useStoreDispatch();
  const { updateResponseBlockValidation } = useStoreActions();
  const answerValidator = useAnswerField(responses, currentComponent, storedAnswer || {});
  const [checkClicked, setCheckClicked] = useState(false);
  const { iframeAnswers } = useStoreSelector((state) => state);
  const hasCorrectAnswer = ((configInUse?.correctAnswer?.length || 0) > 0);

  const showNextBtn = location === (configInUse?.nextButtonLocation || 'belowStimulus');

  useEffect(() => {
    const iframeResponse = responses.find((r) => r.type === 'iframe');
    if (iframeResponse) {
      const answerId = iframeResponse.id;
      answerValidator.setValues({ ...answerValidator.values, [answerId]: iframeAnswers });
    }
  }, [iframeAnswers]);

  useEffect(() => {
    storeDispatch(
      updateResponseBlockValidation({
        location,
        currentStep: currentComponent,
        status: answerValidator.isValid(),
        values: deepCopy(answerValidator.values),
      }),
    );
  }, [answerValidator.values, currentStep, location]);

  return (
    <div style={style}>
      {responses.map((response) => (
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
              />
              {hasCorrectAnswer && checkClicked && (
                <Text>
                  {`The correct answer is: ${configInUse.correctAnswer?.find((answer) => answer.id === response.id)?.answer}`}
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
            setCheckClicked={setCheckClicked}
            label={configInUse.nextButtonText || 'Next'}
          />
        )}
      </Group>
    </div>
  );
}
