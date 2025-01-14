import {
  Box, Checkbox, Flex, Group,
  Input,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { CheckboxResponse } from '../../parser/types';
import { generateErrorMessage } from './utils';
import { ReactMarkdownWrapper } from '../ReactMarkdownWrapper';
import { HorizontalHandler } from './HorizontalHandler';
import { useStoreActions, useStoreDispatch } from '../../store/store';

export function CheckBoxInput({
  response,
  disabled,
  answer,
  index,
  enumerateQuestions,
}: {
  response: CheckboxResponse;
  disabled: boolean;
  answer: object;
  index: number;
  enumerateQuestions: boolean;
}) {
  const {
    prompt,
    required,
    options,
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
    <Checkbox.Group
      label={(
        <Flex direction="row" wrap="nowrap" gap={4}>
          {enumerateQuestions && <Box style={{ minWidth: 'fit-content', fontSize: 16, fontWeight: 500 }}>{`${index}. `}</Box>}
          <Box style={{ display: 'block' }} className="no-last-child-bottom-padding">
            <ReactMarkdownWrapper text={prompt} required={required} />
          </Box>
        </Flex>
      )}
      description={secondaryText}
      {...answer}
      error={generateErrorMessage(response, answer, optionsAsStringOptions)}
      style={{ '--input-description-size': 'calc(var(--mantine-font-size-md) - calc(0.125rem * var(--mantine-scale)))' }}
    >
      <Group mt="xs">
        <HorizontalHandler horizontal={!!horizontal} style={{ flexGrow: 1 }}>
          {optionsAsStringOptions.map((option) => (
            <Checkbox
              key={option.value}
              disabled={disabled}
              value={option.value}
              label={option.label}
            />
          ))}
          {withOther && (
            <Checkbox
              key="__other"
              disabled={disabled}
              value="__other"
              checked={otherSelected}
              onClick={(event) => setOtherSelected(event.currentTarget.checked)}
              label={<Input mt={-8} placeholder="Other" disabled={!otherSelected} value={otherValue} onChange={(event) => setOtherValue(event.currentTarget.value)} />}
            />
          )}
        </HorizontalHandler>
      </Group>
    </Checkbox.Group>
  );
}
