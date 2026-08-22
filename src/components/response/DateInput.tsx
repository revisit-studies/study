import { DateInput } from '@mantine/dates';
import type { FocusEventHandler } from 'react';
import { useState } from 'react';
import type { DateResponse } from '../../parser/types';
import { formatMonthDayYear, parseMonthDayYear } from '../../utils/dateTimeValidation';
import classes from './css/Input.module.css';
import { InputLabel } from './InputLabel';
import { getDateValidationMessage } from './responseValidation';

type DateResponseAnswer = {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  onFocus?: FocusEventHandler<HTMLInputElement>;
  readOnly?: boolean;
};

// Automatically formats the date input as the user types, adding slashes and limiting to 8 digits (MMDDYYYY)
function formatDateInput(value: string, isDeleting: boolean) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length < 2 || (digits.length === 2 && isDeleting)) {
    return digits;
  }
  if (digits.length === 2) {
    return `${digits}/`;
  }
  if (digits.length < 4 || (digits.length === 4 && isDeleting)) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  if (digits.length === 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}/`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

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
  const {
    value, onChange, onBlur, ...answerProps
  } = answer;
  const [showInvalidDateError, setShowInvalidDateError] = useState(false);
  const dateValue = typeof value === 'string' ? parseMonthDayYear(value) : null;
  const minDate = response.minDate ? parseMonthDayYear(response.minDate) : null;
  const maxDate = response.maxDate ? parseMonthDayYear(response.maxDate) : null;
  const dateValidationError = typeof value === 'string' && value !== ''
    ? getDateValidationMessage(response, value)
    : null;
  const displayedError = showInvalidDateError && dateValidationError ? dateValidationError : error;

  return (
    <DateInput
      allowDeselect
      {...answerProps}
      disabled={disabled}
      placeholder={placeholder}
      label={prompt.length > 0 && <InputLabel prompt={prompt} required={required} index={index} enumerateQuestions={enumerateQuestions} infoText={infoText} />}
      description={secondaryText}
      radius="md"
      size="md"
      value={dateValue}
      onChange={(nextValue) => {
        setShowInvalidDateError(false);
        onChange?.(nextValue ? formatMonthDayYear(nextValue) : '');
      }}
      onInput={(event) => {
        const input = event.currentTarget;
        const isDeleting = (event.nativeEvent as InputEvent).inputType?.startsWith('delete') ?? false;
        const nextValue = formatDateInput(input.value, isDeleting);
        input.value = nextValue;
        setShowInvalidDateError(nextValue.length === 10);
        onChange?.(nextValue);
      }}
      onBlur={(event) => {
        setShowInvalidDateError(true);
        onBlur?.(event);
      }}
      dateParser={parseMonthDayYear}
      valueFormat="MM/DD/YYYY"
      minDate={minDate ?? undefined}
      maxDate={maxDate ?? undefined}
      maxLength={10}
      fixOnBlur={false}
      clearable={required === false}
      error={displayedError}
      withErrorStyles={required}
      errorProps={{ c: required ? 'red' : 'orange', fz: 'sm', mt: 'xs' }}
      classNames={{ input: classes.fixDisabled }}
    />
  );
}
