import {
  Box, Flex, Input, List,
} from '@mantine/core';
import { ReactiveResponse } from '../../parser/types';
import { ReactMarkdownWrapper } from '../ReactMarkdownWrapper';

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
      label={(
        <Flex direction="row" wrap="nowrap" gap={4}>
          {enumerateQuestions && <Box style={{ minWidth: 'fit-content', fontSize: 16, fontWeight: 500 }}>{`${index}. `}</Box>}
          <Box style={{ display: 'block' }} className="no-last-child-bottom-padding">
            <ReactMarkdownWrapper text={prompt} required={required} />
          </Box>
        </Flex>
      )}
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
