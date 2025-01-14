import {
  Box, Flex, Group, Radio, rem, Text,
} from '@mantine/core';
import { RadioResponse } from '../../parser/types';
import { generateErrorMessage } from './utils';
import { ReactMarkdownWrapper } from '../ReactMarkdownWrapper';
import { VerticalHandler } from './VerticalHandler';

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
    vertical,
  } = response;

  const optionsAsStringOptions = options.map((option) => (typeof option === 'string' ? { value: option, label: option } : option));

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
      <Group gap="lg" align="flex-end" mt={vertical ? 'sm' : 0}>
        {leftLabel ? <Text>{leftLabel}</Text> : null}
        <VerticalHandler vertical={!!vertical} style={{ flexGrow: 1 }}>
          {optionsAsStringOptions.map((radio) => (
            <div
              key={radio.label}
              style={{
                display: 'flex',
                flexDirection: vertical ? 'row' : 'column',
                gap: vertical ? rem(12) : 'unset',
                flex: stretch ? 1 : 'unset',
                alignItems: 'center',
              }}
            >
              {!vertical && <Text size="sm">{radio.label}</Text>}
              <Radio
                disabled={disabled}
                value={radio.value}
                label={radio.label}
                styles={{
                  label: { display: 'none' },
                }}
              />
              {vertical && <Text size="sm">{radio.label}</Text>}
            </div>
          ))}
        </VerticalHandler>
        <Text>{rightLabel}</Text>
      </Group>
    </Radio.Group>
  );
}
