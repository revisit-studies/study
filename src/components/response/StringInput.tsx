import { Box, Flex, TextInput } from '@mantine/core';
import { ShortTextResponse } from '../../parser/types';
import { generateErrorMessage } from './utils';
import ReactMarkdownWrapper from '../ReactMarkdownWrapper';

export default function StringInput({
  response,
  disabled,
  answer,
  index,
  enumerateQuestions,
}: {
  response: ShortTextResponse;
  disabled: boolean;
  answer: { value?: string };
  index: number;
  enumerateQuestions: boolean;
}) {
  const { placeholder, prompt, required } = response;

  return (
    <TextInput
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
      {...answer}
        // This is necessary so the component doesnt switch from uncontrolled to controlled, which can cause issues.
      value={answer.value || ''}
      error={generateErrorMessage(response, answer)}
    />
  );
}
