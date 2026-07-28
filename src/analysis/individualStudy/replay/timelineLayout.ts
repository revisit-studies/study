export type TimelineMode = 'time' | 'uniform';

export const UNIFORM_TASK_MIN_WIDTH = 48;

type TimelineMargin = {
  left: number;
  right: number;
};

export function getUniformTimelineMetrics({
  availableWidth,
  taskCount,
  margin,
  minTaskWidth = UNIFORM_TASK_MIN_WIDTH,
}: {
  availableWidth: number;
  taskCount: number;
  margin: TimelineMargin;
  minTaskWidth?: number;
}) {
  const safeTaskCount = Math.max(taskCount, 1);
  const availableInnerWidth = Math.max(0, availableWidth - margin.left - margin.right);
  const timelineInnerWidth = Math.max(availableInnerWidth, safeTaskCount * minTaskWidth);

  return {
    taskWidth: timelineInnerWidth / safeTaskCount,
    timelineWidth: timelineInnerWidth + margin.left + margin.right,
  };
}
