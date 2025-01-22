import {
  Box, Flex, Group, Input, Radio, rem, Text,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { RadioResponse } from '../../parser/types';
import { generateErrorMessage } from './utils';
import { ReactMarkdownWrapper } from '../ReactMarkdownWrapper';
import { HorizontalHandler } from './HorizontalHandler';
import { useStoreActions, useStoreDispatch } from '../../store/store';

export function RadioInput({
  response,
  disabled,
  answer,
  index,
  enumerateQuestions,
  stretch,
}: {
  response: RadioResponse;
  disabled: boolean;
  answer: object;
  index: number;
  enumerateQuestions: boolean;
  stretch?: boolean
}) {
  const {
    prompt,
    required,
    options,
    leftLabel,
    rightLabel,
    secondaryText,
    horizontal,
    withOther,
  } = response;

  const optionsAsStringOptions = options.map((option) => (typeof option === 'string' ? { value: option, label: option } : option));

  const [otherSelected, setOtherSelected] = useState(false);
  const [otherValue, setOtherValue] = useState('');

  const { setOtherText } = useStoreActions();
  const storeDispatch = useStoreDispatch();
  useEffect(() => {
    storeDispatch(setOtherText({ key: response.id, value: otherValue }));
  }, [otherValue, response.id, setOtherText, storeDispatch]);

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
      <Group gap="lg" align="flex-end" mt={horizontal ? 0 : 'sm'}>
        {leftLabel ? <Text>{leftLabel}</Text> : null}
        <HorizontalHandler horizontal={!!horizontal} style={{ flexGrow: 1 }}>
          {optionsAsStringOptions.map((radio) => (
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
              {horizontal && <Text size="sm">{radio.label}</Text>}
              <Radio
                disabled={disabled}
                value={radio.value}
                label={radio.label}
                styles={{
                  label: { display: 'none' },
                }}
                onChange={() => setOtherSelected(false)}
              />
              {!horizontal && <Text size="sm">{radio.label}</Text>}
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
                label={!horizontal && <Input mt={-8} placeholder="Other" disabled={!otherSelected} value={otherValue} onChange={(event) => setOtherValue(event.currentTarget.value)} />}
                mt={0}
              />
            </div>
          )}
        </HorizontalHandler>
        <Text>{rightLabel}</Text>
      </Group>
      {horizontal && withOther && (
        <Input mt="sm" placeholder="Other" disabled={!otherSelected} value={otherValue} onChange={(event) => setOtherValue(event.currentTarget.value)} w={216} />
      )}
    </Radio.Group>
  );
}
