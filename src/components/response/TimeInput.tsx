import { TimePicker } from '@mantine/dates';
import type { FocusEventHandler } from 'react';
import type { TimeResponse } from '../../parser/types';
import { DATE_TIME_POPOVER_PROPS } from '../../utils/dateTimeValidation';
import classes from './css/Input.module.css';
import { InputLabel } from './InputLabel';

type TimeResponseAnswer = {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: FocusEventHandler<HTMLDivElement>;
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
    prompt,
    required,
    secondaryText,
    infoText,
  } = response;
  const value = answer.value ?? '';

  return (
    <TimePicker
      {...answer}
      disabled={disabled}
      label={prompt.length > 0 && <InputLabel prompt={prompt} required={required} index={index} enumerateQuestions={enumerateQuestions} infoText={infoText} />}
      description={secondaryText}
      radius="md"
      size="md"
      value={value}
      format={response.format ?? '24h'}
      withDropdown
      popoverProps={DATE_TIME_POPOVER_PROPS}
      withSeconds={response.withSeconds}
      hoursInputLabel={`${prompt} hours`}
      minutesInputLabel={`${prompt} minutes`}
      secondsInputLabel={`${prompt} seconds`}
      amPmInputLabel={`${prompt} am/pm`}
      min={response.min}
      max={response.max}
      clearable
      error={error}
      withErrorStyles={required}
      errorProps={{ c: required ? 'red' : 'orange', fz: 'sm', mt: 'xs' }}
      classNames={{ input: classes.fixDisabled }}
    />
  );
}
