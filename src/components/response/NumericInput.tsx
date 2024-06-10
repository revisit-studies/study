import { Box, Flex, NumberInput } from '@mantine/core';
import { NumericalResponse } from '../../parser/types';
import { generateErrorMessage } from './utils';
import ReactMarkdownWrapper from '../ReactMarkdownWrapper';

export default function NumericInput({
  response,
  disabled,
  answer,
  index,
  enumerateQuestions,
}: {
  response: NumericalResponse;
  disabled: boolean;
  answer: object;
  index: number;
  enumerateQuestions: boolean;
}) {
  const {
    prompt, required, min, max, placeholder,
  } = response;

  return (
    <NumberInput
      disabled={disabled}
      placeholder={placeholder}
      label={(
        <Flex direction="row" wrap="nowrap" gap={4}>
          {enumerateQuestions && <Box style={{ minWidth: 'fit-content' }}>{`${index}. `}</Box>}
          <ReactMarkdownWrapper text={prompt} required={required} />
        </Flex>
      )}
      radius="md"
      size="md"
      min={min}
      max={max}
      {...answer}
      error={generateErrorMessage(response, answer)}
    />
  );
}
