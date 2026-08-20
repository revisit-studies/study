import * as d3 from 'd3';
import type { StoredAnswer } from '../../../parser/types';

export type TimelineMode = 'time' | 'uniform';

export const UNIFORM_TASK_MIN_WIDTH = 48;
export const TIMELINE_GAP_BREAK_WIDTH = 16;

export function isValidTimelineInterval(answer: Pick<StoredAnswer, 'startTime' | 'endTime'>) {
  return Number.isFinite(answer.startTime)
    && Number.isFinite(answer.endTime)
    && answer.startTime > 0
    && answer.endTime > 0
    && answer.endTime >= answer.startTime;
}

export type CollapsedTimelineGap = {
  startTime: number;
  endTime: number;
  duration: number;
  startX: number;
  endX: number;
};

type TimelineMargin = {
  left: number;
  right: number;
};

export function getGapAwareTimelineLayout({
  answers,
  rangeStart,
  rangeEnd,
  maxLength,
}: {
  answers: Record<string, Pick<StoredAnswer, 'startTime' | 'endTime'>>;
  rangeStart: number;
  rangeEnd: number;
  maxLength?: number;
}) {
  const intervals = Object.values(answers)
    .filter(isValidTimelineInterval)
    .map((answer) => ({ startTime: answer.startTime, endTime: answer.endTime }))
    .sort((a, b) => a.startTime - b.startTime);
  const safeRangeEnd = Math.max(rangeStart, rangeEnd);

  if (intervals.length === 0) {
    return {
      scale: d3.scaleLinear([rangeStart, safeRangeEnd]).domain([0, 1]).clamp(true),
      collapsedGaps: [] as CollapsedTimelineGap[],
      rangeEnd: safeRangeEnd,
    };
  }

  const domainStart = intervals[0].startTime;
  const domainEnd = maxLength === undefined
    ? Math.max(...intervals.map((interval) => interval.endTime))
    : domainStart + Math.max(0, maxLength);
  const merged = intervals
    .filter((interval) => interval.startTime <= domainEnd)
    .map((interval) => ({
      startTime: interval.startTime,
      endTime: Math.min(interval.endTime, domainEnd),
    }))
    .reduce<{ startTime: number; endTime: number }[]>((result, interval) => {
      const previous = result.at(-1);
      if (previous && interval.startTime <= previous.endTime) {
        previous.endTime = Math.max(previous.endTime, interval.endTime);
      } else {
        result.push(interval);
      }
      return result;
    }, []);
  const domainSpan = Math.max(0, domainEnd - domainStart);
  if (domainSpan === 0) {
    return {
      scale: d3.scaleLinear([rangeStart, rangeStart]).domain([domainStart, domainStart + 1]).clamp(true),
      collapsedGaps: [] as CollapsedTimelineGap[],
      rangeEnd: rangeStart,
    };
  }

  const gaps = merged.slice(1).map((interval, index) => ({
    startTime: merged[index].endTime,
    endTime: interval.startTime,
    duration: interval.startTime - merged[index].endTime,
  })).filter((gap) => domainSpan > 0 && gap.duration / domainSpan > 0.1);
  const collapsedDuration = gaps.reduce((total, gap) => total + gap.duration, 0);
  const retainedDuration = Math.max(0, domainSpan - collapsedDuration);
  const effectiveRangeEnd = Math.max(safeRangeEnd, rangeStart + gaps.length * TIMELINE_GAP_BREAK_WIDTH);
  const availableWidth = effectiveRangeEnd - rangeStart;
  const linearWidth = Math.max(0, availableWidth - gaps.length * TIMELINE_GAP_BREAK_WIDTH);
  const pixelsPerMillisecond = retainedDuration > 0 ? linearWidth / retainedDuration : 0;
  const domain = [domainStart];
  const range = [rangeStart];
  const collapsedGaps: CollapsedTimelineGap[] = [];
  let currentTime = domainStart;
  let currentX = rangeStart;

  gaps.forEach((gap) => {
    currentX += (gap.startTime - currentTime) * pixelsPerMillisecond;
    if (gap.startTime > currentTime) {
      domain.push(gap.startTime);
      range.push(currentX);
    }
    domain.push(gap.endTime);
    range.push(currentX + TIMELINE_GAP_BREAK_WIDTH);
    collapsedGaps.push({
      ...gap,
      startX: currentX,
      endX: currentX + TIMELINE_GAP_BREAK_WIDTH,
    });
    currentX += TIMELINE_GAP_BREAK_WIDTH;
    currentTime = gap.endTime;
  });

  if (domainEnd > currentTime) {
    domain.push(domainEnd);
    range.push(effectiveRangeEnd);
  }

  return {
    scale: d3.scaleLinear(range).domain(domain).clamp(true),
    collapsedGaps,
    rangeEnd: effectiveRangeEnd,
  };
}

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
