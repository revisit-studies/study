import {
  Box, Flex, Radio, Text,
} from '@mantine/core';
import { useState } from 'react';
import { ButtonsResponse } from '../../parser/types';
import { generateErrorMessage } from './utils';
import { ReactMarkdownWrapper } from '../ReactMarkdownWrapper';
import classes from './ButtonsInput.module.css';

export function ButtonsInput({
  response,
  disabled,
  answer,
  index,
  enumerateQuestions,
}: {
  response: ButtonsResponse;
  disabled: boolean;
  answer: { value?: string };
  index: number;
  enumerateQuestions: boolean;
}) {
  const {
    prompt,
    required,
    options,
    secondaryText,
  } = response;

  const optionsAsStringOptions = options.map((option) => (typeof option === 'string' ? { value: option, label: option } : option));

  const [checkedValue, setCheckedValue] = useState(answer.value ?? '');

  return (
    <Radio.Group
      name={`radioInput${response.id}`}
      label={(
        <Flex direction="row" wrap="nowrap" gap={4}>
          {enumerateQuestions && <Box style={{ minWidth: 'fit-content', fontSize: 16, fontWeight: 500 }}>{`${index}. `}</Box>}
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
      <Flex justify="space-between" align="center" gap="xl" mt="xs">
        {optionsAsStringOptions.map((radio) => (
          <Radio.Card
            key={radio.value}
            value={radio.value}
            disabled={disabled}
            checked={checkedValue === radio.value}
            onClick={() => setCheckedValue(radio.value)}
            ta="center"
            className={classes.root}
            p="xs"
          >
            <Text>{radio.label}</Text>
          </Radio.Card>
        ))}
      </Flex>
    </Radio.Group>
  );
}
