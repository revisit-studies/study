import { TextInput } from '@mantine/core';
import { ShortTextResponse } from '../../parser/types';

type inputProps = {
  response: ShortTextResponse;
  disabled: boolean;
  answer: any;
};

export default function StringInput({
  response,
  disabled,
  answer,
}: inputProps) {
  const { placeholder, prompt, required } = response;

  return (
    <>
      <TextInput
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
