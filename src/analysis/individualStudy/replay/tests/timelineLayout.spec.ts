import {
  describe,
  expect,
  test,
} from 'vitest';
import {
  getGapAwareTimelineLayout,
  getUniformTimelineMetrics,
  TIMELINE_GAP_BREAK_WIDTH,
} from '../timelineLayout';

const t0 = 1_700_000_000_000;

describe('getGapAwareTimelineLayout', () => {
  test('compresses a large uncovered interval while preserving task duration proportions', () => {
    const layout = getGapAwareTimelineLayout({
      answers: {
        first: { startTime: t0, endTime: t0 + 10_000 },
        second: { startTime: t0 + 3_610_000, endTime: t0 + 3_630_000 },
      },
      rangeStart: 20,
      rangeEnd: 620,
    });

    expect(layout.collapsedGaps).toHaveLength(1);
    expect(layout.collapsedGaps[0].endX - layout.collapsedGaps[0].startX).toBe(TIMELINE_GAP_BREAK_WIDTH);
    const firstWidth = layout.scale(t0 + 10_000) - layout.scale(t0);
    const secondWidth = layout.scale(t0 + 3_630_000) - layout.scale(t0 + 3_610_000);
    expect(secondWidth / firstWidth).toBeCloseTo(2);
  });

  test('does not create breaks for small gaps or overlapping intervals', () => {
    const layout = getGapAwareTimelineLayout({
      answers: {
        first: { startTime: t0, endTime: t0 + 10_000 },
        overlap: { startTime: t0 + 5_000, endTime: t0 + 15_000 },
        next: { startTime: t0 + 16_000, endTime: t0 + 30_000 },
        invalid: { startTime: t0 + 40_000, endTime: t0 + 35_000 },
      },
      rangeStart: 20,
      rangeEnd: 620,
    });

    expect(layout.collapsedGaps).toEqual([]);
  });

  test('uses the break width for gaps between zero-duration intervals', () => {
    const layout = getGapAwareTimelineLayout({
      answers: {
        first: { startTime: t0, endTime: t0 },
        second: { startTime: t0 + 10_000, endTime: t0 + 10_000 },
      },
      rangeStart: 20,
      rangeEnd: 620,
    });

    expect(layout.scale(t0)).toBe(layout.collapsedGaps[0].startX);
    expect(layout.scale(t0 + 10_000)).toBe(layout.collapsedGaps[0].endX);
  });

  test('keeps multiple breaks monotonic when their fixed widths exceed the range', () => {
    const times = [0, 1_000, 2_000, 3_000, 4_000].map((offset) => t0 + offset);
    const layout = getGapAwareTimelineLayout({
      answers: Object.fromEntries(times.map((time, index) => [`task${index}`, { startTime: time, endTime: time }])),
      rangeStart: 20,
      rangeEnd: 40,
    });
    const positions = times.map(layout.scale);

    expect(layout.collapsedGaps).toHaveLength(4);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(layout.collapsedGaps.at(-1)?.endX).toBeLessThanOrEqual(layout.rangeEnd);
  });
});

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
