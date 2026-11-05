import { describe, expect, test } from 'vitest';
import { SequenceAssignment } from '../engines/types';
import { ParticipantDataWithStatus } from '../types';
import {
  countParticipantStatuses, emptyParticipantStatusCounts, getParticipantDataStatus,
  getSequenceAssignmentStatus, PARTICIPANT_STATUSES, ParticipantStatus, statusConsumesCapacity,
} from '../participantStatus';

describe('participant status', () => {
  test.each<{ rejected: boolean; completed: boolean; timedOut: boolean; status: ParticipantStatus }>([
    {
      rejected: false, completed: false, timedOut: false, status: 'inProgress',
    },
    {
      rejected: false, completed: true, timedOut: false, status: 'completed',
    },
    {
      rejected: false, completed: false, timedOut: true, status: 'timedOut',
    },
    {
      rejected: false, completed: true, timedOut: true, status: 'completedLate',
    },
    ...[false, true].flatMap((completed) => [false, true].map((timedOut) => ({
      rejected: true, completed, timedOut, status: 'rejected' as const,
    }))),
  ])('maps rejection=$rejected completion=$completed timeout=$timedOut to $status', ({
    rejected, completed, timedOut, status,
  }) => {
    expect(getParticipantDataStatus({ rejected, completed, timedOut } as ParticipantDataWithStatus)).toBe(status);
    expect(getSequenceAssignmentStatus({
      rejected, completed: completed ? 0 : null, ...(timedOut ? { autoTimedOutAt: 0 } : {}),
    } as SequenceAssignment)).toBe(status);
    expect(statusConsumesCapacity(status)).toBe(!rejected && !timedOut);
  });

  test('counts all statuses and returns independent empty counts', () => {
    const counts = countParticipantStatuses([...PARTICIPANT_STATUSES, 'timedOut'], (status) => status as ParticipantStatus);
    expect(counts).toEqual({
      completed: 1, inProgress: 1, rejected: 1, timedOut: 2, completedLate: 1,
    });
    const empty = emptyParticipantStatusCounts();
    empty.completed = 10;
    expect(emptyParticipantStatusCounts().completed).toBe(0);
  });
});
