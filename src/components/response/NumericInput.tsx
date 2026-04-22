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
  hideErrorMessage,
}: {
  response: NumericalResponse;
  disabled: boolean;
  answer: object;
  index: number;
  enumerateQuestions: boolean;
  showUnanswered?: boolean;
  hideErrorMessage?: boolean;
}) {
  const {
    prompt,
    required,
    placeholder,
    secondaryText,
    infoText,
  } = response;
  const error = generateErrorMessage(response, answer, undefined, showUnanswered);

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
      // Standalone "I don't know" responses render the unanswered message below the checkbox
      // so the input keeps its error styling without duplicating the same text inline.
      errorProps={hideErrorMessage && error
        ? { style: { display: 'none' } }
        : { c: required ? 'red' : 'orange', size: 'sm' }}
      classNames={{ input: classes.fixDisabled }}
    />
  );
}
