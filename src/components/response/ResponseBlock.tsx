import { Alert, Button, Group } from '@mantine/core';

import React, { useEffect, useMemo, useState } from 'react';
import {
  IndividualComponent,
  ResponseBlockLocation,
} from '../../parser/types';
import { useCurrentComponent, useCurrentStep } from '../../routes/utils';
import {
  useStoreDispatch, useStoreSelector, useStoreActions,
} from '../../store/store';

import { deepCopy } from '../../utils/deepCopy';
import { NextButton } from '../NextButton';
import { useAnswerField } from './utils';
import ResponseSwitcher from './ResponseSwitcher';
import { StoredAnswer, TrrackedProvenance } from '../../store/types';

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
  const currentComponent = useCurrentComponent();
  const storedAnswer = status?.answer;

  const configInUse = config as IndividualComponent;

  const responses = useMemo(() => configInUse?.response?.filter((r) => (r.location ? r.location === location : location === 'belowStimulus')) || [], [configInUse?.response, location]);

  const storeDispatch = useStoreDispatch();
  const { updateResponseBlockValidation } = useStoreActions();
  const answerValidator = useAnswerField(responses, currentStep, storedAnswer || {});
  const [provenanceGraph, setProvenanceGraph] = useState<TrrackedProvenance | undefined>(undefined);
  const [checkClicked, setCheckClicked] = useState(false);
  const { iframeAnswers, iframeProvenance } = useStoreSelector((state) => state);
  const hasCorrectAnswerFeedback = configInUse?.provideFeedback && ((configInUse?.correctAnswer?.length || 0) > 0);

  const showNextBtn = location === (configInUse?.nextButtonLocation || 'belowStimulus');

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

  return (
    <div style={style}>
      {responses.map((response, index) => (
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
              {hasCorrectAnswerFeedback && checkClicked && (
                <Alert mb="md" title="Correct Answer">
                  {`The correct answer is: ${configInUse.correctAnswer?.find((answer) => answer.id === response.id)?.answer}`}
                </Alert>
              )}
            </>
          )}
        </React.Fragment>
      ))}

      <Group justify="right" gap="xs">
        {hasCorrectAnswerFeedback && showNextBtn && (
          <Button
            onClick={() => setCheckClicked(true)}
            disabled={!answerValidator.isValid()}
          >
            Check Answer
          </Button>
        )}
        {showNextBtn && (
          <NextButton
            disabled={hasCorrectAnswerFeedback && !checkClicked}
            setCheckClicked={setCheckClicked}
            label={configInUse.nextButtonText || 'Next'}
          />
        )}
      </Group>
    </div>
  );
}
