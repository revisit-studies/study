import {
  Flex, FocusTrap, Radio,
} from '@mantine/core';
import { useMemo } from 'react';
import ClearSelectionButton from './ClearSelectionButton';
import { ButtonsResponse, ParsedStringOption } from '../../parser/types';
import classes from './css/ButtonsInput.module.css';
import { useStoredAnswer } from '../../store/hooks/useStoredAnswer';
import { InputLabel } from './InputLabel';
import { OptionLabel } from './OptionLabel';
import { parseStringOptions } from '../../utils/stringOptions';

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
  answer: { value?: string; onChange?: (value: string) => void };
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
  } = response;

  const storedAnswer = useStoredAnswer();
  const optionOrders: Record<string, ParsedStringOption[]> = useMemo(() => storedAnswer?.optionOrders ?? {}, [storedAnswer]);

  const orderedOptions = useMemo(
    () => parseStringOptions(optionOrders[response.id] || options),
    [optionOrders, options, response.id],
  );

  return (
    <FocusTrap>
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
              <ClearSelectionButton onClick={() => answer?.onChange?.('')} disabled={disabled} visible={!!answer?.value} />
            )}
          />
        )}
        description={secondaryText}
        key={response.id}
        value={answer?.value}
        onChange={answer?.onChange}
        error={error}
        errorProps={{ c: required ? 'red' : 'orange', fz: 'sm', mt: 'xs' }}
        style={{ '--input-description-size': 'calc(var(--mantine-font-size-md) - calc(0.125rem * var(--mantine-scale)))' }}
      >
        <Flex justify="space-between" align="center" gap="xl" mt="xs">
          {orderedOptions.map((radio, idx) => (
            <Radio.Card
              key={`radio-${idx}`}
              value={radio.value}
              disabled={disabled}
              ta="center"
              className={classes.root}
              p="xs"
            >
              <OptionLabel label={radio.label} infoText={radio.infoText} button />
            </Radio.Card>
          ))}
        </Flex>
      </Radio.Group>
    </FocusTrap>
  );
}
