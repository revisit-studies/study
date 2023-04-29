import { TextInput } from '@mantine/core';

// ? @Jack - I am not sure of the purpose of this component? If it is just to use the inputRef, we don't need it.

type inputProps = {
  placeholder: string;
  label: string;
  required: boolean;
  answer: object;
  disabled: boolean;
};

export default function StringInput({
  placeholder = '',
  label = '',
  disabled = false,
  required,
  answer,
}: inputProps) {
  return (
    <>
      <TextInput
        disabled={disabled}
        placeholder={placeholder}
        label={label}
        radius={'md'}
        size={'md'}
        withAsterisk={required}
        {...answer}
      />
    </>
  );
}
