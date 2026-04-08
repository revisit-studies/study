import { describe, expect, test } from 'vitest';
import { SequenceAssignment } from '../engines/types';
import { ParticipantData } from '../types';
import { getFilteredParticipantProgress, groupParticipantProgress } from '../../analysis/individualStudy/LiveMonitor/LiveMonitorView';

function makeAssignment(partial: Partial<SequenceAssignment> & Pick<SequenceAssignment, 'participantId'>): SequenceAssignment {
  return {
    participantId: partial.participantId,
    timestamp: partial.timestamp ?? 0,
    rejected: partial.rejected ?? false,
    claimed: partial.claimed ?? false,
    completed: partial.completed ?? null,
    createdTime: partial.createdTime ?? 0,
    total: partial.total ?? 10,
    answered: partial.answered ?? [],
    isDynamic: partial.isDynamic ?? false,
    stage: partial.stage ?? 'DEFAULT',
    conditions: partial.conditions,
  };
}

function makeParticipant(partial: Partial<ParticipantData> & Pick<ParticipantData, 'participantId'>): ParticipantData {
  return {
    participantId: partial.participantId,
    participantConfigHash: partial.participantConfigHash ?? 'hash',
    sequence: partial.sequence ?? {
      orderPath: '',
      order: 'fixed',
      components: [],
      skip: [],
    },
    participantIndex: partial.participantIndex ?? 1,
    answers: partial.answers ?? {},
    searchParams: partial.searchParams ?? {},
    metadata: partial.metadata ?? {
      userAgent: 'ua',
      resolution: { width: 100, height: 100 },
      language: 'en',
      ip: '0.0.0.0',
    },
    completed: partial.completed ?? false,
    rejected: partial.rejected ?? false,
    participantTags: partial.participantTags ?? [],
    stage: partial.stage ?? 'DEFAULT',
    conditions: partial.conditions,
    createdTime: partial.createdTime,
  };
}

function getParticipantViewIds(
  participants: ParticipantData[],
  includedParticipants: string[],
  selectedStages: string[],
): string[] {
  const completed = includedParticipants.includes('completed') ? participants.filter((participant) => !participant.rejected && participant.completed) : [];
  const inProgress = includedParticipants.includes('inprogress') ? participants.filter((participant) => !participant.rejected && !participant.completed) : [];
  const rejected = includedParticipants.includes('rejected') ? participants.filter((participant) => participant.rejected) : [];

  const statusFiltered = [...completed, ...inProgress, ...rejected];
  const stageFiltered = selectedStages.includes('ALL')
    ? statusFiltered
    : statusFiltered.filter((participant) => selectedStages.includes(participant.stage || ''));

  return stageFiltered.map((participant) => participant.participantId).sort();
}

describe('analysis live monitor', () => {
  test('participant tracking computes progress and status groups correctly', () => {
    const assignments: SequenceAssignment[] = [
      makeAssignment({
        participantId: 'p1', answered: ['a1', 'a2'], total: 4, completed: null, rejected: false, createdTime: 3, stage: 'S1',
      }),
      makeAssignment({
        participantId: 'p2', answered: ['a1', 'a2', 'a3', 'a4'], total: 4, completed: 10, rejected: false, createdTime: 2, stage: 'S1',
      }),
      makeAssignment({
        participantId: 'p3', answered: ['a1'], total: 4, completed: null, rejected: true, createdTime: 1, stage: 'S2',
      }),
    ];

    const filtered = getFilteredParticipantProgress(assignments, ['completed', 'inprogress', 'rejected'], ['ALL']);
    const grouped = groupParticipantProgress(filtered);

    expect(filtered).toHaveLength(3);
    expect(filtered.find((item) => item.assignment.participantId === 'p1')?.progress).toBe(50);
    expect(filtered.find((item) => item.assignment.participantId === 'p2')?.progress).toBe(100);
    expect(filtered.find((item) => item.assignment.participantId === 'p3')?.progress).toBe(25);

    expect(grouped.inProgress.map((item) => item.assignment.participantId)).toEqual(['p1']);
    expect(grouped.completed.map((item) => item.assignment.participantId)).toEqual(['p2']);
    expect(grouped.rejected.map((item) => item.assignment.participantId)).toEqual(['p3']);
  });

  test('live monitor filtered participants match participant view status + stage filtering', () => {
    const assignments: SequenceAssignment[] = [
      makeAssignment({
        participantId: 'p1', completed: null, rejected: false, createdTime: 4, stage: 'S1',
      }),
      makeAssignment({
        participantId: 'p2', completed: 100, rejected: false, createdTime: 3, stage: 'S1',
      }),
      makeAssignment({
        participantId: 'p3', completed: null, rejected: true, createdTime: 2, stage: 'S2',
      }),
      makeAssignment({
        participantId: 'p4', completed: null, rejected: false, createdTime: 1, stage: 'S2',
      }),
    ];

    const participants: ParticipantData[] = [
      makeParticipant({
        participantId: 'p1', completed: false, rejected: false, stage: 'S1',
      }),
      makeParticipant({
        participantId: 'p2', completed: true, rejected: false, stage: 'S1',
      }),
      makeParticipant({
        participantId: 'p3', completed: false, rejected: { reason: 'r', timestamp: 1 }, stage: 'S2',
      }),
      makeParticipant({
        participantId: 'p4', completed: false, rejected: false, stage: 'S2',
      }),
    ];

    const includedParticipants = ['completed', 'inprogress'];
    const selectedStages = ['S1'];

    const liveMonitorIds = getFilteredParticipantProgress(assignments, includedParticipants, selectedStages)
      .map((item) => item.assignment.participantId)
      .sort();

    const participantViewIds = getParticipantViewIds(participants, includedParticipants, selectedStages);

    expect(liveMonitorIds).toEqual(participantViewIds);
    expect(liveMonitorIds).toEqual(['p1', 'p2']);
  });
});
