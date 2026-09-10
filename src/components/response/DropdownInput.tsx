import { MultiSelect, Select } from '@mantine/core';
import { DropdownResponse } from '../../parser/types';
import classes from './css/Input.module.css';
import { InputLabel } from './InputLabel';
import { OptionLabel } from './OptionLabel';
import { getDropdownOptions } from '../../utils/dropdownOptions';

export function DropdownInput({
  response,
  disabled,
  answer,
  error,
  index,
  enumerateQuestions,
}: {
  response: DropdownResponse;
  disabled: boolean;
  answer: { value: string };
  error?: string | null;
  index: number;
  enumerateQuestions: boolean;
}) {
  const {
    placeholder,
    prompt,
    required,
    secondaryText,
    infoText,
  } = response;

  const optionsAsStringOptions = getDropdownOptions(response);
  const resolvedPlaceholder = placeholder ?? (response.options === 'countries' ? 'Select a country' : undefined);
  const countryPreset = response.options === 'countries';
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
        placeholder={!answer.value || answer.value.length === 0 ? resolvedPlaceholder : undefined}
        data={optionsAsStringOptions}
        radius="md"
        size="md"
        {...answer}
        value={Array.isArray(answer.value) ? answer.value : answer.value ? [answer.value] : []}
        error={error}
        withErrorStyles={required}
        errorProps={{ c: required ? 'red' : 'orange', fz: 'sm', mt: 'xs' }}
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
        placeholder={resolvedPlaceholder}
        data={optionsAsStringOptions}
        radius="md"
        size="md"
        {...answer}
        value={answer.value || null}
        error={error}
        withErrorStyles={required}
        errorProps={{ c: required ? 'red' : 'orange', fz: 'sm', mt: 'xs' }}
        classNames={{ input: classes.fixDisabled }}
        maxDropdownHeight={200}
        searchable={countryPreset}
        renderOption={renderOption}
      />
    )
  );
}
