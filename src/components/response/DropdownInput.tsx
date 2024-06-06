import { Select } from '@mantine/core';
import { DropdownResponse } from '../../parser/types';
import { generateErrorMessage } from './utils';
import ReactMarkdownWrapper from '../ReactMarkdownWrapper';

type inputProps = {
  response: DropdownResponse;
  disabled: boolean;
  answer: object;
};

export default function DropdownInput({
  response,
  disabled,
  answer,
}: inputProps) {
  const {
    placeholder, prompt, required, options,
  } = response;

  return (
    <Select
      disabled={disabled}
      label={<ReactMarkdownWrapper text={prompt} required={required} />}
      placeholder={placeholder}
      data={options}
      radius="md"
      size="md"
      {...answer}
      error={generateErrorMessage(response, answer, options)}
    />
  );
}
