import {
  Box, Flex, Input, Slider, SliderProps,
} from '@mantine/core';
import { useMemo, useState } from 'react';
import { useMove } from '@mantine/hooks';
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
    smeqStyle,
  } = response;

  const [min, max] = useMemo(() => [Math.min(...options.map((opt) => opt.value)), Math.max(...options.map((opt) => opt.value))], [options]);
  const hasLabels = options.some((opt) => opt.label !== '');
  const errorMessage = generateErrorMessage(response, answer);

  // For smeq style (vertical slider)
  const [val, setVal] = useState((answer as { value?: number }).value ?? (min + max) / 2);
  const normalizedValue = (val - min) / (max - min);
  const [hovered, setHovered] = useState(false);

  // Numeric labels of multiples of 10 for smeq style
  const labelValues = useMemo(() => {
    const start = Math.ceil(min / 10) * 10;
    const count = Math.floor((max - start) / 10) + 1;
    return Array.from({ length: count }, (_, i) => start + i * 10);
  }, [min, max]);

  const { ref } = useMove(({ y }) => {
    // Convert y position to slider value
    const rawValue = Math.max(min, Math.min(max, min + (1 - y) * (max - min)));
    const stepSize = step ?? (snap ? 0.001 : (max - min) / 100);
    // Round to nearest step
    const snappedValue = Math.round((rawValue - min) / stepSize) * stepSize + min;
    setVal(snappedValue);
    (answer as { onChange?: (value: number) => void })?.onChange?.(snappedValue);
  });

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
      {/* Vertical slider for SMEQ style */}
      {smeqStyle ? (
        <Flex direction="row" align="flex-start" gap="md" mt="md" justify="center">
          {/* Numeric labels (multiples of 10 within min-max range) ex: 0, 10, 20, 30, ... */}
          <Box style={{
            height: 450, position: 'relative', minWidth: 50, textAlign: 'right',
          }}
          >
            {labelValues.map((label) => {
              const labelPosition = ((label - min) / (max - min)) * 100;
              return (
                <Box
                  key={label}
                  style={{
                    position: 'absolute',
                    bottom: `${labelPosition}%`,
                    fontSize: 'var(--mantine-font-size-sm)',
                    color: 'var(--mantine-color-gray-7)',
                    right: 0,
                    transform: 'translateY(50%)',
                  }}
                >
                  {label}
                </Box>
              );
            })}
          </Box>

          {/* Slider track */}
          <Box
            ref={ref}
            style={{
              width: 22,
              height: 450,
              position: 'relative',
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            {/* smeq vertical bar will always be withBar = true */}
            <Box
              style={{
                position: 'absolute',
                left: 20,
                top: 0,
                width: 2,
                height: '100%',
                backgroundColor: 'var(--mantine-color-gray-5)',
              }}
            />

            {/* Marks */}
            {options.map((option) => {
              const markPosition = ((option.value - min) / (max - min)) * 100;
              return (
                <Box
                  key={option.value}
                  style={{
                    position: 'absolute',
                    bottom: `${markPosition}%`,
                    left: option.label !== '' ? 20 : 2,
                    width: option.label !== '' ? 30 : 20,
                    height: 1,
                    backgroundColor: 'var(--mantine-color-gray-7)',
                    transform: 'translateY(50%)',
                  }}
                />
              );
            })}

            {/* Thumb */}
            <Box
              style={{
                backgroundColor: 'var(--mantine-color-red-6)',
                width: 20,
                height: 1,
                border: '1px solid var(--mantine-color-red-6)',
                position: 'absolute',
                // -1px to account for the border
                bottom: `calc(${normalizedValue * 100}% - 1px)`,
              }}
            >
              {/* Thumb value label */}
              {hovered && (
                <Box
                  style={{
                    position: 'absolute',
                    left: 40,
                    top: -10,
                    transform: 'translateX(-50%)',
                    background: 'var(--mantine-color-gray-8)',
                    color: 'white',
                    fontSize: 12,
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  {Math.round(val)}
                </Box>
              )}
            </Box>
          </Box>

          {/* Thumb Label */}
          <Box
            style={{
              height: 450,
              position: 'relative',
              minWidth: 200,
            }}
          >
            {options.map((option) => {
              if (!option.label) return null;
              const markPosition = ((option.value - min) / (max - min)) * 100;
              return (
                <Box
                  key={option.value}
                  style={{
                    fontSize: 'var(--mantine-font-size-sm)',
                    color: 'var(--mantine-color-gray-7)',
                    position: 'absolute',
                    bottom: `${markPosition}%`,
                    transform: 'translateY(50%)',
                    left: 20,
                  }}
                >
                  {option.label}
                </Box>
              );
            })}
          </Box>
        </Flex>
      ) : (
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
      )}
    </Input.Wrapper>
  );
}
