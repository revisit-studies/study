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
  showUnanswered,
}: {
  response: NumericalResponse;
  disabled: boolean;
  answer: object;
  index: number;
  enumerateQuestions: boolean;
  showUnanswered?: boolean;
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
      error={generateErrorMessage(response, answer, undefined, showUnanswered)}
      withErrorStyles={required}
      errorProps={{ c: required ? 'red' : 'orange', size: 'sm' }}
      classNames={{ input: classes.fixDisabled }}
    />
  );
}
