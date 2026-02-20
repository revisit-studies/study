import { Flex, Tooltip } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { ReactMarkdownWrapper } from '../ReactMarkdownWrapper';

export function OptionLabel({
  label,
  infoText,
}: {
  label: string;
  infoText?: string;
}) {
  return (
    <Flex direction="row" gap={4} align="center">
      {/* Option labels don't need bottom padding and should use small text size */}
      <ReactMarkdownWrapper text={label} inline />
      {infoText && (
        <Tooltip label={infoText} multiline maw={400} position="bottom">
          <IconInfoCircle size={16} opacity={0.5} />
        </Tooltip>
      )}
    </Flex>
  );
}
