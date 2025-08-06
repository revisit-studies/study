import { Select } from '@mantine/core';
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
  } = response;

  const optionsAsStringOptions = options.map((option) => (typeof option === 'string' ? { value: option, label: option } : option));

  return (
    <Select
      disabled={disabled}
      label={prompt.length > 0 && <InputLabel prompt={prompt} required={required} index={index} enumerateQuestions={enumerateQuestions} />}
      description={secondaryText}
      placeholder={placeholder}
      data={optionsAsStringOptions}
      radius="md"
      size="md"
      {...answer}
      value={answer.value === '' ? null : answer.value}
      error={generateErrorMessage(response, answer, optionsAsStringOptions)}
      classNames={{ input: classes.fixDisabled }}
    />
  );
}
