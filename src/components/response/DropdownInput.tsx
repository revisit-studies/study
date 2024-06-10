import {
  Box, Flex, Select, SelectItem,
} from '@mantine/core';
import { DropdownResponse } from '../../parser/types';
import { generateErrorMessage } from './utils';
import ReactMarkdownWrapper from '../ReactMarkdownWrapper';

export default function DropdownInput({
  response,
  disabled,
  answer,
  index,
  enumerateQuestions,
}: {
  response: DropdownResponse;
  disabled: boolean;
  answer: object;
  index: number;
  enumerateQuestions: boolean;
}) {
  const {
    placeholder, prompt, required, options,
  } = response;

  return (
    <Select
      disabled={disabled}
      label={(
        <Flex direction="row" wrap="nowrap" gap={4}>
          {enumerateQuestions && <Box style={{ minWidth: 'fit-content' }}>{`${index}. `}</Box>}
          <ReactMarkdownWrapper text={prompt} required={required} />
        </Flex>
      )}
      placeholder={placeholder}
      data={options as SelectItem[]}
      radius="md"
      size="md"
      {...answer}
      error={generateErrorMessage(response, answer, options)}
    />
  );
}
