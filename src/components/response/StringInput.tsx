import { TextInput } from '@mantine/core';
import { ShortTextResponse } from '../../parser/types';
import { generateErrorMessage } from '../stimuli/inputcomponents/utils';

type inputProps = {
  response: ShortTextResponse;
  disabled: boolean;
  answer: { value?: string };
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
        // This is necessary so the component doesnt switch from uncontrolled to controlled, which can cause issues.
        value={answer.value || ''}
        error={generateErrorMessage(response, answer)}
      />
    </>
  );
}
