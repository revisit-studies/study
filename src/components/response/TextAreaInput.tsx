import { Textarea } from '@mantine/core';

type inputProps = {
  placeholder: string;
  label: string;
  required: boolean;
  answer: object;
  disabled: boolean;
};

export default function TextAreaInput({
  disabled = false,
  placeholder = '',
  label = '',
  required,
  answer,
}: inputProps) {
  return (
    <>
      <Textarea
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
