import { Select } from '@mantine/core';
import { DropdownResponse } from '../../parser/types';
import { generateErrorMessage } from '../stimuli/inputcomponents/utils';


type inputProps = {
  response: DropdownResponse;
  disabled: boolean;
  answer: any;
};

export default function DropdownInput({
  response,
  disabled,
  answer,
}: inputProps) {
  const { placeholder, prompt, required, options } = response;

  return (
    <>
      <Select
        disabled={disabled}
        label={prompt}
        placeholder={placeholder}
        data={options}
        withAsterisk={required}
        radius={'md'}
        size={'md'}
        {...answer}
        error={generateErrorMessage(response, answer, options)}
      />
    </>
  );
}
