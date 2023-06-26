import { Select } from '@mantine/core';
import { DropdownResponse } from '../../parser/types';


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
      />
    </>
  );
}
