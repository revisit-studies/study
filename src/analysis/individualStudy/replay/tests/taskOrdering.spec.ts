import {
  describe,
  expect,
  test,
} from 'vitest';
import { StoredAnswer } from '../../../../parser/types';
import { orderedReplayAnswerEntries } from '../taskOrdering';

function answer(identifier: string, trialOrder: string, startTime: number, endTime = startTime + 10): StoredAnswer {
  return {
    answer: {},
    identifier,
    componentName: identifier,
    trialOrder,
    incorrectAnswers: {},
    startTime,
    endTime,
    windowEvents: [],
    timedOut: false,
    helpButtonClickedCount: 0,
    parameters: {},
    correctAnswer: [],
    optionOrders: {},
    questionOrders: {},
  };
}

describe('orderedReplayAnswerEntries', () => {
  test('orders replay entries by trial order instead of recorded timestamps', () => {
    const entries = orderedReplayAnswerEntries({
      task_2: answer('task_2', '2', 1000),
      task_0: answer('task_0', '0', 3000),
      task_1: answer('task_1', '1', 2000),
    });

    expect(entries.map(([identifier]) => identifier)).toEqual(['task_0', 'task_1', 'task_2']);
    expect(entries.map(([, storedAnswer]) => storedAnswer.startTime)).toEqual([3000, 2000, 1000]);
  });

  test('orders dynamic entries by parent step and function index', () => {
    const entries = orderedReplayAnswerEntries({
      task_3_2: answer('task_3_2', '3_2', 1000),
      task_4: answer('task_4', '4', 2000),
      task_3_0: answer('task_3_0', '3_0', 3000),
      task_3: answer('task_3', '3', 4000),
      task_3_1: answer('task_3_1', '3_1', 5000),
    });

    expect(entries.map(([identifier]) => identifier)).toEqual([
      'task_3',
      'task_3_0',
      'task_3_1',
      'task_3_2',
      'task_4',
    ]);
  });

  test('keeps incomplete entries in sequence order with completed entries', () => {
    const entries = orderedReplayAnswerEntries({
      task_2: answer('task_2', '2', 0, 0),
      task_0: answer('task_0', '0', 1000),
      task_1: answer('task_1', '1', 0, 0),
      task_3: answer('task_3', '3', 2000),
    });

    expect(entries.map(([identifier]) => identifier)).toEqual(['task_0', 'task_1', 'task_2', 'task_3']);
  });

  test('uses the task identifier as a stable tie-breaker', () => {
    const entries = orderedReplayAnswerEntries({
      task_b: answer('task_b', '1', 1000),
      task_a: answer('task_a', '1', 2000),
    });

    expect(entries.map(([identifier]) => identifier)).toEqual(['task_a', 'task_b']);
  });

  test('orders completed entries chronologically when answer-time order is selected', () => {
    const entries = orderedReplayAnswerEntries({
      task_0: answer('task_0', '0', 3000),
      task_2: answer('task_2', '2', 1000),
      task_1: answer('task_1', '1', 2000),
    }, 'answer-time');

    expect(entries.map(([identifier]) => identifier)).toEqual(['task_2', 'task_1', 'task_0']);
  });

  test('keeps incomplete entries after chronological entries in sequence order', () => {
    const entries = orderedReplayAnswerEntries({
      task_3: answer('task_3', '3', 0, 0),
      task_2: answer('task_2', '2', 1000),
      task_1: answer('task_1', '1', 0, 0),
      task_0: answer('task_0', '0', 2000),
    }, 'answer-time');

    expect(entries.map(([identifier]) => identifier)).toEqual(['task_2', 'task_0', 'task_1', 'task_3']);
  });
});
