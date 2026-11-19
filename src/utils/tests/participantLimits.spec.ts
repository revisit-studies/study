import { describe, expect, test } from 'vitest';
import { formatCombinationKey, summarizeParticipantLimits } from '../participantLimits';
import { getBetweenSubjectsCombinationKey, StageInfo } from '../../storage/engines/types';
import { makeSequenceAssignment } from '../../tests/utils';

const red = getBetweenSubjectsCombinationKey({ color: 'red' }, ['color']);
const blue = getBetweenSubjectsCombinationKey({ color: 'blue' }, ['color']);
const stage: StageInfo = { stageName: 'Pilot', color: '#000', maxParticipants: 4 };

const completed = (overrides = {}) => makeSequenceAssignment({ stage: 'Pilot', completed: 1, ...overrides });
const inProgress = (overrides = {}) => makeSequenceAssignment({ stage: 'Pilot', ...overrides });

describe('formatCombinationKey', () => {
  test('lists each factor and level', () => {
    expect(formatCombinationKey(getBetweenSubjectsCombinationKey({ color: 'red', size: 2 }, ['color', 'size']))).toBe('color: red, size: 2');
  });

  test('falls back to the raw key when it is not a combination', () => {
    expect(formatCombinationKey('not json')).toBe('not json');
  });
});

describe('summarizeParticipantLimits', () => {
  test('returns null without a stage or an enforced limit', () => {
    expect(summarizeParticipantLimits(undefined, [], [])).toBeNull();
    expect(summarizeParticipantLimits({ stageName: 'Pilot', color: '#000' }, [], [])).toBeNull();
    expect(summarizeParticipantLimits({ ...stage, participantLimitEnabled: false }, [], [])).toBeNull();
  });

  test('counts only slot-holding participants in the current stage', () => {
    const summary = summarizeParticipantLimits(stage, [
      completed(),
      inProgress(),
      inProgress({ rejected: true }),
      completed({ stage: 'Other' }),
    ], []);

    expect(summary).toEqual({
      maxParticipants: 4, enrolled: 2, completed: 1, full: false, conditions: [],
    });
  });

  test('is full once enrolled participants reach the maximum', () => {
    const summary = summarizeParticipantLimits({ ...stage, maxParticipants: 2 }, [completed(), inProgress()], []);
    expect(summary?.full).toBe(true);
  });

  test('splits the limit evenly across conditions and counts each one', () => {
    const summary = summarizeParticipantLimits(stage, [
      completed({ betweenSubjectsCombinationKey: red }),
      inProgress({ betweenSubjectsCombinationKey: red }),
      completed({ betweenSubjectsCombinationKey: blue }),
    ], [red, blue]);

    expect(summary?.conditions).toEqual([
      {
        key: red, label: 'color: red', target: 2, enabled: true, enrolled: 2, completed: 1,
      },
      {
        key: blue, label: 'color: blue', target: 2, enabled: true, enrolled: 1, completed: 1,
      },
    ]);
    expect(summary?.full).toBe(false);
  });

  test('is full when every enabled condition has met its target, ignoring disabled ones', () => {
    const summary = summarizeParticipantLimits(
      { ...stage, disabledBetweenSubjectsCombinations: [blue] },
      [completed({ betweenSubjectsCombinationKey: red }), completed({ betweenSubjectsCombinationKey: red }),
        completed({ betweenSubjectsCombinationKey: red }), completed({ betweenSubjectsCombinationKey: red })],
      [red, blue],
    );

    expect(summary?.conditions.map(({ target, enabled }) => [target, enabled])).toEqual([[4, true], [0, false]]);
    expect(summary?.full).toBe(true);
  });

  test('uses manual condition targets', () => {
    const summary = summarizeParticipantLimits(
      { ...stage, participantAssignmentMode: 'manual', manualDesiredParticipantsByCombination: { [red]: 3, [blue]: 1 } },
      [completed({ betweenSubjectsCombinationKey: blue })],
      [red, blue],
    );

    expect(summary?.conditions.map(({ target }) => target)).toEqual([3, 1]);
    expect(summary?.full).toBe(false);
  });
});
