import { Input, List } from '@mantine/core';
import { ReactiveResponse } from '../../parser/types';
import { InputLabel } from './InputLabel';

export function ReactiveInput({
  response,
  answer,
  index,
  enumerateQuestions,
}: {
  response: ReactiveResponse;
  answer: { value?: string[] };
  index: number;
  enumerateQuestions: boolean;
}) {
  const {
    prompt,
    required,
    secondaryText,
    infoText,
  } = response;

  return (
    <Input.Wrapper
      label={prompt.length > 0 && <InputLabel prompt={prompt} required={required} index={index} enumerateQuestions={enumerateQuestions} infoText={infoText} />}
      description={secondaryText}
      size="md"
    >
      {answer.value && (
      <List>
        {Array.isArray(answer.value)
          ? (answer.value).map((item) => <List.Item key={item}>{item}</List.Item>)
          : typeof answer.value === 'object'
            ? Object.entries(answer.value).map(([key, val]) => <List.Item key={key}>{`${key}: ${typeof val === 'object' ? JSON.stringify(val) : val}`}</List.Item>)
            : <List.Item>{answer.value}</List.Item>}
      </List>
      )}
    </Input.Wrapper>
  );
}
