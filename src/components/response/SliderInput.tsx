import {
  Box, Flex, Input, Slider, SliderProps, Tooltip,
} from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useMove } from '@mantine/hooks';
import { SliderResponse } from '../../parser/types';
import classes from './css/SliderInput.module.css';
import { InputLabel } from './InputLabel';
import { generateSliderBreakValues, getSliderValueFromPosition } from './sliderBreaks';

export function SliderInput({
  response,
  disabled,
  answer,
  error,
  index,
  enumerateQuestions,
}: {
  response: SliderResponse;
  disabled: boolean;
  answer: { value?: number; onChange?: (value: number) => void };
  error?: string | null;
  index: number;
  enumerateQuestions: boolean;
}) {
  const {
    prompt,
    required,
    options,
    secondaryText,
    infoText,
    snap,
    step,
    withBar,
    tlxStyle,
    smeqStyle,
    spacing,
  } = response;

  const [min, max] = useMemo(() => [Math.min(...options.map((opt) => opt.value)), Math.max(...options.map((opt) => opt.value))], [options]);
  const hasLabels = options.some((opt) => opt.label !== '');

  // Numeric label
  const labelValues = useMemo(
    () => generateSliderBreakValues(min, max, spacing),
    [min, max, spacing],
  );
  const smeqLabelValues = useMemo(
    () => [min, ...labelValues, max],
    [min, max, labelValues],
  );
  const sliderMarkValues = useMemo(
    () => [...labelValues, ...options.map((option) => option.value)],
    [labelValues, options],
  );

  // For smeq style (vertical slider)
  const [val, setVal] = useState((answer as { value?: number }).value ?? (min + max) / 2);
  const normalizedValue = (val - min) / (max - min);
  // null is for hidden hover preview value (e.g. the user has not yet selected a value)
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  useEffect(() => {
    setVal(answer.value ?? (min + max) / 2);
  }, [answer.value, max, min]);

  useEffect(() => {
    if (disabled) {
      setHoverValue(null);
    }
  }, [disabled]);

  const updateHoverValue = (
    event: ReactMouseEvent<HTMLDivElement>,
    // horizontal is for nasa-tlx style, vertical is for smeq style
    orientation: 'horizontal' | 'vertical',
  ) => {
    if (disabled) {
      setHoverValue(null);
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const size = orientation === 'vertical' ? bounds.height : bounds.width;
    if (size === 0) {
      return;
    }

    // pointerPosition is a value between 0 and 1, where 0 is the left (or bottom) of the slider and 1 is the right (or top) of the slider
    const pointerPosition = orientation === 'vertical'
      ? 1 - (event.clientY - bounds.top) / bounds.height
      : (event.clientX - bounds.left) / bounds.width;

    const nextHoverValue = getSliderValueFromPosition(
      pointerPosition,
      min,
      max,
      step,
      snap ? sliderMarkValues : undefined,
    );

    setHoverValue(nextHoverValue);
  };

  const { ref } = useMove(({ y }) => {
    if (disabled) {
      return;
    }

    const snappedValue = getSliderValueFromPosition(
      1 - y,
      min,
      max,
      step,
      snap ? sliderMarkValues : undefined,
    );
    if (snappedValue === null) {
      return;
    }
    setVal(snappedValue);
    answer.onChange?.(snappedValue);
  });

  const horizontalSlider = (
    <Slider
      disabled={disabled}
      marks={[...labelValues.map((value) => ({ value })), ...options] as SliderProps['marks']}
      min={min}
      max={max}
      step={step ?? (snap ? 0.001 : (max - min) / 100)}
      h={hasLabels ? 40 : undefined}
      {...answer}
      classNames={{
        track: tlxStyle ? classes.track : '',
        bar: classes.fixDisabled,
        thumb: tlxStyle ? classes.fixDisabledThumb : '',
      }}
      restrictToMarks={snap}
      label={(value) => value}
      showLabelOnHover={!tlxStyle}
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
      flex={tlxStyle ? undefined : 1}
      mt={tlxStyle ? 0 : 'xs'}
    />
  );

  return (
    <Input.Wrapper
      label={prompt.length > 0 && <InputLabel prompt={prompt} required={required} index={index} enumerateQuestions={enumerateQuestions} infoText={infoText} />}
      description={secondaryText}
      error={error}
      style={{ '--input-description-size': 'calc(var(--mantine-font-size-md) - calc(0.125rem * var(--mantine-scale)))' }}
      errorProps={{ c: required ? 'red' : 'orange', fz: 'sm', mt: 'xs' }}
    >
      {/* Vertical slider for SMEQ style */}
      {smeqStyle ? (
        <Box style={{ overflow: 'hidden' }}>
          <Flex direction="row" align="flex-start" gap="sm" m="md" justify="center" wrap="nowrap">
            {/* Label */}
            <Box style={{
              height: 450, position: 'relative', minWidth: 30, textAlign: 'right', flexShrink: 0,
            }}
            >
              {smeqLabelValues.map((label) => {
                const labelPosition = ((label - min) / (max - min)) * 100;
                return (
                  <Box
                    key={label}
                    style={{
                      position: 'absolute',
                      bottom: `${labelPosition}%`,
                      fontSize: 'var(--mantine-font-size-xs)',
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
              data-testid="smeq-slider-track"
              aria-disabled={disabled}
              style={{
                width: 22,
                height: 450,
                position: 'relative',
                flexShrink: 0,
                pointerEvents: disabled ? 'none' : undefined,
              }}
              onMouseMove={(event) => updateHoverValue(event, 'vertical')}
              onMouseLeave={() => setHoverValue(null)}
            >
              {/* smeq vertical bar will always be withBar = true */}
              <Box
                data-testid="smeq-slider-thumb"
                style={{
                  position: 'absolute',
                  left: 20,
                  top: 0,
                  width: 2,
                  height: '100%',
                  backgroundColor: 'var(--mantine-color-gray-5)',
                }}
              />

              {/* Mark - numeric label */}
              {labelValues.map((value) => {
                const markPosition = ((value - min) / (max - min)) * 100;
                return (
                  <Box
                    key={value}
                    style={{
                      position: 'absolute',
                      bottom: `${markPosition}%`,
                      left: 2,
                      width: 20,
                      height: 1,
                      backgroundColor: 'var(--mantine-color-gray-7)',
                      transform: 'translateY(50%)',
                    }}
                  />
                );
              })}

              {/* Mark - value */}
              {options.map((option) => {
                const markPosition = ((option.value - min) / (max - min)) * 100;
                return (
                  <Box
                    key={option.value}
                    style={{
                      position: 'absolute',
                      bottom: `${markPosition}%`,
                      left: option.label !== '' ? 20 : 2,
                      width: 20,
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
              />

              {hoverValue !== null && (
                <Tooltip label={hoverValue} opened position="right" withArrow>
                  <Box
                    style={{
                      backgroundColor: 'var(--mantine-color-black)',
                      width: 20,
                      height: 1,
                      border: '1px solid var(--mantine-color-black)',
                      position: 'absolute',
                      left: 0,
                      bottom: `calc(${((hoverValue - min) / (max - min)) * 100}% - 1px)`,
                      pointerEvents: 'none',
                      zIndex: 4,
                    }}
                  />
                </Tooltip>
              )}
            </Box>

            {/* Mark label */}
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
                      fontSize: 'var(--mantine-font-size-xs)',
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
        </Box>
      ) : tlxStyle ? (
        <Box
          flex={1}
          mt="sm"
          style={{ position: 'relative' }}
          onMouseMove={(event) => updateHoverValue(event, 'horizontal')}
          onMouseLeave={() => setHoverValue(null)}
        >
          {horizontalSlider}
          {hoverValue !== null && (
            <Tooltip label={hoverValue} opened position="top" withArrow>
              <Box
                style={{
                  backgroundColor: 'var(--mantine-color-black)',
                  width: 1,
                  height: 22,
                  border: '1px solid var(--mantine-color-black)',
                  position: 'absolute',
                  left: `${((hoverValue - min) / (max - min)) * 100}%`,
                  top: '50%',
                  transform: 'translate(-50%, -62%)',
                  pointerEvents: 'none',
                  zIndex: 4,
                }}
              />
            </Tooltip>
          )}
        </Box>
      ) : horizontalSlider}
    </Input.Wrapper>
  );
}
