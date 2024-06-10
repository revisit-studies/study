import {
  Box, Flex, Radio, Text,
} from '@mantine/core';
import { RadioResponse } from '../../parser/types';
import { generateErrorMessage } from './utils';
import ReactMarkdownWrapper from '../ReactMarkdownWrapper';

export default function RadioInput({
  response,
  disabled,
  answer,
  index,
  enumerateQuestions,
}: {
  response: RadioResponse;
  disabled: boolean;
  answer: object;
  index: number;
  enumerateQuestions: boolean;
}) {
  const {
    prompt, required, options, leftLabel, rightLabel,
  } = response;

  return (
    <Radio.Group
      name={`radioInput${response.id}`}
      label={(
        <Flex direction="row" wrap="nowrap" gap={4}>
          {enumerateQuestions && <Box style={{ minWidth: 'fit-content' }}>{`${index}. `}</Box>}
          <ReactMarkdownWrapper text={prompt} required={required} />
        </Flex>
      )}
      size="md"
      key={response.id}
      {...answer}
        // This overrides the answers error. Which..is bad?
      error={generateErrorMessage(response, answer, options)}
    >
      {leftLabel ? <Text mt={-7}>{leftLabel}</Text> : null}
      {options.map((radio) => (
        <Radio
          disabled={disabled}
          value={radio.value}
          label={radio.label}
          key={radio.label}
        />
      ))}
      <Text mt={-7}>{rightLabel}</Text>
    </Radio.Group>
  );
}
