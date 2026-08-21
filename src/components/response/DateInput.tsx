import { DateInput } from '@mantine/dates';
import type { FocusEventHandler } from 'react';
import type { DateResponse } from '../../parser/types';
import { formatMonthDayYear, parseMonthDayYear } from '../../utils/dateTimeValidation';
import classes from './css/Input.module.css';
import { InputLabel } from './InputLabel';

type DateResponseAnswer = {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  onFocus?: FocusEventHandler<HTMLInputElement>;
  readOnly?: boolean;
};

export function DateResponseInput({
  response,
  disabled,
  answer,
  error,
  index,
  enumerateQuestions,
}: {
  response: DateResponse;
  disabled: boolean;
  answer: DateResponseAnswer;
  error?: string | null;
  index: number;
  enumerateQuestions: boolean;
}) {
  const {
    placeholder = 'MM/DD/YYYY',
    prompt,
    required,
    secondaryText,
    infoText,
  } = response;
  const { value, onChange, ...answerProps } = answer;
  const dateValue = typeof value === 'string' ? parseMonthDayYear(value) : null;

  return (
    <DateInput
      {...answerProps}
      disabled={disabled}
      placeholder={placeholder}
      label={prompt.length > 0 && <InputLabel prompt={prompt} required={required} index={index} enumerateQuestions={enumerateQuestions} infoText={infoText} />}
      description={secondaryText}
      radius="md"
      size="md"
      value={dateValue}
      onChange={(nextValue) => onChange?.(nextValue ? formatMonthDayYear(nextValue) : '')}
      dateParser={parseMonthDayYear}
      valueFormat="MM/DD/YYYY"
      clearable={required === false}
      error={error}
      withErrorStyles={required}
      errorProps={{ c: required ? 'red' : 'orange', fz: 'sm', mt: 'xs' }}
      classNames={{ input: classes.fixDisabled }}
    />
  );
}
