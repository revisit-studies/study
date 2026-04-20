import {
  Box, Checkbox, Input, Text,
} from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { CheckboxResponse, ParsedStringOption } from '../../parser/types';
import { DONT_KNOW_DEFAULT_VALUE, generateErrorMessage, normalizeCheckboxDontKnowValue } from './utils';
import { HorizontalHandler } from './HorizontalHandler';
import classes from './css/Checkbox.module.css';
import inputClasses from './css/Input.module.css';
import { useStoredAnswer } from '../../store/hooks/useStoredAnswer';
import { InputLabel } from './InputLabel';
import { OptionLabel } from './OptionLabel';
import { parseStringOptions } from '../../utils/stringOptions';

export function CheckBoxInput({
  response,
  disabled,
  answer,
  index,
  enumerateQuestions,
  otherValue,
  dontKnowCheckbox,
  showUnanswered,
}: {
  response: CheckboxResponse;
  disabled: boolean;
  answer: { value?: string[]; onChange?: (value: string[]) => void };
  index: number;
  enumerateQuestions: boolean;
  otherValue?: object;
  dontKnowCheckbox?: { checked?: boolean; onChange?: (value: boolean) => void };
  showUnanswered?: boolean;
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
  const optionOrders: Record<string, ParsedStringOption[]> = useMemo(() => (storedAnswer ? storedAnswer.optionOrders : {}), [storedAnswer]);

  const orderedOptions = useMemo(
    () => parseStringOptions(optionOrders[response.id] || options),
    [optionOrders, options, response.id],
  );

  const [otherSelected, setOtherSelected] = useState(false);

  const error = useMemo(
    () => generateErrorMessage(response, { ...answer, dontKnowChecked: !!dontKnowCheckbox?.checked }, orderedOptions, showUnanswered),
    [response, answer, orderedOptions, dontKnowCheckbox?.checked, showUnanswered],
  );
  const selectedValues = useMemo(() => (Array.isArray(answer.value) ? answer.value : []), [answer.value]);

  useEffect(() => {
    if (!response.withDontKnow || selectedValues.length === 0) {
      return;
    }

    const containsDontKnowDefault = selectedValues.includes(DONT_KNOW_DEFAULT_VALUE);
    if (!containsDontKnowDefault) {
      return;
    }

    const normalizedValues = normalizeCheckboxDontKnowValue(selectedValues);
    if (normalizedValues !== selectedValues) {
      answer.onChange?.(normalizedValues);
    }

    if (!dontKnowCheckbox?.checked) {
      dontKnowCheckbox?.onChange?.(true);
    }
  }, [response.withDontKnow, selectedValues, answer, dontKnowCheckbox]);

  return (
    <Checkbox.Group
      label={prompt.length > 0 && <InputLabel prompt={prompt} required={required} index={index} enumerateQuestions={enumerateQuestions} infoText={infoText} />}
      description={secondaryText}
      {...answer}
      style={{ '--input-description-size': 'calc(var(--mantine-font-size-md) - calc(0.125rem * var(--mantine-scale)))' }}
    >
      <Box mt="xs">
        <HorizontalHandler horizontal={!!horizontal} style={{ flexGrow: 1 }}>
          {orderedOptions.map((option) => (
            <Checkbox
              key={option.value}
              disabled={disabled}
              value={option.value}
              label={<OptionLabel label={option.label} infoText={option.infoText} />}
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
      {error && (
        <Text c={required ? 'red' : 'orange'} size="sm" mt="xs">
          {error}
        </Text>
      )}
    </Checkbox.Group>
  );
}
