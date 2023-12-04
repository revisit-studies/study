import { Checkbox, Group } from '@mantine/core';
import { CheckboxResponse } from '../../parser/types';
import { generateErrorMessage } from '../stimuli/inputcomponents/utils';

type inputProps = {
  response: CheckboxResponse;
  disabled: boolean;
  answer: object;
};

export default function CheckBoxInput({
  response,
  disabled,
  answer,
}: inputProps) {
  const { prompt, required, options } = response;

  return (
    <Checkbox.Group
      label={prompt}
      withAsterisk={required}
      {...answer}
      error={generateErrorMessage(response, answer, options)}
    >
      <Group mt="md">
        {options.map((option) => (
          <Checkbox
            key={option.value}
            disabled={disabled}
            value={option.value}
            label={option.label}
          />
        ))}
      </Group>
    </Checkbox.Group>
  );
}
