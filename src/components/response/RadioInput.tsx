import { Group, Radio, Text } from '@mantine/core';
import { RadioResponse } from '../../parser/types';

type inputProps = {
  response: RadioResponse;
  disabled: boolean;
  answer: any;
};

export default function RadioInput({
  response,
  disabled,
  answer,
}: inputProps) {
  const { prompt, required, options, leftLabel, rightLabel } = response;

  return (
    <>
      <Radio.Group
        name="radioInput"
        label={prompt}
        withAsterisk={required}
        size={'md'}
        {...answer}
      >
        <Text>{leftLabel}</Text>
        <Group mt="xs">
          {options.map((radio) => {
            return (
              <Radio
                disabled={disabled}
                value={radio.value}
                label={radio.label}
                key={radio.label}
              />
            );
          })}
        </Group>
        <Text>{rightLabel}</Text>

      </Radio.Group>
    </>
  );
}
