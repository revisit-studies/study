import { NumberInput } from '@mantine/core';
import { NumericalResponse } from '../../parser/types';
import { generateErrorMessage } from './utils';
import classes from './css/Input.module.css';
import { InputLabel } from './InputLabel';

export function NumericInput({
  response,
  disabled,
  answer,
  index,
  enumerateQuestions,
}: {
  response: NumericalResponse;
  disabled: boolean;
  answer: object;
  index: number;
  enumerateQuestions: boolean;
}) {
  const {
    prompt,
    required,
    min,
    max,
    placeholder,
    secondaryText,
    hoverDescription,
  } = response;

  return (
    <NumberInput
      disabled={disabled}
      placeholder={placeholder}
      label={prompt.length > 0 && <InputLabel prompt={prompt} required={required} index={index} enumerateQuestions={enumerateQuestions} hoverDescription={hoverDescription} />}
      description={secondaryText}
      radius="md"
      size="md"
      min={min}
      max={max}
      {...answer}
      error={generateErrorMessage(response, answer)}
      classNames={{ input: classes.fixDisabled }}
    />
  );
}
