import {
  Group, Input, Radio, rem, Text,
} from '@mantine/core';
import { useState, useMemo } from 'react';
import { RadioResponse, StringOption } from '../../parser/types';
import { generateErrorMessage } from './utils';
import { HorizontalHandler } from './HorizontalHandler';
import classes from './css/Radio.module.css';
import inputClasses from './css/Input.module.css';
import { useStoredAnswer } from '../../store/hooks/useStoredAnswer';
import { InputLabel } from './InputLabel';
import { ReactMarkdownWrapper } from '../ReactMarkdownWrapper';

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
  } = response;

  const storedAnswer = useStoredAnswer();
  const optionOrders: Record<string, StringOption[]> = useMemo(() => (storedAnswer ? storedAnswer.optionOrders : {}), [storedAnswer]);

  const orderedOptions = useMemo(() => optionOrders[response.id] || options.map((option) => (typeof (option) === 'string' ? { label: option, value: option } : option)), [optionOrders, options, response.id]);

  const [otherSelected, setOtherSelected] = useState(false);

  const error = useMemo(() => generateErrorMessage(response, answer, orderedOptions), [response, answer, orderedOptions]);

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
      <Group gap="lg" align="flex-end" mt={horizontal ? 0 : 'sm'}>
        {leftLabel ? <Text>{leftLabel}</Text> : null}
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
              {horizontal && <ReactMarkdownWrapper text={radio.label} />}
              <Radio
                disabled={disabled}
                value={radio.value}
                label={radio.label}
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
        <Text>{rightLabel}</Text>
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
    </Radio.Group>
  );
}
