import { Box } from '@mantine/core';
import { Nullable, Response } from '../../parser/types';
import { TrialResult } from '../../store/types';
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
  status?: Nullable<TrialResult>;
  answer: any;
  disabled?: boolean;
  storedAnswer?: any;
};

export default function ResponseSwitcher({
  status = null,
  disabled = !!status?.complete,
  response,
  answer,
  storedAnswer,
}: Props) {
  const isDisabled = disabled || !!response.paramCapture;

  const ans: any = storedAnswer
    ? { value: storedAnswer }
    : answer;

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
          <IframeInput response={response} disabled={isDisabled} answer={ans} />
        )}
      </Box>
    </>
  );
}
