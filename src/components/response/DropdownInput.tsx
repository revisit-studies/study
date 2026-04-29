import { MultiSelect, Select } from '@mantine/core';
import { DropdownResponse } from '../../parser/types';
import { generateErrorMessage } from './utils';
import classes from './css/Input.module.css';
import { InputLabel } from './InputLabel';
import { OptionLabel } from './OptionLabel';
import { parseStringOptions } from '../../utils/stringOptions';

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

  const optionsAsStringOptions = parseStringOptions(options);
  const isMultiselect = (response.minSelections && response.minSelections >= 1) || (response.maxSelections && response.maxSelections > 1);
  const renderOption = ({ option }: { option: { label: string; infoText?: string } }) => (
    <OptionLabel label={option.label} infoText={option.infoText} />
  );

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
        renderOption={renderOption}
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
        renderOption={renderOption}
      />
    )
  );
}
