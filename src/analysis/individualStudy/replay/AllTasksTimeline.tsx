import {
  JSX, useMemo, useState,
} from 'react';
import * as d3 from 'd3';
import {
  Box, Center, Stack, Tooltip, Text,
} from '@mantine/core';
import { ParticipantData } from '../../../storage/types';
import { SingleTaskLabelLines } from './SingleTaskLabelLines';
import { SingleTask } from './SingleTask';
import { StudyConfig } from '../../../parser/types';
import { getComponentAnswerStatus } from '../../../utils/correctAnswer';
import { parseConditionParam } from '../../../utils/handleConditionLogic';
import { studyComponentToIndividualComponent } from '../../../utils/handleComponentInheritance';
import {
  compareReplayAnswerEntries,
  orderedReplayAnswerEntries,
  ReplayTaskOrder,
} from './taskOrdering';
import {
  getUniformTimelineMetrics,
  TimelineMode,
} from './timelineLayout';

const LABEL_GAP = 25;
const CHARACTER_SIZE = 8;

const margin = {
  left: 20, top: 20, right: 20, bottom: 20,
};

export function AllTasksTimeline({
  participantData, width, studyId, studyConfig, maxLength, taskOrder = 'sequence', timelineMode = 'time',
}: { participantData: ParticipantData, width: number, studyId: string, studyConfig: StudyConfig | undefined, maxLength: number | undefined, taskOrder?: ReplayTaskOrder, timelineMode?: TimelineMode }) {
  const [hoveredTaskIdentifier, setHoveredTaskIdentifier] = useState<string | null>(null);

  const percentComplete = useMemo(() => {
    const incompleteEntries = Object.entries(participantData.answers || {}).filter((e) => e[1].startTime === 0);

    return (Object.entries(participantData.answers).length - incompleteEntries.length) / (Object.entries(participantData.answers).length);
  }, [participantData.answers]);

  const timelineWidth = useMemo(() => {
    if (timelineMode === 'time') {
      return width;
    }

    return getUniformTimelineMetrics({
      availableWidth: width,
      taskCount: Object.entries(participantData.answers || {}).length,
      margin,
    }).timelineWidth;
  }, [participantData.answers, timelineMode, width]);

  const xScale = useMemo(() => {
    if (timelineMode === 'uniform') {
      return d3.scaleLinear([margin.left, timelineWidth - margin.right]).domain([0, Math.max(Object.entries(participantData.answers || {}).length, 1)]).clamp(true);
    }

    const allStartTimes = Object.values(participantData.answers || {}).filter((answer) => answer.startTime).map((answer) => [answer.startTime, answer.endTime]).flat();

    const extent = d3.extent(allStartTimes) as [number, number];

    const scale = d3.scaleLinear([margin.left, (timelineWidth * percentComplete - (percentComplete !== 1 ? 0 : margin.right))]).domain([extent[0], maxLength ? extent[0] + maxLength : extent[1]]).clamp(true);

    return scale;
  }, [maxLength, participantData.answers, percentComplete, timelineMode, timelineWidth]);

  const incompleteXScale = useMemo(() => {
    const scale = d3.scaleLinear([timelineWidth * percentComplete, timelineWidth - margin.right]).domain([0, Object.entries(participantData.answers || {}).filter((e) => e[1].startTime === 0).length]).clamp(true);

    return scale;
  }, [participantData.answers, percentComplete, timelineWidth]);

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
      const prevScale = timelineMode === 'uniform' || (prev && prev[1].startTime) ? xScale : incompleteXScale;
      const prevStart = prev ? timelineMode === 'uniform' ? entryIndexes.get(prev[0]) ?? 0 : prev[1].startTime ? prev[1].startTime : incompleteEntryIndexes.get(prev[0]) ?? 0 : 0;
      const scale = timelineMode === 'uniform' || answer.startTime !== 0 ? xScale : incompleteXScale;
      const scaleStart = timelineMode === 'uniform' ? entryIndexes.get(identifier) ?? 0 : answer.startTime ? answer.startTime : incompleteEntryIndexes.get(identifier) ?? 0;

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

      const prevScale = timelineMode === 'uniform' || (prev && prev[1].startTime) ? xScale : incompleteXScale;
      const prevStart = prev ? timelineMode === 'uniform' ? entryIndexes.get(prev[0]) ?? 0 : prev[1].startTime ? prev[1].startTime : incompleteEntryIndexes.get(prev[0]) ?? 0 : 0;
      const incompleteEntryIndex = incompleteEntryIndexes.get(identifier) ?? 0;
      const uniformEntryIndex = entryIndexes.get(identifier) ?? 0;
      const scaleStart = timelineMode === 'uniform' ? uniformEntryIndex : answer.startTime ? answer.startTime : incompleteEntryIndex;
      const scaleEnd = timelineMode === 'uniform' ? uniformEntryIndex + 1 : answer.endTime > 0 ? answer.endTime : incompleteEntryIndex + 1;

      if (prev && prev[0].length * (CHARACTER_SIZE + 1) + prevScale(prevStart) > scale(scaleStart)) {
        currentHeight += 1;
      } else {
        currentHeight = 0;
      }

      const component = studyConfig?.components[answer.componentName];
      const resolvedComponent = component && studyConfig
        ? studyComponentToIndividualComponent(component, studyConfig)
        : undefined;
      const correctAnswers = answer.correctAnswer.length > 0
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
                  const correctAnswer = resolvedComponent?.correctAnswer?.find((c) => c.id === id)?.answer;
                  const participantAnswer = (componentAnswer === undefined || componentAnswer === null || componentAnswer === '')
                    ? 'N/A'
                    : typeof componentAnswer === 'object'
                      ? JSON.stringify(componentAnswer)
                      : componentAnswer;

                  return <Text key={id}>{`${id}: ${participantAnswer} ${correctAnswer ? `[${typeof correctAnswer === 'object' ? JSON.stringify(correctAnswer) : correctAnswer}]` : ''}`}</Text>;
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

  return (
    <Center style={{ width: '100%', minWidth: 0 }}>
      <Stack gap={15} style={{ width: '100%', minWidth: 0 }}>
        <Box style={{
          width: '100%', maxWidth: '100%', minWidth: 0, overflowX: timelineMode === 'uniform' ? 'auto' : 'visible', overflowY: 'visible',
        }}
        >
          <svg
            onMouseLeave={() => setHoveredTaskIdentifier(null)}
            style={{
              width: timelineWidth,
              height: maxHeight,
              display: 'block',
              overflow: 'visible',
            }}
          >
            {tasks.map((t) => t.line)}
            {tasks.map((t) => t.label)}
            {browsedAway}
          </svg>
        </Box>
      </Stack>
    </Center>

  );
}
