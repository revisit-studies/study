import { Textarea } from '@mantine/core';
import { LongTextResponse } from '../../parser/types';
import { generateErrorMessage } from './utils';
import classes from './css/Input.module.css';
import { InputLabel } from './InputLabel';

export function TextAreaInput({
  response,
  disabled,
  answer,
  index,
  enumerateQuestions,
}: {
  response: LongTextResponse;
  disabled: boolean;
  answer: { value?: string };
  index: number;
  enumerateQuestions: boolean;
}) {
  const {
    placeholder,
    prompt,
    required,
    secondaryText,
    infoText,
  } = response;

  return (
    <Textarea
      disabled={disabled}
      placeholder={placeholder}
      label={prompt.length > 0 && <InputLabel prompt={prompt} required={required} index={index} enumerateQuestions={enumerateQuestions} infoText={infoText} />}
      description={secondaryText}
      radius="md"
      size="md"
      {...answer}
        // This is necessary so the component doesnt switch from uncontrolled to controlled, which can cause issues.
      value={answer.value || ''}
      error={generateErrorMessage(response, answer)}
      withErrorStyles={required}
      errorProps={{ c: required ? 'red' : 'orange' }}
      classNames={{ input: classes.fixDisabled }}
    />
  );
}
