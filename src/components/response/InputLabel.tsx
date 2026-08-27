import { Flex, Box, Tooltip } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { ReactMarkdownWrapper } from '../ReactMarkdownWrapper';

export function InputLabel({
  prompt,
  required,
  index,
  enumerateQuestions,
  infoText,
  clearSelectionButton,
}: {
  prompt: string;
  required?: boolean;
  index?: number;
  enumerateQuestions: boolean;
  infoText?: string;
  clearSelectionButton?: ReactNode;
}) {
  return (
    <Flex
      direction="row"
      wrap="nowrap"
      gap={4}
      align="center"
      style={{
        display: 'inline-flex',
        maxWidth: '100%',
      }}
    >
      {required && (
        <Box component="span" className="required-asterisk" ml={-10}>
          *
        </Box>
      )}
      {enumerateQuestions && <Box style={{ minWidth: 'fit-content', fontSize: 16, fontWeight: 500 }}>{`${index}. `}</Box>}
      <Box style={{ display: 'block' }} className="no-last-child-bottom-padding">
        <ReactMarkdownWrapper text={prompt} />
      </Box>
      {(infoText || clearSelectionButton) && (
        <Flex
          align="center"
          gap={4}
        >
          {infoText && (
            <Tooltip label={infoText} multiline maw={400} position="bottom">
              <IconInfoCircle size={16} opacity={0.5} />
            </Tooltip>
          )}
          {clearSelectionButton}
        </Flex>
      )}
    </Flex>
  );
}
