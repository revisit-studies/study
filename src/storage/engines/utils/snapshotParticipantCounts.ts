import type { ParticipantDataWithStatus } from '../../types';
import { countParticipantStatuses, getParticipantDataStatus } from '../../participantStatus';

/**
 * `timedOut` and `completedLate` are optional because snapshots taken before
 * auto-timeouts existed do not carry them.
 */
export type SnapshotParticipantCounts = {
  completed: number;
  inProgress: number;
  rejected: number;
  timedOut?: number;
  completedLate?: number;
};

export function calculateSnapshotParticipantCounts(
  participants: ParticipantDataWithStatus[],
): SnapshotParticipantCounts {
  return countParticipantStatuses(participants, getParticipantDataStatus);
}
