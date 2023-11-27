import { Box } from '@mantine/core';
import { Nullable, Response } from '../../parser/types';
import { TrialValidation } from '../../store/types';
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
  status?: Nullable<TrialValidation>;
  answer: { value?: object };
  disabled?: boolean;
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
  const isDisabled = disabled || !!response.paramCapture;

  return (
    <>
      <Box sx={{ margin: 10, padding: 5 }}>
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
          <IframeInput response={response} disabled={isDisabled} answer={ans as { value: string[] }} />
        )}
      </Box>
    </>
  );
}
