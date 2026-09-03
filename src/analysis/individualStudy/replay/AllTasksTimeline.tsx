import {
  JSX, useMemo, useState,
} from 'react';
import * as d3 from 'd3';
import {
  Box, Stack, Tooltip, Text,
} from '@mantine/core';
import { useResizeObserver } from '@mantine/hooks';
import { ParticipantData } from '../../../storage/types';
import { SingleTaskLabelLines } from './SingleTaskLabelLines';
import { SingleTask } from './SingleTask';
import { StoredAnswer, StudyConfig } from '../../../parser/types';
import { getComponentAnswerStatus } from '../../../utils/correctAnswer';
import { parseConditionParam } from '../../../utils/handleConditionLogic';
import { studyComponentToIndividualComponent } from '../../../utils/handleComponentInheritance';
import {
  compareReplayAnswerEntries,
  orderedReplayAnswerEntries,
  ReplayTaskOrder,
} from './taskOrdering';
import {
  getGapAwareTimelineLayout,
  getUniformTimelineMetrics,
  isValidTimelineInterval,
  TimelineMode,
} from './timelineLayout';

const LABEL_GAP = 25;
const CHARACTER_SIZE = 8;

const margin = {
  left: 20, top: 20, right: 20, bottom: 20,
};

function invalidTimelineAnchor(answer: Pick<StoredAnswer, 'startTime' | 'endTime'>, xScale: d3.ScaleLinear<number, number>) {
  if (Number.isFinite(answer.startTime) && answer.startTime > 0) {
    return answer.startTime;
  }
  if (Number.isFinite(answer.endTime) && answer.endTime > 0) {
    return answer.endTime;
  }
  return xScale.domain()[0];
}

function readableGapDuration(msDuration: number) {
  let secondsRemaining = Math.floor(msDuration / 1000);
  const units = [
    ['d', 86_400],
    ['h', 3_600],
    ['m', 60],
    ['s', 1],
  ] as const;

  const parts = units.flatMap(([label, seconds]) => {
    const value = Math.floor(secondsRemaining / seconds);
    secondsRemaining %= seconds;
    return value > 0 ? [`${value}${label}`] : [];
  });

  return parts.join(' ') || '0s';
}

