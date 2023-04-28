import { TextInput } from '@mantine/core';

// ? @Jack - I am not sure of the purpose of this component? If it is just to use the inputRef, we don't need it.

type inputProps = {
  placeholder: string;
  label: string;
  required: boolean;
  answer:object;
};

export default function StringInput(
  { placeholder = '', label = '', required ,answer}: inputProps
) {
  return (
    <>
      <TextInput
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
