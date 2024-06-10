import { List, Text } from '@mantine/core';
import { IFrameResponse } from '../../parser/types';
import ReactMarkdownWrapper from '../ReactMarkdownWrapper';

export default function IframeInput({
  response,
  answer,
  index,
  enumerateQuestions,
}: {
  response: IFrameResponse;
  answer: { value?: string[] };
  index: number;
  enumerateQuestions: boolean;
}) {
  const { prompt, required } = response;

  return (
    <>
      <>
        {enumerateQuestions ? `${index}. ` : ''}
        <ReactMarkdownWrapper text={prompt} required={required} />
      </>

      <List>
        {Array.isArray(answer.value) ? (answer.value).map((item) => <List.Item key={item}>{item}</List.Item>) : <List.Item>{answer.value}</List.Item>}
      </List>
    </>
  );
}
