import {
  Flex, Kbd, Radio,
} from '@mantine/core';
import {
  IconArrowDown, IconArrowLeft, IconArrowRight, IconArrowUp,
} from '@tabler/icons-react';
import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';
import ClearSelectionButton from './ClearSelectionButton';
import { ButtonsResponse, ParsedStringOption } from '../../parser/types';
import classes from './css/ButtonsInput.module.css';
import { useStoredAnswer } from '../../store/hooks/useStoredAnswer';
import { InputLabel } from './InputLabel';
import { OptionLabel } from './OptionLabel';
import { parseStringOptions } from '../../utils/stringOptions';
import { KeyMapper } from './KeyMapper';
import { getButtonColumnSpans, getButtonRowSizes } from './buttonLayout';

const renderSymbol = (symbol: string) => (
  <span
    style={{
      fontSize: '1.4em',
      verticalAlign: '-0.09em',
    }}
  >
    {symbol}
  </span>
);
const renderArrow = (Icon: typeof IconArrowLeft) => (
  <Icon size={18} stroke={2.5} style={{ verticalAlign: 'middle' }} />
);

function formatKeyForDisplay(key: string): React.ReactNode {
  const k = key.toLowerCase().trim();
  if (k.includes('+')) {
    return k
      .split('+')
      .map((part, index, array) => (
        <React.Fragment key={index}>
          {formatKeyForDisplay(part)}
          {index < array.length - 1 && '+'}
        </React.Fragment>
      ));
  }

  switch (k) {
    case 'arrowleft':
      return renderArrow(IconArrowLeft);
    case 'arrowright':
      return renderArrow(IconArrowRight);
    case 'arrowup':
      return renderArrow(IconArrowUp);
    case 'arrowdown':
      return renderArrow(IconArrowDown);
    case 'enter':
    case 'return':
      return renderSymbol('↵');
    case 'backspace':
      return renderSymbol('⌫');
    case 'delete':
    case 'del':
      return renderSymbol('⌦');
    case 'escape':
    case 'esc':
      return 'Esc';
    case 'tab':
      return renderSymbol('⇥');
    case 'space':
      return renderSymbol('⎵');
    case 'capslock':
    case 'caps':
      return renderSymbol('⇪');
    case 'shift':
      return renderSymbol('⇧');
    case 'control':
    case 'ctrl':
      return 'Ctrl';
    case 'alt':
      return 'Alt';
    case 'meta':
    case 'cmd':
    case 'command':
      return renderSymbol('⌘');
    default:
      return key.toUpperCase();
  }
}

