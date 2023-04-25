import { Box, TextInput } from '@mantine/core';
import { TrialResult } from '../../store/types';
import CheckBoxInput from './CheckBoxInput';
import DropdownInput from './DropdownInput';
import LikertInput from './LikertInput';
import NumericInput from './NumericInput';
import RadioInput from './RadioInput';
import SliderInput from './SliderInput';
import TextAreaInput from './TextAreaInput';
import { Response } from '../../parser/types';


type Props = {
  response: Response;
  status?: TrialResult;
  answer: object;
};

export default function ResponseSwitcher({ response, answer }: Props) {
  const { type, desc, prompt, options, required, preset, max, min } = response;

  if (!type) return null;

  return (
    <>
      <Box sx={{margin:10, padding:5}}>
        {type === 'short-text' && (
            <TextInput placeholder={desc} label={prompt} required={required}/>
        )}
        {type === 'dropdown' && (
            <DropdownInput
                title={prompt}
                placeholder={desc}
                dropdownData={options}
                answer={answer}
                required={required}
            />
        )}
        {type === 'radio' && (
            <RadioInput title={prompt} desc={desc} radioData={options}answer={answer} required={required}/>
        )}
        {type === 'numerical' && (
            <NumericInput label={prompt} placeholder={desc} required={required} answer={answer} max={max as number} min={min as number}/>
        )}
        {type === 'likert' && (
            <LikertInput title={prompt} desc={desc} likertPreset={preset as string} answer={answer} required={required}/>
        )}
        {type === 'checkbox' && (
            <CheckBoxInput label={prompt} desc={desc} required={required} checkboxData={options} answer={answer}/>
        )}
        {type === 'long-text' && (
            <TextAreaInput placeholder={desc} label={prompt} required={required} answer={answer}/>
        )}
        {type === 'slider' && <SliderInput title={prompt} desc={desc} sliderData={options} answer={answer} required={required}/>}
      </Box>
    </>
  );
}
