import {
  Box,
  Flex,
  Input, Slider, SliderProps,
} from '@mantine/core';
import { useMemo } from 'react';
import { SliderResponse } from '../../parser/types';
import { generateErrorMessage } from './utils';
import { ReactMarkdownWrapper } from '../ReactMarkdownWrapper';
import classes from './SliderInput.module.css';

export function SliderInput({
  response,
  disabled,
  answer,
  index,
  enumerateQuestions,
}: {
  response: SliderResponse;
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

  const [min, max] = useMemo(() => [Math.min(...options.map((opt) => opt.value)), Math.max(...options.map((opt) => opt.value))], [options]);

  const errorMessage = generateErrorMessage(response, answer);
  return (
    <Input.Wrapper
      label={(
        <Flex direction="row" wrap="nowrap" gap={4}>
          {enumerateQuestions && <Box style={{ minWidth: 'fit-content', fontSize: 16, fontWeight: 500 }}>{`${index}. `}</Box>}
          <Box style={{ display: 'block' }} className="no-last-child-bottom-padding">
            <ReactMarkdownWrapper text={prompt} required={required} />
          </Box>
        </Flex>
      )}
      description={secondaryText}
      error={errorMessage}
      style={{ '--input-description-size': 'calc(var(--mantine-font-size-md) - calc(0.125rem * var(--mantine-scale)))' }}
    >
      <Slider
        disabled={disabled}
        marks={options as SliderProps['marks']}
        min={min}
        max={max}
        {...answer}
        h={40}
        mt={4}
        classNames={{ markLabel: classes.markLabel }}
      />
    </Input.Wrapper>
  );
}
