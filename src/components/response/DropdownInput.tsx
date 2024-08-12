import {
  Box, Flex, Select,
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
    placeholder,
    prompt,
    required,
    options,
    secondaryText,
  } = response;

  const optionsAsStringOptions = options.map((option) => (typeof option === 'string' ? { value: option, label: option } : option));

  return (
    <Select
      disabled={disabled}
      label={(
        <Flex direction="row" wrap="nowrap" gap={4}>
          {enumerateQuestions && <Box style={{ minWidth: 'fit-content' }}>{`${index}. `}</Box>}
          <Box style={{ display: 'block' }} className="no-last-child-bottom-padding">
            <ReactMarkdownWrapper text={prompt} required={required} />
          </Box>
        </Flex>
      )}
      description={secondaryText}
      placeholder={placeholder}
      data={optionsAsStringOptions}
      radius="md"
      size="md"
      {...answer}
      error={generateErrorMessage(response, answer, optionsAsStringOptions)}
    />
  );
}
