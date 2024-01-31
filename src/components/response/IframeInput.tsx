import { List, Text } from '@mantine/core';
import { IFrameResponse } from '../../parser/types';

type inputProps = {
  response: IFrameResponse;
  answer: { value?: string[] };
};
export default function IframeInput({
  response,
  answer,
}: inputProps) {
  const { prompt } = response;

  return (
    <>
      <Text fz="md" fw={500}>
        {prompt}
      </Text>

      <List>
        {Array.isArray(answer.value) && (answer.value).map((item) => <List.Item key={item}>{item}</List.Item>)}
      </List>
    </>
  );
}
