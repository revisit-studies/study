import { NumberInput } from '@mantine/core';

type inputProps = {
  placeholder: string;
  label: string;
  required: boolean;
  max: number;
  min: number;
  answer: object;
  disabled: boolean;
};
export default function NumericInput({
  disabled = false,
  placeholder = '',
  label = '',
  required = false,
  min = 0,
  max = 10,
  answer,
}: inputProps) {
  return (
    <>
      <NumberInput
        disabled={disabled}
        placeholder={placeholder}
        label={label}
        withAsterisk={required}
        radius={'md'}
        size={'md'}
        min={min}
        max={max}
        {...answer}
      />
    </>
  );
}
