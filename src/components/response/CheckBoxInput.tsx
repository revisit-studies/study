import {
  Box, Checkbox, Input,
} from '@mantine/core';
import { useMemo, useState } from 'react';
import { CheckboxResponse, StringOption } from '../../parser/types';
import { generateErrorMessage } from './utils';
import { HorizontalHandler } from './HorizontalHandler';
import classes from './css/Checkbox.module.css';
import inputClasses from './css/Input.module.css';
import { useStoredAnswer } from '../../store/hooks/useStoredAnswer';
import { InputLabel } from './InputLabel';

export function CheckBoxInput({
  response,
  disabled,
  answer,
  index,
  enumerateQuestions,
  otherValue,
}: {
  response: CheckboxResponse;
  disabled: boolean;
  answer: object;
  index: number;
  enumerateQuestions: boolean;
  otherValue?: object;
}) {
  const {
    prompt,
    required,
    secondaryText,
    horizontal,
    withOther,
    options,
    infoText,
  } = response;

  const storedAnswer = useStoredAnswer();
  const optionOrders: Record<string, StringOption[]> = useMemo(() => (storedAnswer ? storedAnswer.optionOrders : {}), [storedAnswer]);

  const orderedOptions = useMemo(() => optionOrders[response.id] || options.map((option) => (typeof (option) === 'string' ? { label: option, value: option } : option)), [optionOrders, options, response.id]);

  const [otherSelected, setOtherSelected] = useState(false);

  const error = useMemo(() => generateErrorMessage(response, answer, orderedOptions), [response, answer, orderedOptions]);

  return (
    <Checkbox.Group
      label={prompt.length > 0 && <InputLabel prompt={prompt} required={required} index={index} enumerateQuestions={enumerateQuestions} infoText={infoText} />}
      description={secondaryText}
      {...answer}
      error={error}
      errorProps={{ c: required ? 'red' : 'orange' }}
      style={{ '--input-description-size': 'calc(var(--mantine-font-size-md) - calc(0.125rem * var(--mantine-scale)))' }}
    >
      <Box mt="xs">
        <HorizontalHandler horizontal={!!horizontal} style={{ flexGrow: 1 }}>
          {orderedOptions.map((option) => (
            <Checkbox
              key={option.value}
              disabled={disabled}
              value={option.value}
              label={option.label}
              classNames={{ input: classes.fixDisabled, label: classes.fixDisabledLabel, icon: classes.fixDisabledIcon }}
            />
          ))}
          {withOther && (
            <Checkbox
              key="__other"
              disabled={disabled}
              value="__other"
              checked={otherSelected}
              onClick={(event) => setOtherSelected(event.currentTarget.checked)}
              label={horizontal ? 'Other' : (
                <Input
                  mt={-8}
                  placeholder="Other"
                  disabled={!otherSelected}
                  {...otherValue}
                  classNames={{ input: inputClasses.fixDisabled }}
                />
              )}
              classNames={{ input: classes.fixDisabled, label: classes.fixDisabledLabel, icon: classes.fixDisabledIcon }}
            />
          )}
        </HorizontalHandler>
      </Box>
      {horizontal && withOther && (
        <Input
          mt="sm"
          placeholder="Other"
          disabled={!otherSelected}
          {...otherValue}
          w={216}
          classNames={{ input: inputClasses.fixDisabled }}
        />
      )}
    </Checkbox.Group>
  );
}
