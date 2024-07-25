import {
  Box, Flex, Input, List,
} from '@mantine/core';
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
  const { prompt, required, secondaryText } = response;

  return (
    <Input.Wrapper
      label={(
        <Flex direction="row" wrap="nowrap" gap={4}>
          {enumerateQuestions && <Box style={{ minWidth: 'fit-content' }}>{`${index}. `}</Box>}
          <Box style={{ display: 'block' }} className="no-last-child-bottom-padding">
            <ReactMarkdownWrapper text={prompt} required={required} />
          </Box>
        </Flex>
      )}
      description={secondaryText}
      size="md"
    >

      <List>
        {Array.isArray(answer.value) ? (answer.value).map((item) => <List.Item key={item}>{item}</List.Item>) : <List.Item>{answer.value}</List.Item>}
      </List>
    </Input.Wrapper>
  );
}
