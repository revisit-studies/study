import { List, Text } from '@mantine/core';

type inputProps = {
  desc: string;
  title: string;
  required: boolean;
  answer: Array<string> | string;
};
export default function IframeInput({
  desc = '',
  title = '',
  answer,
}: inputProps) {
  return (
    <>
      <Text fz={'md'} fw={500}>
        {title}
      </Text>
      <Text fz={'sm'} fw={400} c={'#868e96'}>
        {desc}
      </Text>

      <List>
        {Array.isArray(answer) &&
          answer.map((item, idx) => <List.Item key={idx}> {item}</List.Item>)}
      </List>
    </>
  );
}
