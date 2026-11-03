import type { SequenceAssignment } from './engines/types';
import type { ParticipantDataWithStatus } from './types';

/**
 * The canonical participant statuses. Every view that groups, counts, filters,
 * or labels participants derives its status from here, so that rejected, timed
 * out, and completed-late participants stay distinct everywhere.
 */
export const PARTICIPANT_STATUSES = ['completed', 'inProgress', 'rejected', 'timedOut', 'completedLate'] as const;

export type ParticipantStatus = typeof PARTICIPANT_STATUSES[number];

export const PARTICIPANT_STATUS_LABELS: Record<ParticipantStatus, string> = {
  completed: 'Completed',
  inProgress: 'In Progress',
  rejected: 'Rejected',
  timedOut: 'Timed Out',
  completedLate: 'Completed Late',
};

export type ParticipantStatusCounts = Record<ParticipantStatus, number>;

/**
 * Rejection wins over a timeout, because a rejected participant is excluded
 * from the data. A participant who finished after their allocation timed out is
 * `completedLate` rather than `completed`, so a late finish is never silently
 * folded into either the completed or the timed-out group.
 */
function statusOf(rejected: boolean, completed: boolean, timedOut: boolean): ParticipantStatus {
  if (rejected) {
    return 'rejected';
  }
  if (timedOut) {
    return completed ? 'completedLate' : 'timedOut';
  }
  return completed ? 'completed' : 'inProgress';
}

export function getParticipantDataStatus(participant: ParticipantDataWithStatus): ParticipantStatus {
  return statusOf(!!participant.rejected, participant.completed, participant.timedOut ?? false);
}

export function getSequenceAssignmentStatus(assignment: SequenceAssignment): ParticipantStatus {
  return statusOf(assignment.rejected, assignment.completed !== null, assignment.autoTimedOutAt !== undefined);
}

/**
 * Whether a participant in this status still occupies a slot. Rejected,
 * timed-out, and completed-late participants have all released theirs, so their
 * allocation no longer counts against a study's or a stage's limits and can be
 * handed to someone else.
 */
export function statusConsumesCapacity(status: ParticipantStatus): status is 'completed' | 'inProgress' {
  return status === 'completed' || status === 'inProgress';
}

export function emptyParticipantStatusCounts(): ParticipantStatusCounts {
  return {
    completed: 0, inProgress: 0, rejected: 0, timedOut: 0, completedLate: 0,
  };
}

export function countParticipantStatuses<T>(
  items: T[],
  getStatus: (item: T) => ParticipantStatus,
): ParticipantStatusCounts {
  return items.reduce<ParticipantStatusCounts>((counts, item) => {
    counts[getStatus(item)] += 1;
    return counts;
  }, emptyParticipantStatusCounts());
}
