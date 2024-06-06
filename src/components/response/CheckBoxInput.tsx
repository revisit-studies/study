import { Checkbox, Group } from '@mantine/core';
import { CheckboxResponse } from '../../parser/types';
import { generateErrorMessage } from './utils';
import ReactMarkdownWrapper from '../ReactMarkdownWrapper';

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
      label={<ReactMarkdownWrapper text={prompt} required={required} />}
      {...answer}
      error={generateErrorMessage(response, answer, options)}
      size="md"
    >
      <Group mt="lg">
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
