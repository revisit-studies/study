import { Checkbox, Group } from '@mantine/core';
import { CheckboxResponse } from '../../parser/types';

type inputProps = {
  response: CheckboxResponse;
  disabled: boolean;
  answer: any;
};

export default function CheckBoxInput({
  response,
  disabled,
  answer,
}: inputProps) {
  const { prompt, required, options } = response;

  return (
    <>
      <Checkbox.Group
        label={prompt}
        withAsterisk={required}
        {...answer}
      >
        <Group mt="md">
          {options.map((option) => (
            <Checkbox
              disabled={disabled}
              value={option.value}
              label={option.label}
            />
          ))}
        </Group>
      </Checkbox.Group>
    </>
  );
}
