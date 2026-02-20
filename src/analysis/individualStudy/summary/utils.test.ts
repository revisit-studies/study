import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import {
  convertNumberToString,
  getOverviewStats,
  getComponentStats,
  getResponseStats,
} from './utils';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { studyComponentToIndividualComponent } from '../../../utils/handleComponentInheritance';

// Mock dependencies
vi.mock('../../../utils/getCleanedDuration', () => ({
  getCleanedDuration: vi.fn((answer: { startTime: number; endTime: number; windowEvents: unknown[] }) => {
    // Simple mock: return duration minus 1000ms for "clean" time, or -1 if invalid
    if (answer.endTime === -1) return -1;
    const duration = answer.endTime - answer.startTime;
    // Simulate invalid clean time for answers with specific flag
    if ((answer as { invalidCleanTime?: boolean }).invalidCleanTime) return -1;
    return Math.max(duration - 1000, 0);
  }),
}));

vi.mock('../../../utils/correctAnswer', () => ({
  componentAnswersAreCorrect: vi.fn((userAnswers: Record<string, unknown>, correctAnswers: Array<{ id: string; answer: unknown }>) => {
    if (!correctAnswers || correctAnswers.length === 0) return true;
    return correctAnswers.every((ca) => userAnswers[ca.id] === ca.answer);
  }),
}));

vi.mock('../../../utils/handleComponentInheritance', () => ({
  studyComponentToIndividualComponent: vi.fn((component: { response?: unknown[] }) => component),
}));

// Helper function to create mock participant data
function createMockParticipant(overrides: Partial<ParticipantData> & { participantId: string }): ParticipantData {
  const { participantId, ...rest } = overrides;
  return {
    participantId,
    participantConfigHash: 'config-hash-1',
    sequence: {
      orderPath: '', order: 'fixed', components: [], skip: [], interruptions: [],
    },
    participantIndex: 0,
    answers: {},
    searchParams: {},
    metadata: {
      userAgent: '', resolution: {}, language: '', ip: null,
    },
    completed: false,
    rejected: false,
    participantTags: [],
    stage: 'active',
    ...rest,
  };
}

// Helper function to create mock stored answer
function createMockAnswer(overrides: {
  componentName: string;
  startTime: number;
  endTime: number;
  answer?: Record<string, string | number | boolean | string[]>;
  correctAnswer?: Array<{ id: string; answer: string | number | boolean | string[] }>;
  invalidCleanTime?: boolean;
}) {
  return {
    identifier: `${overrides.componentName}_1`,
    componentName: overrides.componentName,
    trialOrder: '1',
    answer: overrides.answer || {},
    correctAnswer: overrides.correctAnswer || [],
    incorrectAnswers: {},
    startTime: overrides.startTime,
    endTime: overrides.endTime,
    provenanceGraph: {
      sidebar: undefined,
      aboveStimulus: undefined,
      belowStimulus: undefined,
      stimulus: undefined,
    },
    windowEvents: [],
    timedOut: false,
    helpButtonClickedCount: 0,
    parameters: {},
    optionOrders: {},
    questionOrders: {},
    invalidCleanTime: overrides.invalidCleanTime,
  };
}

