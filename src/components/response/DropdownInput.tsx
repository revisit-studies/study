import { MultiSelect, Select } from '@mantine/core';
import { DropdownResponse } from '../../parser/types';
import { generateErrorMessage } from './utils';
import classes from './css/Input.module.css';
import { InputLabel } from './InputLabel';

export function DropdownInput({
  response,
  disabled,
  answer,
  index,
  enumerateQuestions,
}: {
  response: DropdownResponse;
  disabled: boolean;
  answer: { value: string };
  index: number;
  enumerateQuestions: boolean;
}) {
  const {
    placeholder,
    prompt,
    required,
    options,
    secondaryText,
    infoText,
  } = response;

  const optionsAsStringOptions = options.map((option) => (typeof option === 'string' ? { value: option, label: option } : option));
  const isMultiselect = (response.minSelections && response.minSelections >= 1) || (response.maxSelections && response.maxSelections > 1);

  return (
    isMultiselect ? (
      <MultiSelect
        disabled={disabled}
        label={prompt.length > 0 && <InputLabel prompt={prompt} required={required} index={index} enumerateQuestions={enumerateQuestions} infoText={infoText} />}
        description={secondaryText}
        placeholder={answer.value.length === 0 ? placeholder : undefined}
        data={optionsAsStringOptions}
        radius="md"
        size="md"
        {...answer}
        value={answer.value === '' ? [] : Array.isArray(answer.value) ? answer.value : [answer.value]}
        error={generateErrorMessage(response, answer, optionsAsStringOptions)}
        withErrorStyles={required}
        errorProps={{ c: required ? 'red' : 'orange' }}
        classNames={{ input: classes.fixDisabled }}
        maxDropdownHeight={200}
        clearable
        searchable
      />
    ) : (
      <Select
        disabled={disabled}
        label={prompt.length > 0 && <InputLabel prompt={prompt} required={required} index={index} enumerateQuestions={enumerateQuestions} infoText={infoText} />}
        description={secondaryText}
        placeholder={placeholder}
        data={optionsAsStringOptions}
        radius="md"
        size="md"
        {...answer}
        value={answer.value === '' ? null : answer.value}
        error={generateErrorMessage(response, answer, optionsAsStringOptions)}
        withErrorStyles={required}
        errorProps={{ c: required ? 'red' : 'orange' }}
        classNames={{ input: classes.fixDisabled }}
        maxDropdownHeight={200}
      />
    )
  );
}
