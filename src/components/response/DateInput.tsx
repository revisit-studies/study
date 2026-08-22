import { ActionIcon, Popover, TextInput } from '@mantine/core';
import { DateInput, MonthPicker, YearPicker } from '@mantine/dates';
import { IconCalendar } from '@tabler/icons-react';
import type { FocusEventHandler } from 'react';
import { useId, useRef, useState } from 'react';
import type { DateResponse } from '../../parser/types';
import {
  formatDateInput,
  formatMonthInput,
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
  const [pickerOpened, setPickerOpened] = useState(false);
  const pickerDialogId = useId();
  const pickerButtonRef = useRef<HTMLButtonElement>(null);
  const pickerDropdownRef = useRef<HTMLDivElement>(null);
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
  const closePickerAndReturnFocus = () => {
    pickerButtonRef.current?.focus({ preventScroll: true });
    setPickerOpened(false);
  };

  if (options === 'month' || options === 'year') {
    const maxLength = options === 'month' ? 7 : 4;
    const inputValue = typeof value === 'string' ? value : '';
    const picker = options === 'month' ? (
      <MonthPicker
        allowDeselect
        value={dateValue}
        onChange={(nextValue) => {
          handlePickerChange(nextValue);
          closePickerAndReturnFocus();
        }}
        minDate={minDate ?? undefined}
        maxDate={maxDate ?? undefined}
      />
    ) : (
      <YearPicker
        allowDeselect
        value={dateValue}
        onChange={(nextValue) => {
          handlePickerChange(nextValue);
          closePickerAndReturnFocus();
        }}
        minDate={minDate ?? undefined}
        maxDate={maxDate ?? undefined}
      />
    );

    return (
      <Popover
        opened={pickerOpened}
        onChange={setPickerOpened}
        disabled={disabled || readOnly}
        closeOnEscape={false}
        trapFocus
        withRoles={false}
        transitionProps={{ duration: 0 }}
        onEnterTransitionEnd={() => {
          const selectedControl = pickerDropdownRef.current
            ?.querySelector<HTMLButtonElement>('[data-selected]:not(:disabled)');
          const firstControl = pickerDropdownRef.current
            ?.querySelector<HTMLButtonElement>('[data-picker-control]:not(:disabled)');
          (selectedControl ?? firstControl)?.focus({ preventScroll: true });
        }}
      >
        <Popover.Target>
          <TextInput
            {...answerProps}
            disabled={disabled}
            readOnly={readOnly}
            placeholder={placeholder}
            label={label}
            description={secondaryText}
            radius="md"
            size="md"
            value={inputValue}
            onChange={(event) => {
              const isDeleting = (event.nativeEvent as InputEvent).inputType?.startsWith('delete') ?? false;
              const nextValue = options === 'month'
                ? formatMonthInput(event.currentTarget.value, isDeleting)
                : event.currentTarget.value.replace(/\D/g, '').slice(0, 4);
              setShowInvalidDateError(nextValue.length === maxLength);
              onChange?.(nextValue);
            }}
            onFocus={onFocus}
            onBlur={(event) => {
              setShowInvalidDateError(true);
              onBlur?.(event);
            }}
            maxLength={maxLength}
            rightSection={(
              <ActionIcon
                ref={pickerButtonRef}
                variant="subtle"
                color="gray"
                size="sm"
                disabled={disabled || readOnly}
                aria-label={`Open ${options} picker`}
                aria-haspopup="dialog"
                aria-expanded={pickerOpened}
                aria-controls={pickerOpened ? pickerDialogId : undefined}
                onClick={() => setPickerOpened((opened) => !opened)}
              >
                <IconCalendar size={18} aria-hidden />
              </ActionIcon>
            )}
            rightSectionPointerEvents="all"
            error={displayedError}
            withErrorStyles={required}
            errorProps={{ c: required ? 'red' : 'orange', fz: 'sm', mt: 'xs' }}
            classNames={{ input: classes.fixDisabled }}
          />
        </Popover.Target>
        <Popover.Dropdown
          id={pickerDialogId}
          ref={pickerDropdownRef}
          role="dialog"
          aria-label={`${options} picker`}
          tabIndex={-1}
          onKeyDownCapture={(event) => {
            if (event.key === 'Escape') {
              closePickerAndReturnFocus();
            }
          }}
        >
          {picker}
        </Popover.Dropdown>
      </Popover>
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
      onChange={(nextValue) => {
        setShowInvalidDateError(false);
        handlePickerChange(nextValue);
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