export function AllTasksTimeline({
  participantData, width, studyId, studyConfig, maxLength, taskOrder = 'sequence', timelineMode = 'time',
}: { participantData: ParticipantData, width: number, studyId: string, studyConfig: StudyConfig | undefined, maxLength: number | undefined, taskOrder?: ReplayTaskOrder, timelineMode?: TimelineMode }) {
  const [hoveredTaskIdentifier, setHoveredTaskIdentifier] = useState<string | null>(null);
  const [timelineContainerRef, { width: containerWidth }] = useResizeObserver();
  const availableWidth = Math.max(containerWidth || width, 0);

  const percentComplete = useMemo(() => {
    const totalEntries = Object.entries(participantData.answers || {}).length;
    if (totalEntries === 0) {
      return 1;
    }
    const incompleteEntries = Object.entries(participantData.answers || {}).filter((e) => e[1].startTime === 0);

    return (totalEntries - incompleteEntries.length) / totalEntries;
  }, [participantData.answers]);

  const timelineWidth = useMemo(() => {
    if (timelineMode === 'time') {
      return availableWidth;
    }

    return getUniformTimelineMetrics({
      availableWidth,
      taskCount: Object.entries(participantData.answers || {}).length,
      margin,
    }).timelineWidth;
  }, [availableWidth, participantData.answers, timelineMode]);

  const { xScale, collapsedGaps, completedTimelineEnd } = useMemo(() => {
    if (timelineMode === 'uniform') {
      return {
        xScale: d3.scaleLinear([margin.left, timelineWidth - margin.right]).domain([0, Math.max(Object.entries(participantData.answers || {}).length, 1)]).clamp(true),
        collapsedGaps: [],
        completedTimelineEnd: timelineWidth - margin.right,
      };
    }

    const layout = getGapAwareTimelineLayout({
      answers: participantData.answers || {},
      rangeStart: margin.left,
      rangeEnd: timelineWidth * percentComplete - (percentComplete !== 1 ? 0 : margin.right),
      maxLength,
    });
    return { xScale: layout.scale, collapsedGaps: layout.collapsedGaps, completedTimelineEnd: layout.rangeEnd };
  }, [maxLength, participantData.answers, percentComplete, timelineMode, timelineWidth]);

  const renderedTimelineWidth = useMemo(() => {
    if (timelineMode === 'uniform') {
      return timelineWidth;
    }
    const originalCompletedEnd = timelineWidth * percentComplete - (percentComplete !== 1 ? 0 : margin.right);
    const incompleteWidth = Math.max(0, timelineWidth - margin.right - originalCompletedEnd);
    return Math.max(timelineWidth, completedTimelineEnd + incompleteWidth + margin.right);
  }, [completedTimelineEnd, percentComplete, timelineMode, timelineWidth]);

  const incompleteXScale = useMemo(() => {
    const scale = d3.scaleLinear([completedTimelineEnd, renderedTimelineWidth - margin.right]).domain([0, Object.entries(participantData.answers || {}).filter((e) => e[1].startTime === 0).length]).clamp(true);

    return scale;
  }, [completedTimelineEnd, participantData.answers, renderedTimelineWidth]);

  const maxHeight = useMemo(() => {
    const incompleteEntries = Object.entries(participantData.answers || {}).filter((e) => e[1].startTime === 0).sort(compareReplayAnswerEntries);
    const incompleteEntryIndexes = new Map(incompleteEntries.map(([identifier], index) => [identifier, index]));
    const sortedEntries = orderedReplayAnswerEntries(participantData.answers, taskOrder);
    const entryIndexes = new Map(sortedEntries.map(([identifier], index) => [identifier, index]));

    let currentHeight = 0;
    let _maxHeight = 0;

    sortedEntries.forEach((entry, i) => {
      const [identifier, answer] = entry;

      // Check if the previous entry overlaps with the current entry
      const prev = i > 0 ? sortedEntries[i - currentHeight - 1] : null;
      const prevScale = timelineMode === 'uniform' || (prev && prev[1].startTime !== 0) ? xScale : incompleteXScale;
      const prevStart = prev ? timelineMode === 'uniform'
        ? entryIndexes.get(prev[0]) ?? 0
        : prev[1].startTime === 0
          ? incompleteEntryIndexes.get(prev[0]) ?? 0
          : isValidTimelineInterval(prev[1]) ? prev[1].startTime : invalidTimelineAnchor(prev[1], xScale) : 0;
      const scale = timelineMode === 'uniform' || answer.startTime !== 0 ? xScale : incompleteXScale;
      const scaleStart = timelineMode === 'uniform'
        ? entryIndexes.get(identifier) ?? 0
        : answer.startTime === 0
          ? incompleteEntryIndexes.get(identifier) ?? 0
          : isValidTimelineInterval(answer) ? answer.startTime : invalidTimelineAnchor(answer, xScale);

      // If the previous entry overlaps with the current entry , increase the height
      if (prev && prev[0].length * (CHARACTER_SIZE + 1) + prevScale(prevStart) > scale(scaleStart)) {
        currentHeight += 1;
      } else {
        currentHeight = 0;
      }

      if (currentHeight > _maxHeight) {
        _maxHeight = currentHeight;
      }
    });

    return (_maxHeight + 1) * LABEL_GAP + margin.top + margin.bottom;
  }, [incompleteXScale, participantData.answers, taskOrder, timelineMode, xScale]);

  const conditionParam = useMemo(() => {
    const parsedConditions = parseConditionParam(participantData.conditions ?? participantData.searchParams?.condition);
    return parsedConditions.length > 0 ? parsedConditions.join(',') : undefined;
  }, [participantData.conditions, participantData.searchParams?.condition]);

  // Creating labels for the tasks
  const tasks: { identifier: string, line: JSX.Element, label: JSX.Element }[] = useMemo(() => {
    let currentHeight = 0;

    const incompleteEntries = Object.entries(participantData.answers || {}).filter((e) => e[1].startTime === 0).sort(compareReplayAnswerEntries);
    const incompleteEntryIndexes = new Map(incompleteEntries.map(([identifier], index) => [identifier, index]));
    const combined = orderedReplayAnswerEntries(participantData.answers, taskOrder);
    const entryIndexes = new Map(combined.map(([identifier], index) => [identifier, index]));

    const allElements = combined.map((entry, i) => {
      const scale = timelineMode === 'uniform' || entry[1].startTime !== 0 ? xScale : incompleteXScale;

      const [identifier, answer] = entry;

      const prev = i > 0 ? combined[i - currentHeight - 1] : null;

      const prevScale = timelineMode === 'uniform' || (prev && prev[1].startTime !== 0) ? xScale : incompleteXScale;
      const prevStart = prev ? timelineMode === 'uniform'
        ? entryIndexes.get(prev[0]) ?? 0
        : prev[1].startTime === 0
          ? incompleteEntryIndexes.get(prev[0]) ?? 0
          : isValidTimelineInterval(prev[1]) ? prev[1].startTime : invalidTimelineAnchor(prev[1], xScale) : 0;
      const incompleteEntryIndex = incompleteEntryIndexes.get(identifier) ?? 0;
      const uniformEntryIndex = entryIndexes.get(identifier) ?? 0;
      const hasValidTiming = isValidTimelineInterval(answer);
      const scaleStart = timelineMode === 'uniform'
        ? uniformEntryIndex
        : answer.startTime === 0 ? incompleteEntryIndex : hasValidTiming ? answer.startTime : invalidTimelineAnchor(answer, xScale);
      const scaleEnd = timelineMode === 'uniform'
        ? uniformEntryIndex + 1
        : answer.startTime === 0 ? incompleteEntryIndex + 1 : hasValidTiming ? answer.endTime : scaleStart;

      if (prev && prev[0].length * (CHARACTER_SIZE + 1) + prevScale(prevStart) > scale(scaleStart)) {
        currentHeight += 1;
      } else {
        currentHeight = 0;
      }

      const component = studyConfig?.components[answer.componentName];
      const resolvedComponent = component && studyConfig
        ? studyComponentToIndividualComponent(component, studyConfig)
        : undefined;
      const correctAnswers = answer.correctAnswer?.length
        ? answer.correctAnswer
        : resolvedComponent?.correctAnswer;
      const answerStatus = getComponentAnswerStatus(answer, correctAnswers, resolvedComponent?.response);
      const hasAudio = resolvedComponent?.recordAudio ?? studyConfig?.uiConfig?.recordAudio ?? false;
      const hasScreenRecording = resolvedComponent?.recordScreen ?? studyConfig?.uiConfig?.recordScreen ?? false;

      return {
        identifier,
        line: <SingleTaskLabelLines key={identifier} labelHeight={currentHeight * LABEL_GAP} height={maxHeight} xScale={scale} scaleStart={scaleStart} />,
        label: (
          <Tooltip
            key={`${identifier}-tooltip`}
            withinPortal
            position="bottom-start"
            px={4}
            py={0}
            withArrow
            label={(
              <Stack gap={0}>
                {Object.entries(answer.answer).map((a) => {
                  const [id, componentAnswer] = a;
                  const correctAnswer = correctAnswers?.find((c) => c.id === id)?.answer;
                  const participantAnswer = (componentAnswer === undefined || componentAnswer === null || componentAnswer === '')
                    ? 'N/A'
                    : typeof componentAnswer === 'object'
                      ? JSON.stringify(componentAnswer)
                      : componentAnswer;

                  return <Text key={id}>{`${id}: ${participantAnswer} ${correctAnswer !== undefined ? `[${typeof correctAnswer === 'object' ? JSON.stringify(correctAnswer) : correctAnswer}]` : ''}`}</Text>;
                })}
              </Stack>
            )}
          >
            <g>
              <SingleTask incomplete={answer.startTime === 0} answerStatus={answerStatus} hasAudio={hasAudio} hasScreenRecording={hasScreenRecording} key={identifier} labelHeight={currentHeight * LABEL_GAP} height={maxHeight} identifier={identifier} xScale={scale} scaleStart={scaleStart} scaleEnd={scaleEnd} trialOrder={answer.trialOrder} participantId={participantData.participantId} studyId={studyId} condition={conditionParam} isHovered={hoveredTaskIdentifier === identifier} isDimmed={hoveredTaskIdentifier !== null && hoveredTaskIdentifier !== identifier} onHover={() => setHoveredTaskIdentifier(identifier)} onHoverEnd={() => setHoveredTaskIdentifier(null)} />
            </g>
          </Tooltip>),
      };
    });

    return allElements;
  }, [participantData.answers, participantData.participantId, incompleteXScale, xScale, studyConfig, maxHeight, studyId, conditionParam, hoveredTaskIdentifier, taskOrder, timelineMode]);

  // Find entries of someone browsing away. Show them
  const browsedAway = useMemo(() => {
    if (timelineMode === 'uniform') {
      return [];
    }

    const sortedEntries = Object.entries(participantData.answers || {}).sort((a, b) => a[1].startTime - b[1].startTime);

    return sortedEntries.map((entry) => {
      const [, answer] = entry;

      const browsedAwayList: [number, number][] = [];
      let currentBrowsedAway: [number, number] = [-1, -1];
      let currentState: 'visible' | 'hidden' = 'visible';
      if (answer.windowEvents) {
        for (let i = 0; i < answer.windowEvents.length; i += 1) {
          if (answer.windowEvents[i][1] === 'visibility') {
            if (answer.windowEvents[i][2] === 'hidden' && currentState === 'visible') {
              currentBrowsedAway = [answer.windowEvents[i][0], -1];
              currentState = 'hidden';
            } else if (answer.windowEvents[i][2] === 'visible' && currentState === 'hidden') {
              currentBrowsedAway[1] = answer.windowEvents[i][0];
              browsedAwayList.push(currentBrowsedAway);
              currentBrowsedAway = [-1, -1];
              currentState = 'visible';
            }
          }
        }
      }

      return (
        browsedAwayList.map((browse, i) => <Tooltip withinPortal key={i} label="Browsed away"><rect x={xScale(browse[0])} width={Math.max(0, xScale(browse[1]) - xScale(browse[0]))} y={maxHeight - 5} height={10} /></Tooltip>)
      );
    });
  }, [xScale, maxHeight, participantData.answers, timelineMode]);

  const hoveredTask = tasks.find((task) => task.identifier === hoveredTaskIdentifier);

  return (
    <Box
      ref={timelineContainerRef}
      style={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        overflowX: timelineMode === 'uniform' || renderedTimelineWidth > availableWidth ? 'auto' : 'visible',
        overflowY: 'visible',
      }}
    >
      <svg
        onMouseLeave={() => setHoveredTaskIdentifier(null)}
        onPointerLeave={() => setHoveredTaskIdentifier(null)}
        onPointerCancel={() => setHoveredTaskIdentifier(null)}
        style={{
          width: renderedTimelineWidth,
          height: maxHeight,
          display: 'block',
          overflow: 'visible',
        }}
      >
        {collapsedGaps.map((gap) => {
          const label = `${readableGapDuration(gap.duration)} gap — no component timing recorded`;
          const midpoint = (gap.startX + gap.endX) / 2;
          return (
            <Tooltip withinPortal key={`${gap.startTime}-${gap.endTime}`} label={label}>
              <g data-testid="timeline-gap-break" aria-label={label}>
                <rect x={gap.startX} width={gap.endX - gap.startX} y={maxHeight - 25} height={25} fill="var(--mantine-color-orange-1)" />
                <line x1={gap.startX} x2={gap.startX} y1={maxHeight - 25} y2={maxHeight} stroke="var(--mantine-color-orange-7)" strokeDasharray="3 2" />
                <line x1={gap.endX} x2={gap.endX} y1={maxHeight - 25} y2={maxHeight} stroke="var(--mantine-color-orange-7)" strokeDasharray="3 2" />
                <text x={midpoint} y={maxHeight - 12.5} textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight={700} fill="var(--mantine-color-orange-9)">&#47;&#47;</text>
              </g>
            </Tooltip>
          );
        })}
        {tasks.map((t) => t.line)}
        {tasks.filter((t) => t.identifier !== hoveredTaskIdentifier).map((t) => t.label)}
        {browsedAway}
        {hoveredTask?.label}
      </svg>
    </Box>

  );
}
