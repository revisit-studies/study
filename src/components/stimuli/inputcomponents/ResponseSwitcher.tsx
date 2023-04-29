import { Box } from '@mantine/core';
import { Response } from '../../../parser/types';
import { TrialResult } from '../../../store/types';
import { Nullable } from '../../../utils/nullable';
import TextInput from '../../stimuli/inputcomponents/TextInput';
import CheckBoxInput from './CheckBoxInput';
import DropdownInput from './DropdownInput';
import LikertInput from './LikertInput';
import NumericInput from './NumericInput';
import RadioInput from './RadioInput';
import SliderInput from './SliderInput';
import TextAreaInput from './TextAreaInput';

type Props = {
  response: Response;
  status?: Nullable<TrialResult>;
  answer: object;
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
  const { type, desc, prompt, options, required, preset, max, min } = response;

  if (!type) return null;

  const ans: any = storedAnswer ? { value: storedAnswer } : answer;

  return (
    <>
      <Box sx={{ margin: 10, padding: 5 }}>
        {type === 'short-text' && (
          <TextInput
            disabled={disabled}
            placeholder={desc}
            label={prompt}
            required={required}
            answer={ans}
          />
        )}
        {type === 'dropdown' && (
          <DropdownInput
            disabled={disabled}
            title={prompt}
            placeholder={desc}
            dropdownData={options}
            answer={ans}
            required={required}
          />
        )}
        {type === 'radio' && (
          <RadioInput
            disabled={disabled}
            title={prompt}
            desc={desc}
            radioData={options}
            answer={ans}
            required={required}
          />
        )}
        {type === 'numerical' && (
          <NumericInput
            disabled={disabled}
            label={prompt}
            placeholder={desc}
            required={required}
            answer={ans}
            max={max as number}
            min={min as number}
          />
        )}
        {type === 'likert' && (
          <LikertInput
            disabled={disabled}
            title={prompt}
            desc={desc}
            likertPreset={preset as string}
            answer={ans}
            required={required}
          />
        )}
        {type === 'checkbox' && (
          <CheckBoxInput
            disabled={disabled}
            label={prompt}
            desc={desc}
            required={required}
            checkboxData={options}
            answer={ans}
          />
        )}
        {type === 'long-text' && (
          <TextAreaInput
            disabled={disabled}
            placeholder={desc}
            label={prompt}
            required={required}
            answer={ans}
          />
        )}
        {type === 'slider' && (
          <SliderInput
            disabled={disabled}
            title={prompt}
            desc={desc}
            sliderData={options}
            answer={ans}
            required={required}
          />
        )}
      </Box>
    </>
  );
}
