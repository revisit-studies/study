import { describe, expect, test } from 'vitest';
import { StudyConfig } from '../../parser/types';
import { ParticipantData } from '../types';
import {
  convertNumberToString,
  getComponentStats,
  getOverviewStats,
  getResponseStats,
} from '../../analysis/individualStudy/summary/utils';

// ── participant / answer helpers ─────────────────────────────────────────────

type MinAnswer = {
  componentName: string;
  startTime: number;
  endTime: number;
  correctAnswer: { id: string; answer: unknown }[];
  answer: Record<string, unknown>;
  windowEvents: unknown[];
};

function makeAnswer(overrides: Partial<MinAnswer> = {}): MinAnswer {
  return {
    componentName: 'testComponent',
    startTime: 1000,
    endTime: 6000,
    correctAnswer: [],
    answer: {},
    windowEvents: [],
    ...overrides,
  };
}

function makeParticipant({
  completed = true,
  rejected = false as ParticipantData['rejected'],
  answers = {} as Record<string, MinAnswer>,
} = {}): ParticipantData {
  return { completed, rejected, answers } as unknown as ParticipantData;
}

function makeConfig(components: Record<string, object>): StudyConfig {
  return {
    components,
    sequence: { order: 'fixed', components: Object.keys(components) },
  } as unknown as StudyConfig;
}

// ── convertNumberToString ────────────────────────────────────────────────────

describe('convertNumberToString', () => {
  test('date: returns locale string for a Date instance', () => {
    const d = new Date('2026-01-15');
    expect(convertNumberToString(d, 'date')).toBe(d.toLocaleDateString());
  });

  test('date: returns N/A when value is null or not a Date', () => {
    expect(convertNumberToString(null, 'date')).toBe('N/A');
    expect(convertNumberToString(123, 'date')).toBe('N/A');
  });

  test('time: returns formatted seconds for valid number', () => {
    expect(convertNumberToString(5, 'time')).toBe('5.0s');
    expect(convertNumberToString(0, 'time')).toBe('0.0s');
  });

  test('time: returns N/A for NaN', () => {
    expect(convertNumberToString(NaN, 'time')).toBe('N/A');
  });

  test('correctness: returns formatted percentage for valid number', () => {
    expect(convertNumberToString(75, 'correctness')).toBe('75.0%');
    expect(convertNumberToString(100, 'correctness')).toBe('100.0%');
  });

  test('correctness: returns N/A for NaN', () => {
    expect(convertNumberToString(NaN, 'correctness')).toBe('N/A');
  });
});

// ── getOverviewStats ─────────────────────────────────────────────────────────

describe('getOverviewStats', () => {
  test('empty participants → null dates, NaN times, zero counts', () => {
    const result = getOverviewStats([]);
    expect(result.startDate).toBeNull();
    expect(result.endDate).toBeNull();
    expect(Number.isNaN(result.avgTime)).toBe(true);
    expect(Number.isNaN(result.avgCleanTime)).toBe(true);
    expect(result.participantCounts.total).toBe(0);
  });

  test('correctly counts completed, inProgress, and rejected participants', () => {
    const participants = [
      makeParticipant({ completed: true, rejected: false }),
      makeParticipant({ completed: true, rejected: { reason: 'manual', timestamp: 1000 } }),
      makeParticipant({ completed: false, rejected: false }),
    ];
    const result = getOverviewStats(participants);
    expect(result.participantCounts.total).toBe(3);
    expect(result.participantCounts.completed).toBe(1);
    expect(result.participantCounts.rejected).toBe(1);
    expect(result.participantCounts.inProgress).toBe(1);
  });

  test('computes avgTime and date range from answers', () => {
    const participants = [
      makeParticipant({
        rejected: false,
        answers: { a1: makeAnswer({ startTime: 1000, endTime: 6000 }) },
      }),
    ];
    const result = getOverviewStats(participants);
    expect(result.avgTime).toBeCloseTo(5, 1);
    expect(result.startDate).toEqual(new Date(1000));
    expect(result.endDate).toEqual(new Date(6000));
  });

  test('excludes answers with endTime === -1 from date/time calculations', () => {
    const participants = [
      makeParticipant({
        rejected: false,
        answers: { a1: makeAnswer({ endTime: -1 }) },
      }),
    ];
    const result = getOverviewStats(participants);
    expect(result.startDate).toBeNull();
    expect(Number.isNaN(result.avgTime)).toBe(true);
  });

  test('correctness is NaN when no answer has a correctAnswer', () => {
    const participants = [makeParticipant({ answers: { a1: makeAnswer() } })];
    expect(Number.isNaN(getOverviewStats(participants).correctness)).toBe(true);
  });

  test('empty correctAnswer array on an answer is skipped — covers line 111', () => {
    // Mix: a1 has a real correctAnswer (makes hasCorrectAnswer true), a2 has [] (triggers !correctCount return)
    const participants = [
      makeParticipant({
        rejected: false,
        answers: {
          a1: makeAnswer({ correctAnswer: [{ id: 'q1', answer: 'yes' }], answer: { q1: 'yes' } }),
          a2: makeAnswer({ correctAnswer: [] }),
        },
      }),
    ];
    const result = getOverviewStats(participants);
    expect(result.correctness).toBe(100);
  });

  test('correct answer increments correctSum — covers line 120', () => {
    const participants = [
      makeParticipant({
        rejected: false,
        answers: {
          a1: makeAnswer({ correctAnswer: [{ id: 'q1', answer: 'yes' }], answer: { q1: 'yes' } }),
        },
      }),
    ];
    expect(getOverviewStats(participants).correctness).toBe(100);
  });

  test('incorrect answer does not increment correctSum', () => {
    const participants = [
      makeParticipant({
        rejected: false,
        answers: {
          a1: makeAnswer({ correctAnswer: [{ id: 'q1', answer: 'yes' }], answer: { q1: 'no' } }),
        },
      }),
    ];
    expect(getOverviewStats(participants).correctness).toBe(0);
  });
});

