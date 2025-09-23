import {
  Flex, FocusTrap, Radio, Text,
} from '@mantine/core';
import { useMemo } from 'react';
import { ButtonsResponse, StringOption } from '../../parser/types';
import { generateErrorMessage } from './utils';
import classes from './css/ButtonsInput.module.css';
import { useStoredAnswer } from '../../store/hooks/useStoredAnswer';
import { InputLabel } from './InputLabel';

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
    secondaryText,
    options,
  } = response;

  const storedAnswer = useStoredAnswer();
  const optionOrders: Record<string, StringOption[]> = useMemo(() => (storedAnswer ? storedAnswer.optionOrders : {}), [storedAnswer]);

  const orderedOptions = useMemo(() => optionOrders[response.id] || options, [optionOrders, options, response.id]);

  const error = useMemo(() => generateErrorMessage(response, answer, orderedOptions), [response, answer, orderedOptions]);

  return (
    <FocusTrap>
      <Radio.Group
        name={`radioInput${response.id}`}
        label={prompt.length > 0 && <InputLabel prompt={prompt} required={required} index={index} enumerateQuestions={enumerateQuestions} />}
        description={secondaryText}
        key={response.id}
        {...answer}
          // This overrides the answers error. Which..is bad?
        error={error}
        style={{ '--input-description-size': 'calc(var(--mantine-font-size-md) - calc(0.125rem * var(--mantine-scale)))' }}
      >
        <Flex justify="space-between" align="center" gap="xl" mt="xs">
          {orderedOptions.map((radio, idx) => (
            <Radio.Card
              key={`radio-${idx}`}
              value={radio.value}
              disabled={disabled}
              ta="center"
              className={classes.root}
              p="xs"
            >
              <Text>{radio.label}</Text>
            </Radio.Card>
          ))}
        </Flex>
      </Radio.Group>
    </FocusTrap>
  );
}
