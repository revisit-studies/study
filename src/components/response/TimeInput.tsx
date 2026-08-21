import { ActionIcon } from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import type { ChangeEventHandler, FocusEventHandler } from 'react';
import { useRef } from 'react';
import { IconClock } from '@tabler/icons-react';
import type { TimeResponse } from '../../parser/types';
import classes from './css/Input.module.css';
import { InputLabel } from './InputLabel';

type TimeResponseAnswer = {
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  onFocus?: FocusEventHandler<HTMLInputElement>;
  readOnly?: boolean;
};

export function TimeResponseInput({
  response,
  disabled,
  answer,
  error,
  index,
  enumerateQuestions,
}: {
  response: TimeResponse;
  disabled: boolean;
  answer: TimeResponseAnswer;
  error?: string | null;
  index: number;
  enumerateQuestions: boolean;
}) {
  const {
    placeholder = 'HH:mm',
    prompt,
    required,
    secondaryText,
    infoText,
  } = response;
  const value = answer.value ?? '';
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerControl = (
    <ActionIcon
      variant="subtle"
      color="gray"
      disabled={disabled}
      aria-label="Open time picker"
      onClick={() => inputRef.current?.showPicker?.()}
    >
      <IconClock size={16} stroke={1.5} />
    </ActionIcon>
  );

  return (
    <TimeInput
      ref={inputRef}
      {...answer}
      disabled={disabled}
      placeholder={placeholder}
      label={prompt.length > 0 && <InputLabel prompt={prompt} required={required} index={index} enumerateQuestions={enumerateQuestions} infoText={infoText} />}
      description={secondaryText}
      radius="md"
      size="md"
      value={value}
      rightSection={pickerControl}
      error={error}
      withErrorStyles={required}
      errorProps={{ c: required ? 'red' : 'orange', fz: 'sm', mt: 'xs' }}
      classNames={{ input: classes.fixDisabled }}
    />
  );
}
