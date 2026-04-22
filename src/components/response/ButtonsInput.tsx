import {
  Flex, FocusTrap, Radio, Text,
} from '@mantine/core';
import { useMemo } from 'react';
import { ButtonsResponse, ParsedStringOption } from '../../parser/types';
import { generateErrorMessage } from './utils';
import classes from './css/ButtonsInput.module.css';
import { useStoredAnswer } from '../../store/hooks/useStoredAnswer';
import { InputLabel } from './InputLabel';
import { OptionLabel } from './OptionLabel';
import { parseStringOptions } from '../../utils/stringOptions';

export function ButtonsInput({
  response,
  disabled,
  answer,
  index,
  enumerateQuestions,
  showUnanswered,
}: {
  response: ButtonsResponse;
  disabled: boolean;
  answer: { value?: string };
  index: number;
  enumerateQuestions: boolean;
  showUnanswered?: boolean;
}) {
  const {
    prompt,
    required,
    secondaryText,
    options,
    infoText,
  } = response;

  const storedAnswer = useStoredAnswer();
  const optionOrders: Record<string, ParsedStringOption[]> = useMemo(() => (storedAnswer ? storedAnswer.optionOrders : {}), [storedAnswer]);

  const orderedOptions = useMemo(
    () => parseStringOptions(optionOrders[response.id] || options),
    [optionOrders, options, response.id],
  );

  const error = useMemo(() => generateErrorMessage(response, answer, orderedOptions, showUnanswered), [response, answer, orderedOptions, showUnanswered]);

  return (
    <FocusTrap>
      <Radio.Group
        name={`radioInput${response.id}`}
        label={prompt.length > 0 && <InputLabel prompt={prompt} required={required} index={index} enumerateQuestions={enumerateQuestions} infoText={infoText} />}
        description={secondaryText}
        key={response.id}
        {...answer}
        error={error}
        errorProps={{ style: { display: 'none' } }}
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
              <OptionLabel label={radio.label} infoText={radio.infoText} button />
            </Radio.Card>
          ))}
        </Flex>
        {error && (
          <Text c={required ? 'red' : 'orange'} size="sm" mt="xs">
            {error}
          </Text>
        )}
      </Radio.Group>
    </FocusTrap>
  );
}
