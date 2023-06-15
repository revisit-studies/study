import { List, Text } from '@mantine/core';
import { IFrameResponse } from '../../parser/types';

type inputProps = {
  response: IFrameResponse;
  disabled: boolean;
  answer: any;
};
export default function IframeInput({
  response,
  disabled,
  answer = [],
}: inputProps) {
  const { prompt } = response;
  return (
    <>
      <Text fz={'md'} fw={500}>
        {prompt}
      </Text>

      <List>
        {answer.map((item) => {
          return <List.Item key={item}>{item as any}</List.Item>;
        })}
      </List>
    </>
  );
}
