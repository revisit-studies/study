import { DateInput, MonthPickerInput, YearPickerInput } from '@mantine/dates';
import type { FocusEventHandler } from 'react';
import { useState } from 'react';
import type { DateResponse } from '../../parser/types';
import {
  formatDateInput,
  fromPickerDateValue,
  getDateValueFormat,
  toPickerDateValue,
} from '../../utils/dateTimeValidation';
import classes from './css/Input.module.css';
import { InputLabel } from './InputLabel';
import { getDateValidationMessage } from './responseValidation';

type DateResponseAnswer = {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: FocusEventHandler<HTMLElement>;
  onFocus?: FocusEventHandler<HTMLElement>;
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
  const options = response.options ?? 'date';
  const placeholder = response.placeholder ?? getDateValueFormat(options);
  const {
    prompt, required, secondaryText, infoText,
  } = response;
  const {
    value, onChange, onBlur, onFocus, readOnly, ...answerProps
  } = answer;
  const [showInvalidDateError, setShowInvalidDateError] = useState(false);
  const parsePickerDate = (inputValue: string) => toPickerDateValue(inputValue, options);
  const dateValue = typeof value === 'string' ? parsePickerDate(value) : null;
  const minDate = response.min ? parsePickerDate(response.min) : null;
  const maxDate = response.max ? parsePickerDate(response.max) : null;
  const dateValidationError = typeof value === 'string' && value !== ''
    ? getDateValidationMessage(response, value)
    : null;
  const displayedError = showInvalidDateError && dateValidationError ? dateValidationError : error;
  const label = prompt.length > 0 && (
    <InputLabel
      prompt={prompt}
      required={required}
      index={index}
      enumerateQuestions={enumerateQuestions}
      infoText={infoText}
    />
  );
  const handlePickerChange = (nextValue: string | null) => {
    setShowInvalidDateError(false);
    onChange?.(nextValue ? fromPickerDateValue(nextValue, options) : '');
  };
  if (options === 'month' || options === 'year') {
    const PickerInput = options === 'month' ? MonthPickerInput : YearPickerInput;

    return (
      <PickerInput
        {...answerProps}
        allowDeselect
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        label={label}
        description={secondaryText}
        radius="md"
        size="md"
        value={dateValue}
        valueFormat={options === 'month' ? 'MM/YYYY' : 'YYYY'}
        onChange={handlePickerChange}
        onBlur={onBlur}
        onFocus={onFocus}
        minDate={minDate ?? undefined}
        maxDate={maxDate ?? undefined}
        clearable
        error={error}
        withErrorStyles={required}
        errorProps={{ c: required ? 'red' : 'orange', fz: 'sm', mt: 'xs' }}
        classNames={{ input: classes.fixDisabled }}
      />
    );
  }

  return (
    <DateInput
      allowDeselect
      {...answerProps}
      disabled={disabled}
      readOnly={readOnly}
      placeholder={placeholder}
      label={label}
      description={secondaryText}
      radius="md"
      size="md"
      value={dateValue}
      onChange={handlePickerChange}
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
      onFocus={onFocus}
      dateParser={parsePickerDate}
      valueFormat="MM/DD/YYYY"
      minDate={minDate ?? undefined}
      maxDate={maxDate ?? undefined}
      maxLength={10}
      fixOnBlur={false}
      clearable
      error={displayedError}
      withErrorStyles={required}
      errorProps={{ c: required ? 'red' : 'orange', fz: 'sm', mt: 'xs' }}
      classNames={{ input: classes.fixDisabled }}
    />
  );
}
