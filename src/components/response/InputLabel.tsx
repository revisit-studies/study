import { Flex, Box, Tooltip } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { ReactMarkdownWrapper } from '../ReactMarkdownWrapper';
import classes from './css/InputLabel.module.css';

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
      align="flex-start"
      style={{
        display: 'inline-flex',
        maxWidth: '100%',
      }}
    >
      {required && (
        <Box component="span" className="required-asterisk" ml={-10} style={{ flexShrink: 0 }}>
          *
        </Box>
      )}
      {enumerateQuestions && (
        <Box style={{ flexShrink: 0, fontSize: 16, fontWeight: 500 }}>{`${index}. `}</Box>
      )}
      <Box
        style={{ minWidth: 0, overflowWrap: 'anywhere' }}
        className={`no-last-child-bottom-padding${infoText ? ` ${classes.withInfo}` : ''}`}
      >
        <ReactMarkdownWrapper text={prompt} />
        {infoText && (
          <Tooltip label={infoText} multiline maw={400} position="bottom">
            <IconInfoCircle className={classes.infoIcon} size={16} opacity={0.5} />
          </Tooltip>
        )}
      </Box>
      {clearSelectionButton && (
        <Flex
          align="center"
          gap={4}
          wrap="nowrap"
          style={{ flexShrink: 0, minHeight: '1lh' }}
        >
          {clearSelectionButton}
        </Flex>
      )}
    </Flex>
  );
}
