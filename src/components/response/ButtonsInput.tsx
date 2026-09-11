import {
  Flex, FocusTrap, Kbd, Radio,
} from '@mantine/core';
import { useMemo, useRef } from 'react';
import ClearSelectionButton from './ClearSelectionButton';
import { ButtonsResponse, ParsedStringOption } from '../../parser/types';
import classes from './css/ButtonsInput.module.css';
import { useStoredAnswer } from '../../store/hooks/useStoredAnswer';
import { InputLabel } from './InputLabel';
import { OptionLabel } from './OptionLabel';
import { parseStringOptions } from '../../utils/stringOptions';
import { KeyMapper } from './KeyMapper';

// could use this if we want the arrow symbols instead of mantine default
function formatKeyForDisplay(key: string): string {
  const k = key.toLowerCase().trim();
  if (k.includes('+')) {
    return k
      .split('+')
      .map((part) => formatKeyForDisplay(part))
      .join('+');
  }

  switch (k) {
    case 'arrowleft':
      return '←';
    case 'arrowright':
      return '→';
    case 'arrowup':
      return '↑';
    case 'arrowdown':
      return '↓';
    case 'enter':
    case 'return':
      return '↵';
    case 'backspace':
      return '⌫';
    case 'delete':
    case 'del':
      return '⌦';
    case 'escape':
    case 'esc':
      return 'Esc';
    case 'tab':
      return '⇥';
    case 'space':
      return '␣';
    case 'capslock':
    case 'caps':
      return '⇪';
    case 'shift':
      return '⇧';
    case 'control':
    case 'ctrl':
      return 'Ctrl';
    case 'alt':
      return 'Alt';
    case 'meta':
    case 'cmd':
    case 'command':
      return '⌘';
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
  answer: { value?: string; onChange?: (value: string) => void; onInteraction?: (source: 'keyboard' | 'click') => void };
  error?: string | null;
  index: number;
  enumerateQuestions: boolean;
}) {
  const {
    prompt,
    required,
    secondaryText,
    options,
    infoText,
    hideKeyVisual = false,
  } = response;

  const storedAnswer = useStoredAnswer();
  const groupRef = useRef<HTMLDivElement>(null);
  const optionOrders: Record<string, ParsedStringOption[]> = useMemo(() => storedAnswer?.optionOrders ?? {}, [storedAnswer]);

  const orderedOptions = useMemo(
    () => parseStringOptions(optionOrders[response.id] || options),
    [optionOrders, options, response.id],
  );

  const handleValueChange = (value: string, source: 'keyboard' | 'click' = 'click') => {
    answer?.onInteraction?.(source);
    answer?.onChange?.(value);
    // answer?.onChange?.(value);
  };

  return (
    <FocusTrap>
      <Radio.Group
        ref={groupRef}
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
          disabled={disabled}
          focusRootRef={groupRef}
        />
        <Flex justify="space-between" align="center" gap="xl" mt="xs">
          {orderedOptions.map((radio, idx) => {
            const hasKeyVisual = !hideKeyVisual && Boolean(radio.key);

            return (
              <Radio.Card
                key={`radio-${idx}`}
                value={radio.value}
                disabled={disabled}
                className={classes.root}
                style={{
                  overflow: 'hidden',
                  padding: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    minHeight: '100%',
                  }}
                >
                  <Flex
                    align="center"
                    justify="center"
                    gap="xs"
                    style={{ flex: 1, padding: '10px 12px' }}
                  >
                    <OptionLabel label={radio.label} infoText={radio.infoText} button />
                  </Flex>

                  {hasKeyVisual && (
                    <Flex
                      align="center"
                      justify="center"
                      style={{
                        flexShrink: 0,
                        padding: '0 12px',
                        borderLeft: '1px solid rgba(255, 255, 255, 0.25)',
                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                      }}
                    >
                      <Kbd
                        size="xs"
                        aria-hidden="true"
                        style={{
                          backgroundColor: 'transparent',
                          color: 'inherit',
                          boxShadow: 'none',
                          border: 'none',
                          fontSize: '10px',
                          fontWeight: 600,
                          padding: 0,
                        }}
                      >
                        {formatKeyForDisplay(radio.key?.toLowerCase() as never)}
                      </Kbd>
                    </Flex>
                  )}
                </div>
              </Radio.Card>
            );
          })}
        </Flex>
      </Radio.Group>
    </FocusTrap>
  );
}
