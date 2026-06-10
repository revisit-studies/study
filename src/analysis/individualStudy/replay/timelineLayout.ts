import { StoredAnswer } from '../../../parser/types';
import { compareReplayAnswerEntries, ReplayAnswerEntry } from './taskOrdering';

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

export function orderedUniformReplayAnswerEntries(answers: Record<string, StoredAnswer> = {}) {
  const entries = Object.entries(answers) as ReplayAnswerEntry[];
  const completed = entries.filter((entry) => entry[1].startTime !== 0).sort(compareReplayAnswerEntries);
  const incomplete = entries.filter((entry) => entry[1].startTime === 0).sort(compareReplayAnswerEntries);

  return [...completed, ...incomplete];
}
