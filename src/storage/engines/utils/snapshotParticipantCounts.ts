import type { ParticipantDataWithStatus } from '../../types';

export type SnapshotParticipantCounts = {
  completed: number;
  inProgress: number;
  rejected: number;
};

export function calculateSnapshotParticipantCounts(
  participants: ParticipantDataWithStatus[],
): SnapshotParticipantCounts {
  return {
    completed: participants.filter((participant) => participant.completed && !participant.rejected).length,
    inProgress: participants.filter((participant) => !participant.completed && !participant.rejected).length,
    rejected: participants.filter((participant) => participant.rejected).length,
  };
}
