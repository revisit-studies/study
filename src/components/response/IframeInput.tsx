import { List, Text } from '@mantine/core';
import { IFrameResponse } from '../../parser/types';

type inputProps = {
  response: IFrameResponse;
  disabled: boolean;
  answer: { value: string[] | undefined };
};
export default function IframeInput({
  response,
  disabled,
  answer,
}: inputProps) {
  const { prompt } = response;

  return (
    <>
      <Text fz={'md'} fw={500}>
        {prompt}
      </Text>

      <List>
        {Array.isArray(answer.value) && (answer.value).map((item) => {
          return <List.Item key={item}>{item}</List.Item>;
        })}
      </List>
    </>
  );
}
