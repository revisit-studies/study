import { Tooltip, Badge, Flex } from '@mantine/core';
import { IconCheck, IconProgress, IconX } from '@tabler/icons-react';

const ICON_SIZE = 14;

export function ParticipantStatusBadges({
  completed, inProgress, rejected, filteredCompleted,
}: {
  completed: number, inProgress: number, rejected: number; filteredCompleted?: number,
}) {
  return (
    <Flex ml={4} gap={4}>
      <Tooltip label="Completed">
        <Badge variant="light" color="green" leftSection={<IconCheck width={ICON_SIZE} height={ICON_SIZE} style={{ paddingTop: 1 }} />} pb={1}>{filteredCompleted && filteredCompleted !== completed ? `${filteredCompleted}/${completed}` : completed}</Badge>
      </Tooltip>
      <Tooltip label="In Progress">
        <Badge variant="light" color="orange" leftSection={<IconProgress width={ICON_SIZE} height={ICON_SIZE} style={{ paddingTop: 1 }} />} pb={1}>{inProgress}</Badge>
      </Tooltip>
      <Tooltip label="Rejected">
        <Badge variant="light" color="red" leftSection={<IconX width={ICON_SIZE} height={ICON_SIZE} style={{ paddingTop: 1 }} />} pb={1}>{rejected}</Badge>
      </Tooltip>
    </Flex>
  );
}
