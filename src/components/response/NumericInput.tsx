import { NumberInput } from '@mantine/core';
import { NumericalResponse } from '../../parser/types';
import { generateErrorMessage } from '../stimuli/inputcomponents/utils';

type inputProps = {
  response: NumericalResponse;
  disabled: boolean;
  answer: object;
};
export default function NumericInput({
  response,
  disabled,
  answer
}: inputProps) {
  const { prompt, required, min, max, placeholder } = response;

  return (
    <>
      <NumberInput
        disabled={disabled}
        placeholder={placeholder}
        label={prompt}
        withAsterisk={required}
        radius={'md'}
        size={'md'}
        min={min}
        max={max}
        {...answer}
        error={generateErrorMessage(response, answer)}
      />
    </>
  );
}
