import { Flex, Text, Tooltip } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { ReactMarkdownWrapper } from '../ReactMarkdownWrapper';

export function OptionLabel({
  label,
  infoText,
  button = false,
}: {
  label: string;
  infoText?: string;
  button?: boolean;
}) {
  return (
    <Flex direction="row" gap={4} align="center" justify={button ? 'center' : undefined}>
      {/* Option labels don't need bottom padding and should use small text size */}
      {button ? <Text size="sm">{label}</Text>
        : <ReactMarkdownWrapper text={label} inline />}
      {infoText && (
        <Tooltip label={infoText} multiline maw={400} position="bottom">
          <IconInfoCircle size={16} opacity={0.5} />
        </Tooltip>
      )}
    </Flex>
  );
}
