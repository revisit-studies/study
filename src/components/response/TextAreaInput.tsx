import { Textarea } from '@mantine/core';
import { LongTextResponse } from '../../parser/types';
import { generateErrorMessage } from './utils';

type inputProps = {
  response: LongTextResponse;
  disabled: boolean;
  answer: { value?: string };
};

export default function TextAreaInput({
  response,
  disabled,
  answer,
}: inputProps) {
  const { placeholder, prompt, required } = response;

  return (
    <Textarea
      disabled={disabled}
      placeholder={placeholder}
      label={prompt}
      radius="md"
      size="md"
      withAsterisk={required}
      {...answer}
        // This is necessary so the component doesnt switch from uncontrolled to controlled, which can cause issues.
      value={answer.value || ''}
      error={generateErrorMessage(response, answer)}
    />
  );
}
