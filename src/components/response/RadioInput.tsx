import {
  Group, Input, Radio, rem, Text,
} from '@mantine/core';
import { useState, useMemo } from 'react';
import { ParsedStringOption, RadioResponse } from '../../parser/types';
import { generateErrorMessage } from './utils';
import { HorizontalHandler } from './HorizontalHandler';
import classes from './css/Radio.module.css';
import inputClasses from './css/Input.module.css';
import { useStoredAnswer } from '../../store/hooks/useStoredAnswer';
import { InputLabel } from './InputLabel';
import { OptionLabel } from './OptionLabel';
import { parseStringOptions } from '../../utils/stringOptions';

export function RadioInput({
  response,
  disabled,
  answer,
  index,
  enumerateQuestions,
  stretch,
  otherValue,
}: {
  response: RadioResponse;
  disabled: boolean;
  answer: object;
  index: number;
  enumerateQuestions: boolean;
  stretch?: boolean;
  otherValue?: object;
}) {
  const {
    prompt,
    required,
    leftLabel,
    rightLabel,
    secondaryText,
    infoText,
    horizontal,
    withOther,
    options,
    labelLocation,
  } = response;

  const storedAnswer = useStoredAnswer();
  const optionOrders: Record<string, ParsedStringOption[]> = useMemo(() => (storedAnswer ? storedAnswer.optionOrders : {}), [storedAnswer]);

  const orderedOptions = useMemo(
    () => parseStringOptions(optionOrders[response.id] || options),
    [optionOrders, options, response.id],
  );

  const [otherSelected, setOtherSelected] = useState(false);

  const error = useMemo(() => generateErrorMessage(response, answer, orderedOptions), [response, answer, orderedOptions]);
  const label = useMemo(() => ((horizontal && labelLocation) ? labelLocation : 'inline'), [labelLocation, horizontal]);

  return (
    <Radio.Group
      name={`radioInput${response.id}`}
      label={prompt.length > 0 && <InputLabel prompt={prompt} required={required} index={index} enumerateQuestions={enumerateQuestions} infoText={infoText} />}
      description={secondaryText}
      key={response.id}
      {...answer}
      error={error}
      errorProps={{ c: required ? 'red' : 'orange' }}
      style={{ '--input-description-size': 'calc(var(--mantine-font-size-md) - calc(0.125rem * var(--mantine-scale)))' }}
    >
      {horizontal && label === 'above' && (leftLabel || rightLabel) && (
        <Group gap="lg" justify="space-between" mt={0}>
          {leftLabel && <Text>{leftLabel}</Text>}
          {rightLabel && <Text>{rightLabel}</Text>}
        </Group>
      )}
      <Group gap="lg" align="flex-end" mt={horizontal ? 0 : 'sm'}>
        {horizontal && label === 'inline' && leftLabel && <Text>{leftLabel}</Text>}
        <HorizontalHandler horizontal={!!horizontal} style={{ flexGrow: 1 }}>
          {orderedOptions.map((radio) => (
            <div
              key={`${radio.value}-${response.id}`}
              style={{
                display: 'flex',
                flexDirection: horizontal ? 'column' : 'row',
                gap: horizontal ? 'unset' : rem(12),
                flex: stretch ? 1 : 'unset',
                alignItems: 'center',
              }}
            >
              {horizontal && <OptionLabel label={radio.label} infoText={radio.infoText} />}
              <Radio
                disabled={disabled}
                value={radio.value}
                label={<OptionLabel label={radio.label} infoText={radio.infoText} />}
                styles={{
                  label: { display: !horizontal ? 'initial' : 'none' },
                }}
                onChange={() => setOtherSelected(false)}
                classNames={{ radio: classes.fixDisabled, label: classes.fixDisabledLabel, icon: classes.fixDisabledIcon }}
              />
            </div>
          ))}
          {withOther && (
            <div
              style={{
                display: 'flex',
                flexDirection: horizontal ? 'column' : 'row',
                gap: horizontal ? 'unset' : rem(12),
                flex: stretch ? 1 : 'unset',
                alignItems: 'center',
              }}
            >
              {horizontal && <Text size="sm">Other</Text>}
              <Radio
                disabled={disabled}
                value="other"
                checked={otherSelected}
                onClick={(event) => setOtherSelected(event.currentTarget.checked)}
                label={!horizontal && (
                  <Input
                    mt={-8}
                    placeholder="Other"
                    disabled={!otherSelected}
                    {...otherValue}
                    classNames={{ input: inputClasses.fixDisabled }}
                  />
                )}
                mt={0}
                classNames={{ radio: classes.fixDisabled, label: classes.fixDisabledLabel, icon: classes.fixDisabledIcon }}
              />
            </div>
          )}
        </HorizontalHandler>
        {horizontal && label === 'inline' && rightLabel && <Text>{rightLabel}</Text>}
      </Group>
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
      {horizontal && label === 'below' && (leftLabel || rightLabel) && (
        <Group gap="lg" justify="space-between" mt="sm">
          {leftLabel && <Text>{leftLabel}</Text>}
          {rightLabel && <Text>{rightLabel}</Text>}
        </Group>
      )}
    </Radio.Group>
  );
}
