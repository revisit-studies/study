import {
  describe,
  expect,
  test,
} from 'vitest';
import { getUniformTimelineMetrics } from './timelineLayout';

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