export function ButtonsInput({
  response,
  disabled,
  answer,
  error,
  index,
  enumerateQuestions,
}: {
  response: ButtonsResponse;
  disabled: boolean;
  answer: { value?: string; onChange?: (value: string, source?: 'keyboard' | 'click') => void };
  error?: string | null;
  index: number;
  enumerateQuestions: boolean;
}) {
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const buttonsRef = useRef<HTMLDivElement>(null);
  const [buttonRows, setButtonRows] = useState(1);
  const {
    prompt,
    required,
    secondaryText,
    options,
    infoText,
    hideKeyVisual = false,
  } = response;

  const storedAnswer = useStoredAnswer();
  const optionOrders: Record<string, ParsedStringOption[]> = useMemo(() => storedAnswer?.optionOrders ?? {}, [storedAnswer]);

  const orderedOptions = useMemo(
    () => parseStringOptions(optionOrders[response.id] || options),
    [optionOrders, options, response.id],
  );
  const buttonRowSizes = buttonRows === 1
    ? [orderedOptions.length]
    : [Math.ceil(orderedOptions.length / 2), Math.floor(orderedOptions.length / 2)];
  const buttonColumnSpans = getButtonColumnSpans(orderedOptions.length, buttonRowSizes);

  useEffect(() => {
    const container = buttonsRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return undefined;

    const updateRows = () => {
      const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-button-option]'));
      if (buttons.length < 2) {
        setButtonRows(1);
        return;
      }
      const containerStyle = getComputedStyle(container);
      const availableWidth = container.clientWidth
        - Number.parseFloat(containerStyle.paddingLeft)
        - Number.parseFloat(containerStyle.paddingRight);
      const previousColumns = container.style.gridTemplateColumns;
      const previousSpans = buttons.map((button) => button.style.gridColumn);
      container.style.gridTemplateColumns = `repeat(${buttons.length}, max-content)`;
      buttons.forEach((button) => {
        button.style.gridColumn = 'auto';
      });
      const optionWidths = buttons.map((button) => button.getBoundingClientRect().width);
      container.style.gridTemplateColumns = previousColumns;
      buttons.forEach((button, buttonIndex) => {
        button.style.gridColumn = previousSpans[buttonIndex];
      });
      setButtonRows(getButtonRowSizes(optionWidths, availableWidth, Number.parseFloat(containerStyle.columnGap) || 0).length);
    };

    const observer = new ResizeObserver(updateRows);
    observer.observe(container);
    updateRows();
    return () => observer.disconnect();
  }, [orderedOptions]);

  const handleValueChange = (value: string, source: 'keyboard' | 'click' = 'click') => {
    answer?.onChange?.(value, source);
  };

  const startArrowNavigation = () => {
    const selectedOption = orderedOptions.find((option) => option.value === answer?.value);
    const optionToFocus = selectedOption ?? orderedOptions[0];
    optionRefs.current[optionToFocus.value]?.focus();

    if (!selectedOption) {
      handleValueChange(optionToFocus.value, 'keyboard');
    }
  };

  return (
    <Radio.Group
      name={`radioInput${response.id}`}
      label={prompt.length > 0 && (
        <InputLabel
          prompt={prompt}
          required={required}
          index={index}
          enumerateQuestions={enumerateQuestions}
          infoText={infoText}
          clearSelectionButton={(
            <ClearSelectionButton onClick={() => handleValueChange('')} disabled={disabled} visible={!!answer?.value} />
          )}
        />
      )}
      description={secondaryText}
      key={response.id}
      value={answer?.value}
      onChange={(value) => handleValueChange(value, 'click')}
      error={error}
      errorProps={{ c: required ? 'red' : 'orange', fz: 'sm', mt: 'xs' }}
      style={{ '--input-description-size': 'calc(var(--mantine-font-size-md) - calc(0.125rem * var(--mantine-scale)))' }}
    >
      <KeyMapper
        options={orderedOptions}
        onSelect={(val, source) => handleValueChange(val, source ?? 'keyboard')}
        onArrowNavigation={startArrowNavigation}
        disabled={disabled}
      />
      <Flex
        ref={buttonsRef}
        justify="space-between"
        align="stretch"
        gap="md"
        mt="xs"
        p="4px"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${buttonRowSizes[0] * buttonColumnSpans[0]}, minmax(0, 1fr))`,
        }}
      >
        {orderedOptions.map((radio, idx) => {
          const hasKeyVisual = !hideKeyVisual && Boolean(radio.key);

          return (
            <Radio.Card
              key={`radio-${idx}`}
              value={radio.value}
              disabled={disabled}
              ref={(node) => {
                if (node) {
                  optionRefs.current[radio.value] = node;
                } else {
                  delete optionRefs.current[radio.value];
                }
              }}
              className={classes.root}
              data-button-option
              style={{
                gridColumn: `span ${buttonColumnSpans[idx]}`,
                minWidth: 0,
                overflow: 'visible',
                padding: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  minHeight: 'var(--response-button-min-height)',
                }}
              >
                <Flex
                  align="center"
                  justify="center"
                  gap="xs"
                  style={{ flex: 1, minWidth: 0, padding: '6px 8px' }}
                >
                  <OptionLabel label={radio.label} infoText={radio.infoText} button fw={700} />
                </Flex>

                {hasKeyVisual && (
                  <Flex
                    align="center"
                    justify="center"
                    style={{
                      flexShrink: 0,
                      alignSelf: 'stretch',
                    }}
                  >
                    <Kbd
                      size="xs"
                      aria-hidden="true"
                      style={{
                        color: 'inherit',
                        boxShadow: 'none',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 600,
                        padding: '0 10px',
                        alignSelf: 'stretch',
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: 0,
                        borderLeft: '1px solid rgba(255, 255, 255, 0.25)',
                        backgroundColor: 'rgba(0, 0, 0, 0.08)',
                      }}
                    >
                      {formatKeyForDisplay(radio.key as never)}
                    </Kbd>
                  </Flex>
                )}
              </div>
            </Radio.Card>
          );
        })}
      </Flex>
    </Radio.Group>
  );
}
