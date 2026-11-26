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
import { getButtonRowSizes } from './buttonLayout';

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
  const [buttonRows, setButtonRows] = useState<number[]>([1]);
  const buttonColumns = Math.max(...buttonRows);
  const [minimumButtonWidth, setMinimumButtonWidth] = useState(48);
  const [buttonGap, setButtonGap] = useState('var(--mantine-spacing-xl)');

  useEffect(() => {
    const container = buttonsRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return undefined;

    const updateRows = () => {
      const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-button-option]'));
      if (buttons.length < 2) {
        setButtonRows([Math.max(1, buttons.length)]);
        return;
      }
      const grid = container.querySelector<HTMLElement>('[data-button-grid]');
      if (!grid) return;
      const containerStyle = getComputedStyle(container);
      const availableWidth = container.clientWidth
        - Number.parseFloat(containerStyle.paddingLeft)
        - Number.parseFloat(containerStyle.paddingRight);
      const previousColumnGap = grid.style.columnGap;
      const previousRowGap = grid.style.rowGap;
      const previousColumns = grid.style.gridTemplateColumns;
      const previousWidth = grid.style.width;
      const previousStyles = buttons.map((button) => ({
        width: button.style.width,
        minWidth: button.style.minWidth,
        gridColumn: button.style.gridColumn,
        gridRow: button.style.gridRow,
      }));
      grid.style.columnGap = 'var(--mantine-spacing-xl)';
      const regularGap = Number.parseFloat(getComputedStyle(grid).columnGap) || 0;
      grid.style.columnGap = 'var(--mantine-spacing-xs)';
      const compactGap = Number.parseFloat(getComputedStyle(grid).columnGap) || 0;
      grid.style.gridTemplateColumns = `repeat(${buttons.length}, max-content)`;
      grid.style.width = 'max-content';
      buttons.forEach((button) => {
        button.style.width = 'max-content';
        button.style.minWidth = '0';
        button.style.gridColumn = '';
        button.style.gridRow = '';
      });
      const optionWidths = buttons.map((button) => button.getBoundingClientRect().width);
      buttons.forEach((button, buttonIndex) => {
        button.style.width = previousStyles[buttonIndex].width;
        button.style.minWidth = previousStyles[buttonIndex].minWidth;
        button.style.gridColumn = previousStyles[buttonIndex].gridColumn;
        button.style.gridRow = previousStyles[buttonIndex].gridRow;
      });
      grid.style.gridTemplateColumns = previousColumns;
      grid.style.width = previousWidth;
      grid.style.columnGap = previousColumnGap;
      grid.style.rowGap = previousRowGap;
      const keyMinimumWidths = buttons.map((button) => {
        const keyIndicator = button.querySelector<HTMLElement>('[data-key-indicator]');
        if (!keyIndicator) return 50;
        const icon = keyIndicator.querySelector('svg');
        return 50 + 21 + (icon?.getBoundingClientRect().width ?? 0);
      });
      const nextMinimumWidth = Math.max(...keyMinimumWidths);
      const rowsWithRegularGap = getButtonRowSizes(optionWidths, availableWidth, regularGap, nextMinimumWidth);
      const rowsWithCompactGap = getButtonRowSizes(optionWidths, availableWidth, compactGap, nextMinimumWidth);
      const fitsWithRegularGap = rowsWithRegularGap.length === 1;
      const nextButtonRows = fitsWithRegularGap ? rowsWithRegularGap : rowsWithCompactGap;
      const nextButtonGap = fitsWithRegularGap ? 'var(--mantine-spacing-xl)' : 'var(--mantine-spacing-xs)';
      setMinimumButtonWidth(nextMinimumWidth);
      setButtonRows(nextButtonRows);
      setButtonGap(nextButtonGap);
    };

    const observer = new ResizeObserver(updateRows);
    observer.observe(container);
    updateRows();
    return () => observer.disconnect();
  }, [orderedOptions]);

  const buttonPositions: { row: number; column: number; offsetHalfColumn: boolean }[] = [];
  buttonRows.forEach((rowSize, row) => {
    const columnDifference = buttonColumns - rowSize;
    const rowOffset = Math.floor(columnDifference / 2);
    for (let column = 0; column < rowSize; column += 1) {
      buttonPositions.push({
        row: row + 1,
        column: rowOffset + column + 1,
        offsetHalfColumn: columnDifference % 2 === 1,
      });
    }
  });

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
      <div
        ref={buttonsRef}
        data-button-scroll-region
        style={{
          width: '100%',
          minWidth: 0,
          padding: '4px',
          boxSizing: 'border-box',
          marginTop: 'var(--mantine-spacing-xs)',
          overflowX: 'auto',
        }}
      >
        <div
          data-button-grid
          style={{
            display: 'grid',
            width: '100%',
            gridTemplateColumns: `repeat(${buttonColumns}, minmax(${minimumButtonWidth}px, 1fr))`,
            columnGap: buttonGap,
            rowGap: '18px',
          }}
        >
          {orderedOptions.map((radio, idx) => {
            const hasKeyVisual = !hideKeyVisual && Boolean(radio.key);
            const position = buttonPositions[idx];
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
                  width: '100%',
                  overflow: 'hidden',
                  padding: 0,
                  minWidth: `${minimumButtonWidth}px`,
                  gridColumn: position?.column,
                  gridRow: position?.row,
                  transform: position?.offsetHalfColumn
                    ? `translateX(calc((100% + ${buttonGap}) / 2))`
                    : undefined,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'stretch',
                    minHeight: 'var(--response-button-min-height)',
                  }}
                >
                  <Flex
                    align="center"
                    justify="center"
                    gap="xs"
                    style={{
                      flex: 1,
                      minWidth: 24,
                      padding: '6px 12px',
                    }}
                  >
                    <OptionLabel label={radio.label} infoText={radio.infoText} button fw={700} />
                  </Flex>

                  {hasKeyVisual && (
                    <Flex
                      align="center"
                      justify="center"
                      data-key-indicator
                      style={{
                        flexShrink: 1,
                        minWidth: 0,
                        maxWidth: 'calc(100% - 48px)',
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
                        <span style={{ minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' }}>
                          {formatKeyForDisplay(radio.key as never)}
                        </span>
                      </Kbd>
                    </Flex>
                  )}
                </div>
              </Radio.Card>
            );
          })}
        </div>
      </div>
    </Radio.Group>
  );
}
