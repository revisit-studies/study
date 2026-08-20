import { NumberInput } from '@mantine/core';
import { NumericalResponse } from '../../parser/types';
import classes from './css/Input.module.css';
import { InputLabel } from './InputLabel';

export function NumericInput({
  response,
  disabled,
  answer,
  error,
  index,
  enumerateQuestions,
}: {
  response: NumericalResponse;
  disabled: boolean;
  answer: { value?: number };
  error?: string | null;
  index: number;
  enumerateQuestions: boolean;
}) {
  const {
    prompt,
    required,
    placeholder,
    secondaryText,
    infoText,
  } = response;

  return (
    <NumberInput
      disabled={disabled}
      placeholder={placeholder}
      label={prompt.length > 0 && <InputLabel prompt={prompt} required={required} index={index} enumerateQuestions={enumerateQuestions} infoText={infoText} />}
      description={secondaryText}
      radius="md"
      size="md"
      {...answer}
      error={error}
      withErrorStyles={required}
      errorProps={{ c: required ? 'red' : 'orange', fz: 'sm', mt: 'xs' }}
      classNames={{ input: classes.fixDisabled }}
    />
  );
}
