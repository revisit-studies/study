import { Flex, Box } from '@mantine/core';
import { ReactMarkdownWrapper } from '../ReactMarkdownWrapper';

export function InputLabel({
  prompt, required, index, enumerateQuestions,
}: { prompt: string; required?: boolean; index?: number; enumerateQuestions: boolean }) {
  return (
    <Flex direction="row" wrap="nowrap" gap={4}>
      {enumerateQuestions && <Box style={{ minWidth: 'fit-content', fontSize: 16, fontWeight: 500 }}>{`${index}. `}</Box>}
      <Box style={{ display: 'block' }} className="no-last-child-bottom-padding">
        <ReactMarkdownWrapper text={prompt} required={required} />
      </Box>
    </Flex>
  );
}
