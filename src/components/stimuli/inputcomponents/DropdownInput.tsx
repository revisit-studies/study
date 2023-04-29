import { Select } from '@mantine/core';
import { Option } from '../../../parser/types';

type dropdownOpton = {
  label: string;
  value: string;
};

type inputProps = {
  title: string;
  placeholder: string;
  dropdownData?: Option[];
  answer: object;
  required: boolean;
  disabled: boolean;
};

export default function DropdownInput({
  title = 'Your Question',
  disabled = false,
  placeholder = 'additional description',
  dropdownData = [],
  required,
  answer,
}: inputProps) {
  return (
    <>
      <Select
        disabled={disabled}
        label={title}
        placeholder={placeholder}
        data={dropdownData as dropdownOpton[]}
        withAsterisk={required}
        radius={'md'}
        size={'md'}
        {...answer}
      />
    </>
  );
}
