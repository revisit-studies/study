import { Center, Group, Text } from '@mantine/core';
import * as d3 from 'd3';

import { useResizeObserver } from '@mantine/hooks';
import {
  IconCheck, IconDeviceDesktop, IconMicrophone, IconProgress, IconX,
} from '@tabler/icons-react';
import { useNavigateToTrial } from '../../../utils/useNavigateToTrial';
import type { ComponentAnswerStatus } from '../../../utils/correctAnswer';
import { UnknownAnswerIcon } from '../../../components/interface/UnknownAnswerIcon';

const LABEL_MARGIN = 3;
const TIMELINE_HEIGHT = 25;
const LABEL_DISTANCE = 25;
const LABEL_HEIGHT = 20;
const TASK_GAP = 1;
const LABEL_MAX_WIDTH = 160;
const ICON_SIZE = 14;
const ICON_GAP = 2;

function taskFill({
  incomplete,
  hasCorrect,
  isCorrect,
}: {
  incomplete: boolean,
  hasCorrect: boolean,
  isCorrect: boolean,
}) {
  if (incomplete) {
    return '#e9ecef';
  }

  if (!hasCorrect) {
    return 'lightgray';
  }

  return isCorrect ? '#bfe8c6' : '#f3c1c1';
}

export function SingleTask({
  xScale,
  identifier,
  height,
  labelHeight = 0,
  answerStatus,
  hasAudio,
  hasScreenRecording,
  scaleStart,
  scaleEnd,
  incomplete,
  trialOrder,
  participantId,
  studyId,
  condition,
  isHovered = false,
  isDimmed = false,
  onHover,
  onHoverEnd,
}: {
  identifier: string,
  height: number,
  xScale: d3.ScaleLinear<number, number>,
  labelHeight?: number,
  answerStatus: ComponentAnswerStatus | null,
  hasAudio: boolean,
  hasScreenRecording: boolean,
  scaleStart: number,
  scaleEnd: number,
  incomplete: boolean,
  trialOrder: string,
  participantId: string,
  studyId: string,
  condition?: string
  isHovered?: boolean,
  isDimmed?: boolean,
  onHover?: () => void,
  onHoverEnd?: () => void,
}) {
  const [ref, { width: labelWidth }] = useResizeObserver();

  const navigateToTrial = useNavigateToTrial();
  const iconCount = (incomplete || answerStatus ? 1 : 0) + (hasAudio ? 1 : 0) + (hasScreenRecording ? 1 : 0);
  const iconsWidth = iconCount * (ICON_SIZE + ICON_GAP);
  const labelOpacity = isDimmed ? 0.35 : 1;

  const answerStatusIcon = answerStatus === 'correct'
    ? (
      <IconCheck
        color="var(--mantine-color-green-6)"
        style={{ marginTop: 2, strokeWidth: 4 }}
        size="14"
      />
    )
    : answerStatus === 'incorrect'
      ? (
        <IconX
          color="var(--mantine-color-red-6)"
          style={{ marginTop: 2, strokeWidth: 4 }}
          size={14}
        />
      )
      : answerStatus === 'unknown'
        ? <UnknownAnswerIcon size={14} style={{ marginTop: 2 }} />
        : null;

  return (
    <g
      onClick={() => navigateToTrial(trialOrder, participantId, studyId, condition)}
      onPointerEnter={onHover}
      onPointerLeave={onHoverEnd}
      onPointerCancel={onHoverEnd}
      style={{ cursor: 'pointer' }}
    >
      <rect
        opacity={isDimmed ? 0.45 : 1}
        fill={taskFill({ incomplete, hasCorrect, isCorrect })}
        stroke={isHovered ? 'cornflowerblue' : undefined}
        strokeWidth={isHovered ? 3 : 0}
        x={xScale(scaleStart) + TASK_GAP}
        width={Math.max(0, xScale(scaleEnd) - xScale(scaleStart) - TASK_GAP * 2)}
        y={height - TIMELINE_HEIGHT}
        height={TIMELINE_HEIGHT}
      />
      <rect
        rx={3}
        opacity={1}
        x={xScale(scaleStart) - LABEL_MARGIN}
        width={labelWidth + LABEL_MARGIN * 2 + iconsWidth}
        y={height - TIMELINE_HEIGHT - LABEL_DISTANCE - labelHeight}
        height={LABEL_HEIGHT}
        fill="whitesmoke"
      />
      <line
        stroke="black"
        strokeWidth={1}
        opacity={labelOpacity}
        x1={xScale(scaleStart) - LABEL_MARGIN}
        x2={labelWidth + xScale(scaleStart) + LABEL_MARGIN + iconsWidth}
        y1={height - TIMELINE_HEIGHT - LABEL_DISTANCE + LABEL_HEIGHT - labelHeight}
        y2={height - TIMELINE_HEIGHT - LABEL_DISTANCE + LABEL_HEIGHT - labelHeight}
      />
      <foreignObject
        x={xScale(scaleStart)}
        width={labelWidth + iconsWidth}
        y={height - TIMELINE_HEIGHT - LABEL_DISTANCE - labelHeight}
        height={LABEL_HEIGHT}
      >
        <Center style={{ width: 'fit-content', opacity: labelOpacity }}>
          <Group wrap="nowrap" gap={2}>
            <Text truncate={!isHovered} ref={ref} mx={0} style={{ maxWidth: isHovered ? undefined : LABEL_MAX_WIDTH, fontWeight: 600, whiteSpace: 'nowrap' }} size="12px">
              {identifier}
            </Text>
            {hasScreenRecording && (
              <IconDeviceDesktop
                color="orange"
                size="14"
              />
            )}
            {hasAudio && (
              <IconMicrophone
                color="orange"
                size="14"
              />
            )}
            {incomplete ? (
              <IconProgress
                color="orange"
                size="14"
              />
            ) : answerStatusIcon}
          </Group>

        </Center>
      </foreignObject>
    </g>
  );
}
