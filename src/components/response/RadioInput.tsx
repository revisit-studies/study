import {
  Box, Flex, Group, Radio, Text,
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
    prompt,
    required,
    options,
    leftLabel,
    rightLabel,
    secondaryText,
  } = response;

  const optionsAsStringOptions = options.map((option) => (typeof option === 'string' ? { value: option, label: option } : option));

  return (
    <Radio.Group
      name={`radioInput${response.id}`}
      label={(
        <Flex direction="row" wrap="nowrap" gap={4}>
          {enumerateQuestions && <Box style={{ minWidth: 'fit-content' }}>{`${index}. `}</Box>}
          <Box style={{ display: 'block' }} className="no-last-child-bottom-padding">
            <ReactMarkdownWrapper text={prompt} required={required} />
          </Box>
        </Flex>
      )}
      description={secondaryText}
      key={response.id}
      {...answer}
        // This overrides the answers error. Which..is bad?
      error={generateErrorMessage(response, answer, optionsAsStringOptions)}
      style={{ '--input-description-size': 'calc(var(--mantine-font-size-md) - calc(0.125rem * var(--mantine-scale)))' }}
    >
      <Group mt="xs">
        {leftLabel ? <Text style={{ textAlign: 'center' }}>{leftLabel}</Text> : null}
        {optionsAsStringOptions.map((radio) => (
          <Radio
            disabled={disabled}
            value={radio.value}
            label={radio.label}
            key={radio.label}
          />
        ))}
        <Text>{rightLabel}</Text>
      </Group>
    </Radio.Group>
  );
}
