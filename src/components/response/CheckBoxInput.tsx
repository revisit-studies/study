import { Box, Checkbox, Flex } from '@mantine/core';
import { CheckboxResponse } from '../../parser/types';
import { generateErrorMessage } from './utils';
import ReactMarkdownWrapper from '../ReactMarkdownWrapper';

export default function CheckBoxInput({
  response,
  disabled,
  answer,
  index,
  enumerateQuestions,
}: {
  response: CheckboxResponse;
  disabled: boolean;
  answer: object;
  index: number;
  enumerateQuestions: boolean;
}) {
  const { prompt, required, options } = response;

  return (
    <Checkbox.Group
      label={(
        <Flex direction="row" wrap="nowrap" gap={4}>
          {enumerateQuestions && <Box style={{ minWidth: 'fit-content' }}>{`${index}. `}</Box>}
          <ReactMarkdownWrapper text={prompt} required={required} />
        </Flex>
      )}
      {...answer}
      error={generateErrorMessage(response, answer, options)}
      size="md"
    >
      {options.map((option) => (
        <Checkbox
          key={option.value}
          disabled={disabled}
          value={option.value}
          label={option.label}
        />
      ))}
    </Checkbox.Group>
  );
}
