import { Box } from '@mantine/core';
import { useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import { Response } from '../../parser/types';
import CheckBoxInput from './CheckBoxInput';
import DropdownInput from './DropdownInput';
import IframeInput from './IframeInput';
import LikertInput from './LikertInput';
import NumericInput from './NumericInput';
import RadioInput from './RadioInput';
import SliderInput from './SliderInput';
import StringInput from './StringInput';
import TextAreaInput from './TextAreaInput';

type Props = {
  response: Response;
  answer: { value?: object };
  storedAnswer?: Record<string, unknown>;
};

export default function ResponseSwitcher({
  response,
  answer,
  storedAnswer,
}: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ans: { value?: any } = (storedAnswer ? { value: storedAnswer } : answer) || { value: undefined };
  const disabled = !!storedAnswer;

  const [searchParams] = useSearchParams();

  const isDisabled = useMemo(() => {
    if (response.paramCapture) {
      const responseParam = searchParams.get(response.paramCapture);
      return disabled || !!responseParam;
    }

    return disabled;
  }, [disabled, response.paramCapture, searchParams]);

  return (
    <Box style={{ margin: 10, padding: 5 }}>
      {response.type === 'numerical' && (
      <NumericInput
        response={response}
        disabled={isDisabled}
        answer={ans}
      />
      )}
      {response.type === 'shortText' && (
      <StringInput response={response} disabled={isDisabled} answer={ans} />
      )}
      {response.type === 'longText' && (
      <TextAreaInput
        response={response}
        disabled={isDisabled}
        answer={ans}
      />
      )}
      {response.type === 'likert' && (
      <LikertInput response={response} disabled={isDisabled} answer={ans} />
      )}
      {response.type === 'dropdown' && (
      <DropdownInput
        response={response}
        disabled={isDisabled}
        answer={ans}
      />
      )}
      {response.type === 'slider' && (
      <SliderInput response={response} disabled={isDisabled} answer={ans} />
      )}
      {response.type === 'radio' && (
      <RadioInput response={response} disabled={isDisabled} answer={ans} />
      )}
      {response.type === 'checkbox' && (
      <CheckBoxInput
        response={response}
        disabled={isDisabled}
        answer={ans}
      />
      )}
      {response.type === 'iframe' && (
      <IframeInput response={response} answer={ans as { value: string[] }} />
      )}
    </Box>
  );
}
