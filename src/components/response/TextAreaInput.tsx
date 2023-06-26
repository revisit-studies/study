import { Textarea } from '@mantine/core';
import { LongTextResponse } from '../../parser/types';

type inputProps = {
  response: LongTextResponse;
  disabled: boolean;
  answer: any;
};

export default function TextAreaInput({
  response,
  disabled,
  answer,
}: inputProps) {
  const { placeholder, prompt, required } = response;

  return (
    <>
      <Textarea
        disabled={disabled}
        placeholder={placeholder}
        label={prompt}
        radius={'md'}
        size={'md'}
        withAsterisk={required}
        {...answer}
      />
    </>
  );
}
