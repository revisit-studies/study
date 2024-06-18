import { Tooltip, Text } from '@mantine/core';
import { IconCheck, IconProgress, IconX } from '@tabler/icons-react';

export function ParticipantStatusBadges({ completed, inProgress, rejected }: { completed: number, inProgress: number, rejected: number }) {
  return (
    <Text fz="sm" ml={4}>
      (
      <Tooltip label="Completed"><IconCheck size={16} color="teal" style={{ marginBottom: -3 }} /></Tooltip>
      :
      {' '}
      {completed}
      {' '}
      |
      {' '}
      <Tooltip label="In Progress"><IconProgress size={16} color="orange" style={{ marginBottom: -3 }} /></Tooltip>
      :
      {' '}
      {inProgress}
      {' '}
      |
      {' '}
      <Tooltip label="Rejected"><IconX size={16} color="red" style={{ marginBottom: -3 }} /></Tooltip>
      :
      {' '}
      {rejected}
      )
    </Text>
  );
}
