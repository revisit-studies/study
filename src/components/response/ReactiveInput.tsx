import { Input, List } from '@mantine/core';
import { ReactiveResponse } from '../../parser/types';
import { InputLabel } from './InputLabel';

export function Reactive({
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
  const { prompt, required, secondaryText } = response;

  return (
    <Input.Wrapper
      label={prompt.length > 0 && <InputLabel prompt={prompt} required={required} index={index} enumerateQuestions={enumerateQuestions} />}
      description={secondaryText}
      size="md"
    >
      {answer.value && (
      <List>
        {Array.isArray(answer.value) ? (answer.value).map((item) => <List.Item key={item}>{item}</List.Item>) : <List.Item>{answer.value}</List.Item>}
      </List>
      )}
    </Input.Wrapper>
  );
}
