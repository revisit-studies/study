import {
  describe,
  expect,
  test,
} from 'vitest';
import { StoredAnswer } from '../../../parser/types';
import {
  getUniformTimelineMetrics,
  orderedUniformReplayAnswerEntries,
} from './timelineLayout';

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

describe('getUniformTimelineMetrics', () => {
  test('fills available width when tasks can be wider than the minimum', () => {
    const metrics = getUniformTimelineMetrics({
      availableWidth: 640,
      taskCount: 5,
      margin: { left: 20, right: 20 },
    });

    expect(metrics.timelineWidth).toBe(640);
    expect(metrics.taskWidth).toBe(120);
  });

  test('uses the minimum task width and expands the timeline when needed', () => {
    const metrics = getUniformTimelineMetrics({
      availableWidth: 200,
      taskCount: 6,
      margin: { left: 20, right: 20 },
    });

    expect(metrics.timelineWidth).toBe(328);
    expect(metrics.taskWidth).toBe(48);
  });
});

describe('orderedUniformReplayAnswerEntries', () => {
  test('orders completed tasks first, then incomplete tasks by trial order', () => {
    const entries = orderedUniformReplayAnswerEntries({
      task_3: answer('task_3', '3', 3000),
      task_1: answer('task_1', '1', 0, 0),
      task_2: answer('task_2', '2', 2000),
      task_0: answer('task_0', '0', 1000),
    });

    expect(entries.map(([identifier]) => identifier)).toEqual(['task_0', 'task_2', 'task_3', 'task_1']);
  });
});
