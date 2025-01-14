import { Box, Divider } from '@mantine/core';
import { useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import { IndividualComponent, Response } from '../../parser/types';
import { CheckBoxInput } from './CheckBoxInput';
import { DropdownInput } from './DropdownInput';
import { IframeInput } from './IframeInput';
import { LikertInput } from './LikertInput';
import { NumericInput } from './NumericInput';
import { RadioInput } from './RadioInput';
import { SliderInput } from './SliderInput';
import { StringInput } from './StringInput';
import { TextAreaInput } from './TextAreaInput';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { MatrixInput } from './MatrixInput';

export function ResponseSwitcher({
  response,
  answer,
  storedAnswer,
  index,
  configInUse,
}: {
  response: Response;
  answer: { value?: object };
  storedAnswer?: Record<string, unknown>;
  index: number;
  configInUse: IndividualComponent;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ans: { value?: any } = (storedAnswer ? { value: storedAnswer } : answer) || { value: undefined };
  const disabled = !!storedAnswer;

  const [searchParams] = useSearchParams();

  const studyConfig = useStudyConfig();
  const enumerateQuestions = studyConfig.uiConfig.enumerateQuestions ?? false;

  const isDisabled = useMemo(() => {
    if (response.paramCapture) {
      const responseParam = searchParams.get(response.paramCapture);
      return disabled || !!responseParam;
    }

    return disabled;
  }, [disabled, response.paramCapture, searchParams]);

  return (
    <Box mb={response.withDivider || configInUse.responseDividers ? 'xl' : 'lg'}>
      {response.type === 'numerical' && (
        <NumericInput
          response={response}
          disabled={isDisabled}
          answer={ans}
          index={index}
          enumerateQuestions={enumerateQuestions}
        />
      )}
      {response.type === 'shortText' && (
        <StringInput
          response={response}
          disabled={isDisabled}
          answer={ans}
          index={index}
          enumerateQuestions={enumerateQuestions}
        />
      )}
      {response.type === 'longText' && (
        <TextAreaInput
          response={response}
          disabled={isDisabled}
          answer={ans}
          index={index}
          enumerateQuestions={enumerateQuestions}
        />
      )}
      {response.type === 'likert' && (
        <LikertInput
          response={response}
          disabled={isDisabled}
          answer={ans}
          index={index}
          enumerateQuestions={enumerateQuestions}
        />
      )}
      {response.type === 'dropdown' && (
        <DropdownInput
          response={response}
          disabled={isDisabled}
          answer={ans}
          index={index}
          enumerateQuestions={enumerateQuestions}
        />
      )}
      {response.type === 'slider' && (
        <SliderInput
          response={response}
          disabled={isDisabled}
          answer={ans}
          index={index}
          enumerateQuestions={enumerateQuestions}
        />
      )}
      {response.type === 'radio' && (
        <RadioInput
          response={response}
          disabled={isDisabled}
          answer={ans}
          index={index}
          enumerateQuestions={enumerateQuestions}
        />
      )}
      {response.type === 'checkbox' && (
        <CheckBoxInput
          response={response}
          disabled={isDisabled}
          answer={ans}
          index={index}
          enumerateQuestions={enumerateQuestions}
        />
      )}
      {response.type === 'iframe' && (
        <IframeInput
          response={response}
          answer={ans as { value: string[] }}
          index={index}
          enumerateQuestions={enumerateQuestions}
        />
      )}
      {(response.type === 'matrix-radio' || response.type === 'matrix-checkbox') && (
        <MatrixInput
          disabled={isDisabled}
          response={response}
          answer={ans as { value: Record<string, string> }}
          index={index}
          enumerateQuestions={enumerateQuestions}
        />
      )}

      {(response.withDivider || configInUse.responseDividers) && <Divider mt="xl" mb="xs" />}
    </Box>
  );
}
