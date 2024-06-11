import { Box, Flex, Textarea } from '@mantine/core';
import { LongTextResponse } from '../../parser/types';
import { generateErrorMessage } from './utils';
import ReactMarkdownWrapper from '../ReactMarkdownWrapper';

export default function TextAreaInput({
  response,
  disabled,
  answer,
  index,
  enumerateQuestions,
}: {
  response: LongTextResponse;
  disabled: boolean;
  answer: { value?: string };
  index: number;
  enumerateQuestions: boolean;
}) {
  const {
    placeholder,
    prompt,
    required,
    secondaryText,
  } = response;

  return (
    <Textarea
      disabled={disabled}
      placeholder={placeholder}
      label={(
        <Flex direction="row" wrap="nowrap" gap={4}>
          {enumerateQuestions && <Box style={{ minWidth: 'fit-content' }}>{`${index}. `}</Box>}
          <Box style={{ display: 'block' }} className="no-last-child-bottom-padding">
            <ReactMarkdownWrapper text={prompt} required={required} />
          </Box>
        </Flex>
      )}
      description={secondaryText}
      radius="md"
      size="md"
      {...answer}
        // This is necessary so the component doesnt switch from uncontrolled to controlled, which can cause issues.
      value={answer.value || ''}
      error={generateErrorMessage(response, answer)}
    />
  );
}
