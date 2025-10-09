import { Flex, Box, Tooltip } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { ReactMarkdownWrapper } from '../ReactMarkdownWrapper';

export function InputLabel({
  prompt,
  required,
  index,
  enumerateQuestions,
  hoverDescription,
}: {
  prompt: string;
  required?: boolean;
  index?: number;
  enumerateQuestions: boolean;
  hoverDescription?: string;
}) {
  return (
    <Flex direction="row" wrap="nowrap" gap={4}>
      {enumerateQuestions && <Box style={{ minWidth: 'fit-content', fontSize: 16, fontWeight: 500 }}>{`${index}. `}</Box>}
      <Box style={{ display: 'block' }} className="no-last-child-bottom-padding">
        <ReactMarkdownWrapper text={prompt} required={required} />
      </Box>
      {hoverDescription && (
      <Tooltip label={hoverDescription} multiline maw={400} style={{ whiteSpace: 'normal' }} withinPortal position="bottom">
        <IconInfoCircle size={16} opacity={0.5} style={{ marginTop: 6 }} />
      </Tooltip>
      )}
    </Flex>
  );
}
