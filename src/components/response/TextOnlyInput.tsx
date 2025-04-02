import { Flex, Box } from '@mantine/core';
import { ReactMarkdownWrapper } from '../ReactMarkdownWrapper';
import { TextOnlyResponse } from '../../parser/types';

export function TextOnlyInput({
  response,
}: {
  response: TextOnlyResponse;
}) {
  const { prompt } = response;

  return (
    <Flex direction="row" wrap="nowrap" gap={4}>
      <Box style={{ display: 'block' }} className="no-last-child-bottom-padding">
        <ReactMarkdownWrapper text={prompt} required={false} />
      </Box>
    </Flex>
  );
}