describe('utils.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // convertNumberToString tests
  // ============================================
  describe('convertNumberToString', () => {
    describe('date type', () => {
      it('should format a valid Date object as locale date string', () => {
        const date = new Date('2024-01-15');
        const result = convertNumberToString(date, 'date');
        expect(result).toBe(date.toLocaleDateString());
      });

      it('should return "N/A" for null date', () => {
        const result = convertNumberToString(null, 'date');
        expect(result).toBe('N/A');
      });

      it('should return "N/A" when number is passed with date type', () => {
        const result = convertNumberToString(12345, 'date');
        expect(result).toBe('N/A');
      });

      it('should return locale output for invalid Date objects', () => {
        const invalidDate = new Date('this-is-not-a-date');
        const result = convertNumberToString(invalidDate, 'date');
        expect(result).toBe(invalidDate.toLocaleDateString());
      });
    });

    describe('time type', () => {
      it('should format a valid number as time with 1 decimal place and "s" suffix', () => {
        const result = convertNumberToString(10.567, 'time');
        expect(result).toBe('10.6s');
      });

      it('should format zero correctly', () => {
        const result = convertNumberToString(0, 'time');
        expect(result).toBe('0.0s');
      });

      it('should return "N/A" for NaN', () => {
        const result = convertNumberToString(NaN, 'time');
        expect(result).toBe('N/A');
      });

      it('should return "N/A" for null', () => {
        const result = convertNumberToString(null, 'time');
        expect(result).toBe('N/A');
      });

      it('should return "N/A" for Date with time type', () => {
        const result = convertNumberToString(new Date(), 'time');
        expect(result).toBe('N/A');
      });

      it('should format negative numbers correctly', () => {
        const result = convertNumberToString(-5.5, 'time');
        expect(result).toBe('-5.5s');
      });

      it('should format large numbers correctly', () => {
        const result = convertNumberToString(3600.123, 'time');
        expect(result).toBe('3600.1s');
      });
    });

    describe('correctness type', () => {
      it('should format a valid percentage with 1 decimal place and "%" suffix', () => {
        const result = convertNumberToString(85.567, 'correctness');
        expect(result).toBe('85.6%');
      });

      it('should format zero correctly', () => {
        const result = convertNumberToString(0, 'correctness');
        expect(result).toBe('0.0%');
      });

      it('should format 100% correctly', () => {
        const result = convertNumberToString(100, 'correctness');
        expect(result).toBe('100.0%');
      });

      it('should return "N/A" for NaN', () => {
        const result = convertNumberToString(NaN, 'correctness');
        expect(result).toBe('N/A');
      });

      it('should return "N/A" for null', () => {
        const result = convertNumberToString(null, 'correctness');
        expect(result).toBe('N/A');
      });

      it('should return "N/A" for Date with correctness type', () => {
        const result = convertNumberToString(new Date(), 'correctness');
        expect(result).toBe('N/A');
      });
    });
  });

  // ============================================
  // getOverviewStats tests
  // ============================================
  describe('getOverviewStats', () => {
    describe('empty input', () => {
      it('should return zero counts and null dates for empty array', () => {
        const result = getOverviewStats([]);

        expect(result.participantCounts).toEqual({
          total: 0,
          completed: 0,
          inProgress: 0,
          rejected: 0,
        });
        expect(result.startDate).toBeNull();
        expect(result.endDate).toBeNull();
        expect(result.avgTime).toBeNaN();
        expect(result.avgCleanTime).toBeNaN();
        expect(result.correctness).toBeNaN();
      });
    });

    describe('participant counts', () => {
      it('should count completed participants correctly', () => {
        const participants = [
          createMockParticipant({ participantId: '1', completed: true, rejected: false }),
          createMockParticipant({ participantId: '2', completed: true, rejected: false }),
          createMockParticipant({ participantId: '3', completed: false, rejected: false }),
        ];

        const result = getOverviewStats(participants);

        expect(result.participantCounts.total).toBe(3);
        expect(result.participantCounts.completed).toBe(2);
        expect(result.participantCounts.inProgress).toBe(1);
        expect(result.participantCounts.rejected).toBe(0);
      });

      it('should count rejected participants correctly', () => {
        const participants = [
          createMockParticipant({ participantId: '1', completed: true, rejected: false }),
          createMockParticipant({ participantId: '2', completed: true, rejected: { reason: 'test', timestamp: Date.now() } }),
          createMockParticipant({ participantId: '3', completed: false, rejected: { reason: 'spam', timestamp: Date.now() } }),
        ];

        const result = getOverviewStats(participants);

        expect(result.participantCounts.total).toBe(3);
        expect(result.participantCounts.completed).toBe(1);
        expect(result.participantCounts.inProgress).toBe(0);
        expect(result.participantCounts.rejected).toBe(2);
      });

      it('should not count manually rejected completed participants as completed', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            rejected: { reason: 'manual rejection after completion', timestamp: Date.now() },
          }),
        ];

        const result = getOverviewStats(participants);

        expect(result.participantCounts.completed).toBe(0);
        expect(result.participantCounts.rejected).toBe(1);
      });

      it('should include rejected participants in total count', () => {
        const participants = [
          createMockParticipant({ participantId: '1', completed: true, rejected: false }),
          createMockParticipant({ participantId: '2', completed: true, rejected: { reason: 'test', timestamp: Date.now() } }),
        ];

        const result = getOverviewStats(participants);

        expect(result.participantCounts.total).toBe(2);
        expect(result.participantCounts.rejected).toBe(1);
      });

      it('should correctly categorize in-progress participants', () => {
        const participants = [
          createMockParticipant({ participantId: '1', completed: false, rejected: false }),
          createMockParticipant({ participantId: '2', completed: false, rejected: false }),
          createMockParticipant({ participantId: '3', completed: true, rejected: false }),
        ];

        const result = getOverviewStats(participants);

        expect(result.participantCounts.inProgress).toBe(2);
        expect(result.participantCounts.completed).toBe(1);
      });
    });

    describe('date statistics', () => {
      it('should calculate correct start and end dates', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 1000,
                endTime: 2000,
              }),
            },
          }),
          createMockParticipant({
            participantId: '2',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 3000,
                endTime: 4000,
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants);

        expect(result.startDate).toEqual(new Date(1000));
        expect(result.endDate).toEqual(new Date(4000));
      });

      it('should exclude answers with endTime of -1', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 1000,
                endTime: -1, // Not finished
              }),
              comp2_1: createMockAnswer({
                componentName: 'comp2',
                startTime: 2000,
                endTime: 3000,
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants);

        expect(result.startDate).toEqual(new Date(2000));
        expect(result.endDate).toEqual(new Date(3000));
      });

      it('should exclude rejected participants from date calculations', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            rejected: { reason: 'rejected', timestamp: Date.now() },
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 500,
                endTime: 600,
              }),
            },
          }),
          createMockParticipant({
            participantId: '2',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 1000,
                endTime: 2000,
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants);

        // Should not include the rejected participant's dates
        expect(result.startDate).toEqual(new Date(1000));
        expect(result.endDate).toEqual(new Date(2000));
      });

      it('should return null dates when all answers are incomplete', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: false,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 1000,
                endTime: -1,
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants);

        expect(result.startDate).toBeNull();
        expect(result.endDate).toBeNull();
      });

      it('should use actual latest end time even when earlier start time has later end time', () => {
        // Scenario: Answer with earlier startTime finishes after answer with later startTime
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 1000,
                endTime: 50000, // Started first but ended last
              }),
              comp2_1: createMockAnswer({
                componentName: 'comp2',
                startTime: 2000,
                endTime: 10000, // Started second but ended earlier
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants);

        expect(result.endDate).toEqual(new Date(50000));
        expect(result.startDate).toEqual(new Date(1000));
      });

      it('should correctly identify dates when answers are in chronological order', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 1000,
                endTime: 5000,
              }),
              comp2_1: createMockAnswer({
                componentName: 'comp2',
                startTime: 6000,
                endTime: 10000,
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants);

        expect(result.startDate).toEqual(new Date(1000));
        expect(result.endDate).toEqual(new Date(10000));
      });
    });

    describe('time statistics', () => {
      it('should calculate average time correctly', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 0,
                endTime: 10000, // 10 seconds
              }),
            },
          }),
          createMockParticipant({
            participantId: '2',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 0,
                endTime: 20000, // 20 seconds
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants);

        // Average: (10 + 20) / 2 = 15 seconds
        expect(result.avgTime).toBe(15);
      });

      it('should calculate average clean time correctly', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 0,
                endTime: 10000, // 10 seconds, clean = 9 seconds (mock subtracts 1000ms)
              }),
            },
          }),
          createMockParticipant({
            participantId: '2',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 0,
                endTime: 20000, // 20 seconds, clean = 19 seconds
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants);

        // Clean time average: (9 + 19) / 2 = 14 seconds
        expect(result.avgCleanTime).toBe(14);
      });

      it('should exclude rejected participants from time calculations', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            rejected: { reason: 'rejected', timestamp: Date.now() },
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 0,
                endTime: 100000, // Very long time that should be excluded
              }),
            },
          }),
          createMockParticipant({
            participantId: '2',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 0,
                endTime: 10000,
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants);

        expect(result.avgTime).toBe(10);
      });

      it('should count participants with invalid clean time', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 0,
                endTime: 10000,
                invalidCleanTime: true,
              }),
            },
          }),
          createMockParticipant({
            participantId: '2',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 0,
                endTime: 10000,
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants);

        expect(result.participantsWithInvalidCleanTimeCount).toBe(1);
      });

      it('should return NaN for avgTime when no valid answers exist', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: false,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 0,
                endTime: -1, // Incomplete
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants);

        expect(result.avgTime).toBeNaN();
        expect(result.avgCleanTime).toBeNaN();
      });

      it('should track participants with invalid clean time across multiple answers', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 0,
                endTime: 10000,
                invalidCleanTime: true,
              }),
              comp2_1: createMockAnswer({
                componentName: 'comp2',
                startTime: 10000,
                endTime: 20000,
                invalidCleanTime: false,
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants);

        expect(result.participantsWithInvalidCleanTimeCount).toBe(1);
      });

      it('should not count participant twice even with multiple invalid clean times', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 0,
                endTime: 10000,
                invalidCleanTime: true,
              }),
              comp2_1: createMockAnswer({
                componentName: 'comp2',
                startTime: 10000,
                endTime: 20000,
                invalidCleanTime: true,
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants);

        expect(result.participantsWithInvalidCleanTimeCount).toBe(1);
      });

      it('should correctly count clean time with zero duration answers', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 1000,
                endTime: 1000, // Zero duration
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants);

        expect(result.avgTime).toBe(0);
        expect(result.avgCleanTime).toBe(0);
      });
    });

    describe('correctness statistics', () => {
      it('should calculate correctness percentage correctly', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 0,
                endTime: 10000,
                answer: { q1: 'correct' },
                correctAnswer: [{ id: 'q1', answer: 'correct' }],
              }),
            },
          }),
          createMockParticipant({
            participantId: '2',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 0,
                endTime: 10000,
                answer: { q1: 'wrong' },
                correctAnswer: [{ id: 'q1', answer: 'correct' }],
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants);

        // 1 correct out of 2 = 50%
        expect(result.correctness).toBe(50);
      });

      it('should return NaN when no correct answers are defined', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 0,
                endTime: 10000,
                answer: { q1: 'answer' },
                correctAnswer: [], // No correct answers defined
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants);

        expect(result.correctness).toBeNaN();
      });

      it('should exclude rejected participants from correctness calculations', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            rejected: { reason: 'rejected', timestamp: Date.now() },
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 0,
                endTime: 10000,
                answer: { q1: 'wrong' },
                correctAnswer: [{ id: 'q1', answer: 'correct' }],
              }),
            },
          }),
          createMockParticipant({
            participantId: '2',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 0,
                endTime: 10000,
                answer: { q1: 'correct' },
                correctAnswer: [{ id: 'q1', answer: 'correct' }],
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants);

        expect(result.correctness).toBe(100);
      });

      it('should calculate correctness with multiple correct answers in one component', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 1,
                endTime: 10000,
                answer: { q1: 'correct1', q2: 'correct2', q3: 'correct3' },
                correctAnswer: [
                  { id: 'q1', answer: 'correct1' },
                  { id: 'q2', answer: 'correct2' },
                  { id: 'q3', answer: 'correct3' },
                ],
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants);

        expect(result.correctness).toBe(100);
      });

      it('should calculate partial correctness when some answers are wrong', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 1,
                endTime: 10000,
                answer: { q1: 'correct1', q2: 'wrong', q3: 'correct3' },
                correctAnswer: [
                  { id: 'q1', answer: 'correct1' },
                  { id: 'q2', answer: 'correct2' },
                  { id: 'q3', answer: 'correct3' },
                ],
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants);

        // Mock returns false for component (all-or-nothing), so 0%
        expect(result.correctness).toBe(0);
      });

      it('should aggregate correctness across multiple participants with multiple questions', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 1,
                endTime: 10000,
                answer: { q1: 'correct1', q2: 'correct2' },
                correctAnswer: [
                  { id: 'q1', answer: 'correct1' },
                  { id: 'q2', answer: 'correct2' },
                ],
              }),
            },
          }),
          createMockParticipant({
            participantId: '2',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 1,
                endTime: 10000,
                answer: { q1: 'wrong', q2: 'wrong' },
                correctAnswer: [
                  { id: 'q1', answer: 'correct1' },
                  { id: 'q2', answer: 'correct2' },
                ],
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants);

        // Participant 1: all correct (2 questions), Participant 2: all wrong (2 questions)
        // Total: 2 correct out of 4 = 50%
        expect(result.correctness).toBe(50);
      });
    });

    describe('filtering by component name', () => {
      it('should filter statistics by component name', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 1, // Must be > 0 to be valid
                endTime: 10001,
              }),
              comp2_1: createMockAnswer({
                componentName: 'comp2',
                startTime: 1,
                endTime: 50001, // Different time
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants, 'comp1');

        expect(result.avgTime).toBe(10);
      });

      it('should count only participants with the specified component', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 1,
                endTime: 10000,
              }),
            },
          }),
          createMockParticipant({
            participantId: '2',
            completed: true,
            answers: {
              comp2_1: createMockAnswer({
                componentName: 'comp2',
                startTime: 1,
                endTime: 10000,
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants, 'comp1');

        expect(result.participantCounts.total).toBe(1);
      });

      it('should exclude participants with startTime of 0 for component filtering', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 0, // Not started
                endTime: -1,
              }),
            },
          }),
          createMockParticipant({
            participantId: '2',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 1000,
                endTime: 2000,
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants, 'comp1');

        expect(result.participantCounts.total).toBe(1);
      });

      it('should require startTime > 0 for valid component answer', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 0, // Invalid - not started
                endTime: 10000,
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants, 'comp1');

        expect(result.participantCounts.total).toBe(0);
      });

      it('should require endTime !== -1 for valid component answer', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 1000,
                endTime: -1, // Invalid - not finished
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants, 'comp1');

        expect(result.participantCounts.total).toBe(0);
      });

      it('should handle component filtering with non-existent component', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 1,
                endTime: 10000,
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants, 'nonExistentComponent');

        expect(result.participantCounts.total).toBe(0);
        expect(result.avgTime).toBeNaN();
      });

      it('should not include rejected participants with incomplete answers when filtering by component', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            rejected: { reason: 'rejected', timestamp: Date.now() },
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 1000,
                endTime: -1,
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants, 'comp1');

        expect(result.participantCounts.total).toBe(0);
        expect(result.participantCounts.rejected).toBe(0);
      });
    });

    describe('edge cases', () => {
      it('should handle participants with no answers', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: false,
            answers: {},
          }),
        ];

        const result = getOverviewStats(participants);

        expect(result.participantCounts.total).toBe(1);
        expect(result.startDate).toBeNull();
        expect(result.endDate).toBeNull();
      });

      it('should handle mixed completed and incomplete answers', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 1000,
                endTime: 5000,
              }),
              comp2_1: createMockAnswer({
                componentName: 'comp2',
                startTime: 6000,
                endTime: -1, // Not completed
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants);

        expect(result.avgTime).toBe(4); // Only comp1 should count
        expect(result.startDate).toEqual(new Date(1000));
        expect(result.endDate).toEqual(new Date(5000));
      });

      it('should handle very large number of participants', () => {
        const participants = Array.from({ length: 1000 }, (_, i) => createMockParticipant({
          participantId: `${i}`,
          completed: true,
          answers: {
            comp1_1: createMockAnswer({
              componentName: 'comp1',
              startTime: i * 1000,
              endTime: i * 1000 + 10000,
            }),
          },
        }));

        const result = getOverviewStats(participants);

        expect(result.participantCounts.total).toBe(1000);
        expect(result.avgTime).toBe(10);
      });

      it('should handle multiple answers per participant', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 0,
                endTime: 10000,
              }),
              comp1_2: createMockAnswer({
                componentName: 'comp1',
                startTime: 10000,
                endTime: 30000,
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants, 'comp1');

        // Both answers should be counted: (10 + 20) / 2 = 15
        expect(result.avgTime).toBe(15);
      });

      it('should handle all participants being rejected', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            rejected: { reason: 'spam', timestamp: Date.now() },
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 0,
                endTime: 10000,
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants);

        expect(result.participantCounts.rejected).toBe(1);
        expect(result.participantCounts.completed).toBe(0);
        expect(result.startDate).toBeNull();
        expect(result.endDate).toBeNull();
        expect(result.avgTime).toBeNaN();
      });

      it('should include participants without component filter', () => {
        const participants = [
          createMockParticipant({ participantId: '1', completed: true }),
          createMockParticipant({ participantId: '2', completed: false }),
        ];

        const result = getOverviewStats(participants);

        expect(result.participantCounts.total).toBe(2);
      });

      it('should handle participant with answer for different component than filtered', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 1,
                endTime: 10000,
              }),
            },
          }),
        ];

        // Filter by comp2, but participant only has comp1
        const result = getOverviewStats(participants, 'comp2');

        expect(result.participantCounts.total).toBe(0);
        expect(result.avgTime).toBeNaN();
        expect(result.startDate).toBeNull();
      });

      it('should handle negative time duration (edge case)', () => {
        // This shouldn't happen in practice, but tests robustness
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 10000,
                endTime: 5000, // End before start
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants);

        // Should still calculate, even if negative
        expect(result.avgTime).toBe(-5);
      });

      it('should include rejected participants in total count but exclude from other stats', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            rejected: { reason: 'spam', timestamp: Date.now() },
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 1,
                endTime: 100000, // Very long time
              }),
            },
          }),
          createMockParticipant({
            participantId: '2',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 1,
                endTime: 10001,
              }),
            },
          }),
        ];

        const result = getOverviewStats(participants);

        // Rejected participant IS in total count
        expect(result.participantCounts.total).toBe(2);
        expect(result.participantCounts.rejected).toBe(1);
        // But avgTime excludes rejected participant's data
        expect(result.avgTime).toBe(10);
      });

      it('should compute overview correctly for stage-filtered subset', () => {
        const allParticipants = [
          createMockParticipant({
            participantId: '1',
            stage: 'stage-a',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({ componentName: 'comp1', startTime: 1, endTime: 11001 }),
            },
          }),
          createMockParticipant({
            participantId: '2',
            stage: 'stage-b',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({ componentName: 'comp1', startTime: 1, endTime: 21001 }),
            },
          }),
        ];

        const stageFiltered = allParticipants.filter((p) => p.stage === 'stage-a');
        const result = getOverviewStats(stageFiltered);

        expect(result.participantCounts.total).toBe(1);
        expect(result.avgTime).toBe(11);
      });

      it('should compute overview correctly for config-filtered subset', () => {
        const allParticipants = [
          createMockParticipant({
            participantId: '1',
            participantConfigHash: 'config-a',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({ componentName: 'comp1', startTime: 1, endTime: 10001 }),
            },
          }),
          createMockParticipant({
            participantId: '2',
            participantConfigHash: 'config-b',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({ componentName: 'comp1', startTime: 1, endTime: 30001 }),
            },
          }),
        ];

        const configFiltered = allParticipants.filter((p) => p.participantConfigHash === 'config-a');
        const result = getOverviewStats(configFiltered);

        expect(result.participantCounts.total).toBe(1);
        expect(result.avgTime).toBe(10);
      });
    });
  });

  // ============================================
  // getComponentStats tests
  // ============================================
  describe('getComponentStats', () => {
    it('should return stats for all components in study config', () => {
      const participants = [
        createMockParticipant({
          participantId: '1',
          completed: true,
          answers: {
            comp1_1: createMockAnswer({
              componentName: 'comp1',
              startTime: 1,
              endTime: 10000,
            }),
            comp2_1: createMockAnswer({
              componentName: 'comp2',
              startTime: 1,
              endTime: 20000,
            }),
          },
        }),
      ];

      const studyConfig = {
        components: {
          comp1: { response: [] },
          comp2: { response: [] },
        },
      } as unknown as StudyConfig;

      const result = getComponentStats(participants, studyConfig);

      expect(result).toHaveLength(2);
      expect(result.find((c) => c.component === 'comp1')).toBeDefined();
      expect(result.find((c) => c.component === 'comp2')).toBeDefined();
    });

    it('should calculate stats for each component individually', () => {
      const participants = [
        createMockParticipant({
          participantId: '1',
          completed: true,
          answers: {
            comp1_1: createMockAnswer({
              componentName: 'comp1',
              startTime: 1, // Must be > 0 to be valid
              endTime: 10001,
            }),
          },
        }),
        createMockParticipant({
          participantId: '2',
          completed: true,
          answers: {
            comp1_1: createMockAnswer({
              componentName: 'comp1',
              startTime: 1,
              endTime: 20001,
            }),
            comp2_1: createMockAnswer({
              componentName: 'comp2',
              startTime: 1,
              endTime: 5001,
            }),
          },
        }),
      ];

      const studyConfig = {
        components: {
          comp1: { response: [] },
          comp2: { response: [] },
        },
      } as unknown as StudyConfig;

      const result = getComponentStats(participants, studyConfig);

      const comp1Stats = result.find((c) => c.component === 'comp1');
      const comp2Stats = result.find((c) => c.component === 'comp2');

      expect(comp1Stats?.avgTime).toBe(15); // (10 + 20) / 2
      expect(comp2Stats?.avgTime).toBe(5);
    });

    it('should return participant count for each component', () => {
      const participants = [
        createMockParticipant({
          participantId: '1',
          completed: true,
          answers: {
            comp1_1: createMockAnswer({
              componentName: 'comp1',
              startTime: 1,
              endTime: 10000,
            }),
          },
        }),
        createMockParticipant({
          participantId: '2',
          completed: true,
          answers: {
            comp1_1: createMockAnswer({
              componentName: 'comp1',
              startTime: 1,
              endTime: 20000,
            }),
            comp2_1: createMockAnswer({
              componentName: 'comp2',
              startTime: 1,
              endTime: 5000,
            }),
          },
        }),
      ];

      const studyConfig = {
        components: {
          comp1: { response: [] },
          comp2: { response: [] },
        },
      } as unknown as StudyConfig;

      const result = getComponentStats(participants, studyConfig);

      const comp1Stats = result.find((c) => c.component === 'comp1');
      const comp2Stats = result.find((c) => c.component === 'comp2');

      expect(comp1Stats?.participants).toBe(2);
      expect(comp2Stats?.participants).toBe(1);
    });

    it('should handle empty study config', () => {
      const participants = [
        createMockParticipant({ participantId: '1', completed: true }),
      ];

      const studyConfig = {
        components: {},
      } as unknown as StudyConfig;

      const result = getComponentStats(participants, studyConfig);

      expect(result).toHaveLength(0);
    });

    it('should calculate correctness for each component', () => {
      const participants = [
        createMockParticipant({
          participantId: '1',
          completed: true,
          answers: {
            comp1_1: createMockAnswer({
              componentName: 'comp1',
              startTime: 1, // Must be > 0 to be valid
              endTime: 10000,
              answer: { q1: 'correct' },
              correctAnswer: [{ id: 'q1', answer: 'correct' }],
            }),
          },
        }),
      ];

      const studyConfig = {
        components: {
          comp1: { response: [] },
        },
      } as unknown as StudyConfig;

      const result = getComponentStats(participants, studyConfig);

      expect(result[0].correctness).toBe(100);
    });

    it('should return NaN stats for components with no participant data', () => {
      const participants = [
        createMockParticipant({
          participantId: '1',
          completed: true,
          answers: {
            comp1_1: createMockAnswer({
              componentName: 'comp1',
              startTime: 1,
              endTime: 10000,
            }),
          },
        }),
      ];

      const studyConfig = {
        components: {
          comp1: { response: [] },
          comp2: { response: [] }, // No participant has answered this
        },
      } as unknown as StudyConfig;

      const result = getComponentStats(participants, studyConfig);

      const comp1Stats = result.find((c) => c.component === 'comp1');
      const comp2Stats = result.find((c) => c.component === 'comp2');

      expect(comp1Stats?.participants).toBe(1);
      expect(comp1Stats?.avgTime).not.toBeNaN();
      expect(comp2Stats?.participants).toBe(0);
      expect(comp2Stats?.avgTime).toBeNaN();
    });

    it('should handle components defined in config but not in any participant answers', () => {
      const participants = [
        createMockParticipant({
          participantId: '1',
          completed: true,
          answers: {},
        }),
      ];

      const studyConfig = {
        components: {
          orphanComponent: { response: [] },
        },
      } as unknown as StudyConfig;

      const result = getComponentStats(participants, studyConfig);

      expect(result).toHaveLength(1);
      expect(result[0].component).toBe('orphanComponent');
      expect(result[0].participants).toBe(0);
      expect(result[0].avgTime).toBeNaN();
    });

    it('should only include components from config, not extra components in participant data', () => {
      const participants = [
        createMockParticipant({
          participantId: '1',
          completed: true,
          answers: {
            comp1_1: createMockAnswer({
              componentName: 'comp1',
              startTime: 1,
              endTime: 10000,
            }),
            extraComp_1: createMockAnswer({
              componentName: 'extraComp', // Not in config
              startTime: 1,
              endTime: 20000,
            }),
          },
        }),
      ];

      const studyConfig = {
        components: {
          comp1: { response: [] },
        },
      } as unknown as StudyConfig;

      const result = getComponentStats(participants, studyConfig);

      expect(result).toHaveLength(1);
      expect(result[0].component).toBe('comp1');
      expect(result.find((c) => c.component === 'extraComp')).toBeUndefined();
    });

    it('should calculate avgCleanTime for each component', () => {
      const participants = [
        createMockParticipant({
          participantId: '1',
          completed: true,
          answers: {
            comp1_1: createMockAnswer({
              componentName: 'comp1',
              startTime: 1,
              endTime: 10001, // 10 seconds total, 9 seconds clean (mock subtracts 1000ms)
            }),
          },
        }),
        createMockParticipant({
          participantId: '2',
          completed: true,
          answers: {
            comp1_1: createMockAnswer({
              componentName: 'comp1',
              startTime: 1,
              endTime: 20001, // 20 seconds total, 19 seconds clean
            }),
          },
        }),
      ];

      const studyConfig = {
        components: {
          comp1: { response: [] },
        },
      } as unknown as StudyConfig;

      const result = getComponentStats(participants, studyConfig);

      expect(result[0].avgTime).toBe(15); // (10 + 20) / 2
      expect(result[0].avgCleanTime).toBe(14); // (9 + 19) / 2
    });

    it('should return NaN for avgCleanTime when no valid answers exist', () => {
      const participants = [
        createMockParticipant({
          participantId: '1',
          completed: true,
          answers: {},
        }),
      ];

      const studyConfig = {
        components: {
          comp1: { response: [] },
        },
      } as unknown as StudyConfig;

      const result = getComponentStats(participants, studyConfig);

      expect(result[0].avgCleanTime).toBeNaN();
    });

    it('should include rejected participants in component participant count but exclude them from timing/correctness', () => {
      const participants = [
        createMockParticipant({
          participantId: '1',
          completed: true,
          rejected: { reason: 'spam', timestamp: Date.now() },
          answers: {
            comp1_1: createMockAnswer({
              componentName: 'comp1',
              startTime: 1,
              endTime: 100001,
              answer: { q1: 'wrong' },
              correctAnswer: [{ id: 'q1', answer: 'correct' }],
            }),
          },
        }),
        createMockParticipant({
          participantId: '2',
          completed: true,
          answers: {
            comp1_1: createMockAnswer({
              componentName: 'comp1',
              startTime: 1,
              endTime: 10001,
              answer: { q1: 'correct' },
              correctAnswer: [{ id: 'q1', answer: 'correct' }],
            }),
          },
        }),
      ];

      const studyConfig = {
        components: {
          comp1: { response: [] },
        },
      } as unknown as StudyConfig;

      const [comp1Stats] = getComponentStats(participants, studyConfig);

      expect(comp1Stats.participants).toBe(2);
      expect(comp1Stats.avgTime).toBe(10);
      expect(comp1Stats.correctness).toBe(100);
    });
  });

  // ============================================
  // getResponseStats tests
  // ============================================
  describe('getResponseStats', () => {
    describe('basic functionality', () => {
      it('should return response data for all responses in components', () => {
        const studyConfig = {
          components: {
            survey: {
              response: [
                { type: 'radio', prompt: 'Question 1', options: ['A', 'B', 'C'] },
                { type: 'checkbox', prompt: 'Question 2', options: ['X', 'Y'] },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result).toHaveLength(2);
        expect(result[0].component).toBe('survey');
        expect(result[0].type).toBe('radio');
        expect(result[0].question).toBe('Question 1');
        expect(result[1].type).toBe('checkbox');
      });

      it('should use "N/A" when prompt is not provided', () => {
        const studyConfig = {
          components: {
            comp: {
              response: [
                {
                  type: 'shortText',
                },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result[0].question).toBe('N/A');
      });

      it('should skip components with no responses', () => {
        const studyConfig = {
          components: {
            intro: {},
            survey: {
              response: [
                { type: 'radio', prompt: 'Q1', options: ['A', 'B'] },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result).toHaveLength(1);
        expect(result[0].component).toBe('survey');
      });

      it('should skip components with empty responses array', () => {
        const studyConfig = {
          components: {
            intro: {
              response: [],
            },
            survey: {
              response: [
                { type: 'radio', prompt: 'Q1', options: ['A', 'B'] },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result).toHaveLength(1);
        expect(result[0].component).toBe('survey');
      });

      it('should include correctness for each response', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            answers: {
              survey_1: createMockAnswer({
                componentName: 'survey',
                startTime: 1, // Must be > 0 to be valid
                endTime: 10000,
                answer: { q1: 'correct' },
                correctAnswer: [{ id: 'q1', answer: 'correct' }],
              }),
            },
          }),
        ];

        const studyConfig = {
          components: {
            survey: {
              response: [
                { type: 'radio', prompt: 'Q1', options: ['A', 'B'] },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats(participants, studyConfig);

        expect(result[0].correctness).toBe(100);
      });
    });

    describe('slider response options', () => {
      it('should format slider response options correctly', () => {
        const studyConfig = {
          components: {
            slider: {
              response: [
                {
                  type: 'slider',
                  prompt: 'Rate it',
                  options: [
                    { label: 'Bad', value: 0 },
                    { label: 'OK', value: 50 },
                    { label: 'Good', value: 100 },
                  ],
                },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result[0].options).toBe('Bad (0), OK (50), Good (100)');
      });
    });

    describe('options-based responses (radio, checkbox, dropdown, button)', () => {
      it('should format string options as comma-separated list', () => {
        const studyConfig = {
          components: {
            radio: {
              response: [
                {
                  type: 'radio',
                  prompt: 'Choose one',
                  options: ['Option 1', 'Option 2', 'Option 3'],
                },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result[0].options).toBe('Option 1, Option 2, Option 3');
      });

      it('should format button response options correctly', () => {
        const studyConfig = {
          components: {
            buttons: {
              response: [
                {
                  type: 'button',
                  prompt: 'Click one',
                  options: ['Yes', 'No', 'Maybe'],
                },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result[0].options).toBe('Yes, No, Maybe');
      });

      it('should format dropdown response options correctly', () => {
        const studyConfig = {
          components: {
            dropdown: {
              response: [
                {
                  type: 'dropdown',
                  prompt: 'Select one',
                  options: ['First', 'Second', 'Third'],
                },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result[0].options).toBe('First, Second, Third');
        expect(result[0].type).toBe('dropdown');
      });

      it('should format checkbox response options correctly', () => {
        const studyConfig = {
          components: {
            checkbox: {
              response: [
                {
                  type: 'checkbox',
                  prompt: 'Select all that apply',
                  options: ['Option A', 'Option B', 'Option C'],
                },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result[0].options).toBe('Option A, Option B, Option C');
        expect(result[0].type).toBe('checkbox');
      });

      it('should handle ranking response with options', () => {
        const studyConfig = {
          components: {
            ranking: {
              response: [
                {
                  type: 'ranking',
                  prompt: 'Rank these items',
                  options: ['First', 'Second', 'Third'],
                },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result[0].options).toBe('First, Second, Third');
      });

      it('should handle StringOption objects by extracting labels', () => {
        const studyConfig = {
          components: {
            survey: {
              response: [
                {
                  type: 'radio',
                  prompt: 'Choose one',
                  options: [
                    { label: 'First Option', value: 'first' },
                    { label: 'Second Option', value: 'second' },
                  ],
                },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result[0].options).toBe('First Option, Second Option');
      });

      it('should handle mixed string and StringOption options', () => {
        const studyConfig = {
          components: {
            mixed: {
              response: [
                {
                  type: 'radio',
                  prompt: 'Mixed options',
                  options: [
                    'Plain String',
                    { label: 'Object Option', value: 'obj' },
                  ],
                },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result[0].options).toBe('Plain String, Object Option');
      });
    });

    describe('matrix response options', () => {
      it('should format matrix-radio response options correctly', () => {
        const studyConfig = {
          components: {
            matrix: {
              response: [
                {
                  type: 'matrix-radio',
                  prompt: 'Rate these',
                  questionOptions: ['Q1', 'Q2', 'Q3'],
                  answerOptions: ['A1', 'A2', 'A3'],
                },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result[0].options).toBe('Questions: Q1, Q2, Q3 \n Answers: A1, A2, A3');
      });

      it('should format matrix-checkbox response correctly', () => {
        const studyConfig = {
          components: {
            matrixCheckbox: {
              response: [
                {
                  type: 'matrix-checkbox',
                  prompt: 'Select all that apply',
                  questionOptions: ['Item 1', 'Item 2'],
                  answerOptions: ['Cat A', 'Cat B', 'Cat C'],
                },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result[0].options).toBe('Questions: Item 1, Item 2 \n Answers: Cat A, Cat B, Cat C');
        expect(result[0].type).toBe('matrix-checkbox');
      });

      it('should format matrix response with preset answer options', () => {
        const studyConfig = {
          components: {
            matrix: {
              response: [
                {
                  type: 'matrix-radio',
                  prompt: 'Rate these',
                  questionOptions: ['Q1', 'Q2'],
                  answerOptions: 'satisfaction5',
                },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result[0].options).toBe('Questions: Q1, Q2 \n Answers: satisfaction5');
      });

      it('should format matrix response with mixed string and StringOption entries', () => {
        const studyConfig = {
          components: {
            matrixMixed: {
              response: [
                {
                  type: 'matrix-radio',
                  prompt: 'Rate these',
                  questionOptions: [
                    'Q1',
                    { label: 'Question 2', value: 'q2' },
                  ],
                  answerOptions: [
                    { label: 'Answer 1', value: 'a1' },
                    'Answer 2',
                  ],
                },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result[0].options).toBe('Questions: Q1, Question 2 \n Answers: Answer 1, Answer 2');
      });
    });

    describe('likert response options', () => {
      it('should format likert response options correctly', () => {
        const studyConfig = {
          components: {
            likert: {
              response: [
                {
                  type: 'likert',
                  prompt: 'Rate your agreement',
                  numItems: 7,
                  leftLabel: 'Strongly Disagree',
                  rightLabel: 'Strongly Agree',
                },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result[0].options).toBe(' Strongly Disagree ~ Strongly Agree (7 items)');
      });

      it('should format likert response without labels', () => {
        const studyConfig = {
          components: {
            likert: {
              response: [
                {
                  type: 'likert',
                  prompt: 'Rate it',
                  numItems: 5,
                },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result[0].options).toBe(' (5 items)');
      });

      it('should handle likert with only left label', () => {
        const studyConfig = {
          components: {
            likert: {
              response: [
                {
                  type: 'likert',
                  prompt: 'Rate it',
                  numItems: 5,
                  leftLabel: 'Low',
                },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        // leftLabel exists but rightLabel is undefined
        expect(result[0].options).toContain('5 items');
      });

      it('should handle likert with custom start and spacing', () => {
        const studyConfig = {
          components: {
            likert: {
              response: [
                {
                  type: 'likert',
                  prompt: 'Custom scale',
                  numItems: 10,
                  start: 0,
                  spacing: 2,
                  leftLabel: 'None',
                  rightLabel: 'Maximum',
                },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result[0].options).toBe(' None ~ Maximum (10 items)');
      });
    });

    describe('text-based and other response types (no options)', () => {
      it('should return "N/A" for numerical response', () => {
        const studyConfig = {
          components: {
            numerical: {
              response: [
                {
                  type: 'numerical',
                  prompt: 'Enter a number',
                  min: 0,
                  max: 100,
                },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result[0].options).toBe('N/A');
        expect(result[0].type).toBe('numerical');
      });

      it('should return "N/A" for shortText response', () => {
        const studyConfig = {
          components: {
            text: {
              response: [
                {
                  type: 'shortText',
                  prompt: 'Enter your name',
                },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result[0].options).toBe('N/A');
      });

      it('should return "N/A" for longText response', () => {
        const studyConfig = {
          components: {
            longText: {
              response: [
                {
                  type: 'longText',
                  prompt: 'Describe your experience',
                },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result[0].options).toBe('N/A');
      });

      it('should handle reactive response (no options)', () => {
        const studyConfig = {
          components: {
            reactive: {
              response: [
                {
                  type: 'reactive',
                  prompt: 'Dynamic response',
                },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result[0].options).toBe('N/A');
      });

      it('should handle textOnly response', () => {
        const studyConfig = {
          components: {
            textOnly: {
              response: [
                {
                  type: 'textOnly',
                  prompt: 'Information text',
                },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result[0].options).toBe('N/A');
      });

      it('should handle divider response', () => {
        const studyConfig = {
          components: {
            divider: {
              response: [
                {
                  type: 'divider',
                },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result[0].options).toBe('N/A');
        expect(result[0].question).toBe('N/A');
      });
    });

    describe('edge cases', () => {
      it('should handle multiple responses in a single component', () => {
        const studyConfig = {
          components: {
            survey: {
              response: [
                { type: 'radio', prompt: 'Q1', options: ['A', 'B'] },
                { type: 'shortText', prompt: 'Q2' },
                { type: 'slider', prompt: 'Q3', options: [{ label: 'Low', value: 0 }, { label: 'High', value: 100 }] },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result).toHaveLength(3);
        expect(result[0].type).toBe('radio');
        expect(result[1].type).toBe('shortText');
        expect(result[2].type).toBe('slider');
        // All responses belong to same component
        expect(result.every((r) => r.component === 'survey')).toBe(true);
      });

      it('should handle empty study config', () => {
        const studyConfig = {
          components: {},
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result).toHaveLength(0);
      });

      it('should handle components with response as undefined', () => {
        const studyConfig = {
          components: {
            intro: {
              // no response property at all
            },
            survey: {
              response: [
                { type: 'radio', prompt: 'Q1', options: ['A', 'B'] },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result).toHaveLength(1);
        expect(result[0].component).toBe('survey');
      });

      it('should preserve component name association for multiple components', () => {
        const studyConfig = {
          components: {
            intro: {
              response: [
                { type: 'shortText', prompt: 'Name' },
              ],
            },
            survey: {
              response: [
                { type: 'radio', prompt: 'Q1', options: ['A', 'B'] },
              ],
            },
            outro: {
              response: [
                { type: 'longText', prompt: 'Feedback' },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result).toHaveLength(3);
        expect(result.find((r) => r.component === 'intro')?.question).toBe('Name');
        expect(result.find((r) => r.component === 'survey')?.question).toBe('Q1');
        expect(result.find((r) => r.component === 'outro')?.question).toBe('Feedback');
      });

      it('should handle slider with single option', () => {
        const studyConfig = {
          components: {
            slider: {
              response: [
                {
                  type: 'slider',
                  prompt: 'Rate',
                  options: [{ label: 'Only', value: 50 }],
                },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result[0].options).toBe('Only (50)');
      });

      it('should handle empty options array', () => {
        const studyConfig = {
          components: {
            radio: {
              response: [
                {
                  type: 'radio',
                  prompt: 'Empty options',
                  options: [],
                },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result[0].options).toBe('');
      });

      it('should calculate correctness NaN when no participant data exists', () => {
        const studyConfig = {
          components: {
            survey: {
              response: [
                { type: 'radio', prompt: 'Q1', options: ['A', 'B'] },
              ],
            },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats([], studyConfig);

        expect(result[0].correctness).toBeNaN();
      });

      it('should call studyComponentToIndividualComponent for each component', () => {
        const studyConfig = {
          components: {
            comp1: { response: [{ type: 'shortText', prompt: 'Q1' }] },
            comp2: { response: [{ type: 'shortText', prompt: 'Q2' }] },
          },
        } as unknown as StudyConfig;

        getResponseStats([], studyConfig);

        expect(vi.mocked(studyComponentToIndividualComponent)).toHaveBeenCalledTimes(2);
      });

      it('should keep per-component correctness values in response rows', () => {
        const participants = [
          createMockParticipant({
            participantId: '1',
            completed: true,
            answers: {
              comp1_1: createMockAnswer({
                componentName: 'comp1',
                startTime: 1,
                endTime: 10001,
                answer: { q1: 'correct' },
                correctAnswer: [{ id: 'q1', answer: 'correct' }],
              }),
              comp2_1: createMockAnswer({
                componentName: 'comp2',
                startTime: 1,
                endTime: 10001,
                answer: { q1: 'wrong' },
                correctAnswer: [{ id: 'q1', answer: 'correct' }],
              }),
            },
          }),
        ];

        const studyConfig = {
          components: {
            comp1: { response: [{ type: 'shortText', prompt: 'Q1' }] },
            comp2: { response: [{ type: 'shortText', prompt: 'Q2' }] },
          },
        } as unknown as StudyConfig;

        const result = getResponseStats(participants, studyConfig);

        const comp1Row = result.find((r) => r.component === 'comp1');
        const comp2Row = result.find((r) => r.component === 'comp2');

        expect(comp1Row?.correctness).toBe(100);
        expect(comp2Row?.correctness).toBe(0);
      });
    });
  });
});
