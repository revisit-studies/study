import { Flex, Tooltip, Text } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

export function OptionLabel({
  label,
  infoText,
}: {
  label: string;
  infoText?: string;
}) {
  return (
    <Flex direction="row" gap={4} align="center">
      <Text>{label}</Text>
      {infoText && (
        <Tooltip label={infoText} multiline maw={400} position="bottom">
          <IconInfoCircle size={16} opacity={0.5} />
        </Tooltip>
      )}
    </Flex>
  );
}