// ── getComponentStats ────────────────────────────────────────────────────────

describe('getComponentStats', () => {
  test('returns one row per component with participant counts', () => {
    const config = makeConfig({
      comp1: { type: 'questionnaire', response: [] },
      comp2: { type: 'questionnaire', response: [] },
    });
    const participants = [
      makeParticipant({
        rejected: false,
        answers: { c1: makeAnswer({ componentName: 'comp1', startTime: 1000, endTime: 3000 }) },
      }),
    ];
    const result = getComponentStats(participants, config);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.component === 'comp1')!.participants).toBe(1);
    expect(result.find((r) => r.component === 'comp2')!.participants).toBe(0);
  });
});

// ── getResponseStats / getResponseOptions ────────────────────────────────────

describe('getResponseStats', () => {
  test('returns empty array for component with no responses', () => {
    const config = makeConfig({ comp1: { type: 'questionnaire', response: [] } });
    expect(getResponseStats([], config)).toEqual([]);
  });

  test('slider response: options formatted as "Label (value)"', () => {
    const config = makeConfig({
      comp1: {
        type: 'questionnaire',
        response: [{
          type: 'slider', id: 'q1', prompt: 'Rate', options: [{ label: 'Bad', value: 0 }, { label: 'Good', value: 100 }],
        }],
      },
    });
    const [row] = getResponseStats([], config);
    expect(row.options).toBe('Bad (0), Good (100)');
  });

  test('radio response: options formatted as comma-separated labels', () => {
    const config = makeConfig({
      comp1: {
        type: 'questionnaire',
        response: [{
          type: 'radio', id: 'q1', prompt: 'Choose', options: ['Option A', { label: 'Option B' }],
        }],
      },
    });
    const [row] = getResponseStats([], config);
    expect(row.options).toBe('Option A, Option B');
  });

  test('matrix response: formats questionOptions and answerOptions', () => {
    const config = makeConfig({
      comp1: {
        type: 'questionnaire',
        response: [{
          type: 'matrix-radio',
          id: 'q1',
          prompt: 'Matrix Q',
          questionOptions: ['Q1', 'Q2'],
          answerOptions: ['A', 'B'],
          withDontKnow: false,
        }],
      },
    });
    const [row] = getResponseStats([], config);
    expect(row.options).toContain('Questions: Q1, Q2');
    expect(row.options).toContain('Answers: A, B');
  });

  test('likert response: formats numItems with labels', () => {
    const config = makeConfig({
      comp1: {
        type: 'questionnaire',
        response: [{
          type: 'likert', id: 'q1', prompt: 'Rate', numItems: 5, leftLabel: 'Bad', rightLabel: 'Good',
        }],
      },
    });
    const [row] = getResponseStats([], config);
    expect(row.options).toContain('Bad ~ Good');
    expect(row.options).toContain('5 items');
  });

  test('text response returns N/A for options', () => {
    const config = makeConfig({
      comp1: {
        type: 'questionnaire',
        response: [{ type: 'textlong', id: 'q1', prompt: 'Describe' }],
      },
    });
    const [row] = getResponseStats([], config);
    expect(row.options).toBe('N/A');
  });
});
