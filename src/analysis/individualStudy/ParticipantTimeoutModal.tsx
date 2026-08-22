import {
  Alert, Button, Group, Modal, Stack, Text, Tooltip,
} from '@mantine/core';
import { IconClockOff } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { ParticipantDataWithStatus } from '../../storage/types';
import { useAuth } from '../../store/hooks/useAuth';

export type TimedOutParticipant = ParticipantDataWithStatus & {
  elapsedTime: number | null;
};

export function formatElapsedTime(elapsedTime: number) {
  const totalMinutes = Math.floor(Math.max(elapsedTime, 0) / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getParticipantStartTime(participant: ParticipantDataWithStatus) {
  if (participant.createdTime) {
    return participant.createdTime;
  }

  const answerStartTimes = Object.values(participant.answers)
    .map((answer) => answer.startTime)
    .filter((startTime) => startTime > 0);

  return answerStartTimes.length > 0 ? Math.min(...answerStartTimes) : null;
}

export function getInProgressParticipantsByElapsedTime(
  participants: ParticipantDataWithStatus[],
  now: number = Date.now(),
): TimedOutParticipant[] {
  return participants
    .filter((participant) => !participant.completed && !participant.rejected)
    .map((participant) => {
      const startTime = getParticipantStartTime(participant);
      return {
        ...participant,
        elapsedTime: startTime === null ? null : Math.max(now - startTime, 0),
      };
    })
    .sort((a, b) => (b.elapsedTime ?? -1) - (a.elapsedTime ?? -1));
}

export function ParticipantTimeoutModal({
  participants,
  refresh,
  opened: controlledOpened,
  onClose,
  hideReviewButton = false,
}: {
  participants: ParticipantDataWithStatus[];
  refresh: () => Promise<unknown>;
  opened?: boolean;
  onClose?: () => void;
  hideReviewButton?: boolean;
}) {
  const { storageEngine } = useStorageEngine();
  const { user } = useAuth();
  const [uncontrolledOpened, setUncontrolledOpened] = useState(false);
  const [timingOutParticipantIds, setTimingOutParticipantIds] = useState<string[]>([]);
  const opened = controlledOpened ?? uncontrolledOpened;

  const inProgressParticipants = useMemo(
    () => getInProgressParticipantsByElapsedTime(participants),
    [participants],
  );

  const handleTimeOutParticipant = useCallback(async (participantId: string) => {
    if (!storageEngine || timingOutParticipantIds.includes(participantId)) {
      return;
    }

    setTimingOutParticipantIds((ids) => [...ids, participantId]);
    try {
      await storageEngine.rejectParticipant(participantId, 'Timed out by admin');
      await refresh();
    } catch (error) {
      console.error('Failed to time out participant:', error);
    } finally {
      setTimingOutParticipantIds((ids) => ids.filter((id) => id !== participantId));
    }
  }, [refresh, storageEngine, timingOutParticipantIds]);

  const reviewLabel = `Review (${inProgressParticipants.length})`;
  const reviewAriaLabel = `Review In-Progress Participants (${inProgressParticipants.length})`;
  const handleClose = () => {
    if (controlledOpened === undefined) {
      setUncontrolledOpened(false);
    }
    onClose?.();
  };

  return (
    <>
      {!hideReviewButton && (
        <Tooltip label={user.isAdmin ? reviewAriaLabel : 'Only admins can time out participants'}>
          <span>
            <Button
              aria-label={reviewAriaLabel}
              leftSection={<IconClockOff size={16} />}
              disabled={!user.isAdmin || inProgressParticipants.length === 0}
              onClick={() => setUncontrolledOpened(true)}
              size="xs"
              variant="light"
            >
              {reviewLabel}
            </Button>
          </span>
        </Tooltip>
      )}
      <Modal
        opened={opened}
        onClose={handleClose}
        title="In-Progress Participants"
        size="lg"
      >
        <Stack gap="sm">
          <Alert icon={<IconClockOff size={16} />} color="orange" title="Time out a participant">
            Timing out a participant rejects them and returns their sequence assignment for reuse.
          </Alert>
          {inProgressParticipants.length === 0 ? (
            <Text c="dimmed">There are no in-progress participants.</Text>
          ) : (
            inProgressParticipants.map((participant) => (
              <Group key={participant.participantId} justify="space-between" wrap="nowrap">
                <Stack gap={0} style={{ minWidth: 0 }}>
                  <Text fw={500}>
                    Participant
                    {' '}
                    {participant.participantIndex + 1}
                  </Text>
                  <Text size="sm" c="dimmed" truncate="end">{participant.participantId}</Text>
                </Stack>
                <Group gap="md" wrap="nowrap">
                  <Text size="sm" fw={500} style={{ whiteSpace: 'nowrap' }}>
                    {participant.elapsedTime === null
                      ? 'Length unavailable'
                      : formatElapsedTime(participant.elapsedTime)}
                  </Text>
                  <Button
                    color="red"
                    loading={timingOutParticipantIds.includes(participant.participantId)}
                    onClick={() => handleTimeOutParticipant(participant.participantId)}
                  >
                    Time Out
                  </Button>
                </Group>
              </Group>
            ))
          )}
        </Stack>
      </Modal>
    </>
  );
}
