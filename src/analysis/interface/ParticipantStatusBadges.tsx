import { Tooltip, Badge, Flex } from '@mantine/core';
import {
  IconCheck, IconClockOff, IconProgress, IconX,
} from '@tabler/icons-react';
import { ParticipantCounts } from '../types';
import {
  PARTICIPANT_STATUSES, PARTICIPANT_STATUS_LABELS, ParticipantStatus,
} from '../../storage/participantStatus';

const ICON_SIZE = 14;

const STATUS_BADGES: Record<ParticipantStatus, { color: string; Icon: typeof IconCheck }> = {
  completed: { color: 'green', Icon: IconCheck },
  inProgress: { color: 'orange', Icon: IconProgress },
  rejected: { color: 'red', Icon: IconX },
  timedOut: { color: 'yellow', Icon: IconClockOff },
  completedLate: { color: 'grape', Icon: IconCheck },
};

export function ParticipantStatusBadges(counts: Omit<ParticipantCounts, 'total'>) {
  return (
    <Flex ml={4} gap={4}>
      {PARTICIPANT_STATUSES.map((status) => {
        const { color, Icon } = STATUS_BADGES[status];
        return (
          <Tooltip key={status} label={PARTICIPANT_STATUS_LABELS[status]}>
            <Badge variant="light" color={color} leftSection={<Icon width={ICON_SIZE} height={ICON_SIZE} style={{ paddingTop: 1 }} />} pb={1}>{counts[status]}</Badge>
          </Tooltip>
        );
      })}
    </Flex>
  );
}
