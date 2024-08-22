import {
  Box, Checkbox, Flex, Group,
} from '@mantine/core';
import { CheckboxResponse } from '../../parser/types';
import { generateErrorMessage } from './utils';
import ReactMarkdownWrapper from '../ReactMarkdownWrapper';

export default function CheckBoxInput({
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
  } = response;

  const optionsAsStringOptions = options.map((option) => (typeof option === 'string' ? { value: option, label: option } : option));

  return (
    <Checkbox.Group
      label={(
        <Flex direction="row" wrap="nowrap" gap={4}>
          {enumerateQuestions && <Box style={{ minWidth: 'fit-content' }}>{`${index}. `}</Box>}
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
        {optionsAsStringOptions.map((option) => (
          <Checkbox
            key={option.value}
            disabled={disabled}
            value={option.value}
            label={option.label}
          />
        ))}
      </Group>
    </Checkbox.Group>
  );
}
