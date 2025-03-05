import {
  Box, Flex, Input, Slider, SliderProps,
} from '@mantine/core';
import { useMemo } from 'react';
import { SliderResponse } from '../../parser/types';
import { generateErrorMessage } from './utils';
import { ReactMarkdownWrapper } from '../ReactMarkdownWrapper';
import classes from './css/SliderInput.module.css';

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
    snap,
    step,
    withBar,
    tlxStyle,
  } = response;

  const [min, max] = useMemo(() => [Math.min(...options.map((opt) => opt.value)), Math.max(...options.map((opt) => opt.value))], [options]);
  const hasLabels = options.some((opt) => opt.label !== '');
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
        step={step ?? (snap ? 0.001 : (max - min) / 100)}
        h={hasLabels ? 40 : undefined}
        {...answer}
        classNames={{ track: tlxStyle ? classes.track : '', bar: classes.fixDisabled }}
        restrictToMarks={snap}
        label={(value) => (snap ? null : value)}
        styles={(theme) => ({
          mark: {
            ...(tlxStyle ? {
              height: 20, width: 1, marginTop: -6, marginLeft: 2, borderRadius: 0,
            } : {}),
            ...(withBar === false ? { borderColor: 'var(--mantine-color-gray-2)' } : {}),
          },
          bar: withBar === false || tlxStyle ? { display: 'none' } : {},
          markLabel: {
            fontSize: theme.fontSizes.sm,
            color: theme.colors.gray[7],
            transform: 'translate(calc((var(--mark-offset) * -1) + (var(--slider-size) / 2)), calc(var(--mantine-spacing-xs) / 2)',
          },
          // Red line thumb style
          thumb: {
            ...(tlxStyle ? {
              borderColor: 'var(--mantine-color-red-6)',
              width: 1,
              borderWidth: 1,
              height: 22,
              borderRadius: 0,
              backgroundColor: 'var(--mantine-color-red-6)',
              transform: 'translate(-50%, -62%)',
            } : {}),
          },
        })}
        flex={1}
        mt={tlxStyle ? 'sm' : 'xs'}
      />
    </Input.Wrapper>
  );
}
