import { JSX, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import {
  Center, Group, Stack, Tooltip, Text,
} from '@mantine/core';
import { ParticipantData } from '../../../storage/types';
import { SingleTaskLabelLines } from './SingleTaskLabelLines';
import { SingleTask } from './SingleTask';
import { encryptIndex } from '../../../utils/encryptDecryptIndex';
import { StudyConfig } from '../../../parser/types';
import { PREFIX } from '../../../utils/Prefix';
import { getSequenceFlatMap } from '../../../utils/getSequenceFlatMap';

const LABEL_GAP = 25;
const CHARACTER_SIZE = 8;

const margin = {
  left: 20, top: 20, right: 20, bottom: 20,
};

export function AllTasksTimeline({
  participantData, width, selectedTask, studyId, studyConfig, maxLength,
} : {participantData: ParticipantData, width: number, studyId: string, selectedTask?: string | null, studyConfig: StudyConfig | undefined, maxLength: number | undefined}) {
  const clickTask = useCallback((task: string) => {
    const split = task.split('_');
    const index = +split[split.length - 1];

    window.open(`${PREFIX}${studyId}/${encryptIndex(index)}?participantId=${participantData.participantId}`, '_blank');
  }, [participantData.participantId, studyId]);

  const percentComplete = useMemo(() => {
    const incompleteEntries = Object.entries(participantData.answers || {}).filter((e) => e[1].startTime === 0);

    return (Object.entries(participantData.answers).length - incompleteEntries.length) / (getSequenceFlatMap(participantData.sequence).length - 1);
  }, [participantData.answers, participantData.sequence]);

  const xScale = useMemo(() => {
    const allStartTimes = Object.values(participantData.answers || {}).filter((answer) => answer.startTime).map((answer) => [answer.startTime, answer.endTime]).flat();

    const extent = d3.extent(allStartTimes) as [number, number];

    const scale = d3.scaleLinear([margin.left, (width * percentComplete - (percentComplete !== 1 ? 0 : margin.right))]).domain([extent[0], maxLength ? extent[0] + maxLength : extent[1]]).clamp(true);

    return scale;
  }, [maxLength, participantData.answers, percentComplete, width]);

  const incompleteXScale = useMemo(() => {
    const scale = d3.scaleLinear([width * percentComplete, width - margin.right]).domain([0, Object.entries(participantData.answers || {}).filter((e) => e[1].startTime === 0).length]).clamp(true);

    return scale;
  }, [participantData.answers, percentComplete, width]);

  const maxHeight = useMemo(() => {
    const sortedEntries = Object.entries(participantData.answers || {}).filter((answer) => !!(answer[1].startTime)).sort((a, b) => a[1].startTime - b[1].startTime);

    let currentHeight = 0;
    let _maxHeight = 0;

    sortedEntries.forEach((entry, i) => {
      const [_name, answer] = entry;

      const prev = i > 0 ? sortedEntries[i - currentHeight - 1] : null;

      if (prev && prev[0].length * (CHARACTER_SIZE + 1) + xScale(prev[1].startTime) > xScale(answer.startTime)) {
        currentHeight += 1;
      } else {
        currentHeight = 0;
      }

      if (currentHeight > _maxHeight) {
        _maxHeight = currentHeight;
      }
    });

    return _maxHeight * LABEL_GAP + margin.top + margin.bottom;
  }, [participantData.answers, xScale]);

  // Creating labels for the tasks
  const tasks: {line: JSX.Element, label: JSX.Element}[] = useMemo(() => {
    let currentHeight = 0;

    // Think thisll fail with dynamic blocks
    const incompleteEntries = Object.entries(participantData.answers || {}).filter((e) => e[1].startTime === 0).sort((a, b) => getSequenceFlatMap(participantData.sequence).indexOf(a[0]) - getSequenceFlatMap(participantData.sequence).indexOf(b[0]));

    const sortedEntries = Object.entries(participantData.answers || {}).filter((answer) => !!(answer[1].startTime)).sort((a, b) => a[1].startTime - b[1].startTime);

    const combined = [...sortedEntries, ...incompleteEntries];

    const allElements = combined.map((entry, i) => {
      const scale = entry[1].startTime === 0 ? incompleteXScale : xScale;

      const [name, answer] = entry;

      const prev = i > 0 ? combined[i - currentHeight - 1] : null;

      const prevScale = prev && prev[1].startTime ? xScale : incompleteXScale;
      const prevStart = prev ? prev[1].startTime ? prev[1].startTime : incompleteEntries.indexOf(prev) : 0;
      const scaleStart = answer.startTime ? answer.startTime : incompleteEntries.indexOf(entry);
      const scaleEnd = answer.endTime > 0 ? answer.endTime : incompleteEntries.indexOf(entry) + 1;

      if (prev && prev[0].length * (CHARACTER_SIZE + 1) + prevScale(prevStart) > scale(scaleStart)) {
        currentHeight += 1;
      } else {
        currentHeight = 0;
      }

      const split = name.split('_');
      const joinExceptLast = split.slice(0, split.length - 1).join('_');

      const component = studyConfig?.components[joinExceptLast];

      let isCorrect = true;
      let hasCorrect = false;

      if (component && component.correctAnswer) {
        component.correctAnswer.forEach((a) => {
          const { id, answer: componentCorrectAnswer } = a;

          if (!component || !component.correctAnswer || answer.answer[id] !== componentCorrectAnswer) {
            isCorrect = false;
          }
        });

        hasCorrect = true;
      } else {
        hasCorrect = false;
      }

      return {
        line: <SingleTaskLabelLines key={name} labelHeight={currentHeight * LABEL_GAP} height={maxHeight} xScale={scale} scaleStart={scaleStart} />,
        label: (
          <Tooltip
            key={`${name}-tooltip`}
            withinPortal
            position="bottom-start"
            px={4}
            py={0}
            withArrow
            label={(
              <Stack gap={0}>
                {Object.entries(answer.answer).map((a) => {
                  const [id, componentAnswer] = a;
                  const correctAnswer = component?.correctAnswer?.find((c) => c.id === id)?.answer;

                  return <Text key={id}>{`${id}: ${componentAnswer} ${correctAnswer ? `[${correctAnswer}]` : ''}`}</Text>;
                })}
              </Stack>
            )}
          >
            <g>
              <SingleTask incomplete={answer.startTime === 0} isCorrect={isCorrect} hasCorrect={hasCorrect} key={name} labelHeight={currentHeight * LABEL_GAP} isSelected={selectedTask === name} setSelectedTask={clickTask} height={maxHeight} name={name} xScale={scale} scaleStart={scaleStart} scaleEnd={scaleEnd} />
            </g>
          </Tooltip>),
      };
    });

    return allElements;
  }, [participantData.answers, participantData.sequence, incompleteXScale, xScale, studyConfig?.components, maxHeight, selectedTask, clickTask]);

  // Find entries of someone browsing away. Show them
  const browsedAway = useMemo(() => {
    const sortedEntries = Object.entries(participantData.answers || {}).sort((a, b) => a[1].startTime - b[1].startTime);

    return sortedEntries.map((entry) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [name, answer] = entry;

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
        browsedAwayList.map((browse, i) => <Tooltip withinPortal key={i} label="Browsed away"><rect x={xScale(browse[0])} width={xScale(browse[1]) - xScale(browse[0])} y={maxHeight - 5} height={10} /></Tooltip>)
      );
    });
  }, [xScale, maxHeight, participantData.answers]);

  return (
    <Center>
      <Stack gap={15} style={{ width: '100%' }}>
        {/* <Divider size="md" /> */}
        <Group justify="space-between">
          <Group justify="center">
            {/* {participantData.participantIndex
              ? (
                <Text>
                  {`P-${participantData.participantIndex.toString().padStart(3, '0')}`}
                </Text>
              ) : null }

            <Text size="md" fw={700}>
              {partName || participantData.participantId}
            </Text>

            <Text size="md">
              {completionTime}
            </Text>

            {participantData.completed ? null : <Text size="xl" c="red">Not completed</Text>} */}

            {/* <Group gap={10}>
              <Badge
                variant="light"
                size="lg"
                color="green"
                leftSection={<IconCheck width={18} height={18} style={{ paddingTop: 1 }} />}
                pb={1}
              >
                {numComponentsAnsweredCorrectly}
              </Badge>
              <Badge
                variant="light"
                size="lg"
                color="red"
                leftSection={<IconX width={18} height={18} style={{ paddingTop: 1 }} />}
                pb={1}
              >
                {numComponentsWithCorrectAnswer - numComponentsAnsweredCorrectly}
              </Badge>
              <Badge
                variant="light"
                size="lg"
                color="gray"
                leftSection={<IconHourglassEmpty width={18} height={18} style={{ paddingTop: 1 }} />}
                pb={1}
              >
                {humanReadableDuration(duration)}
              </Badge>
            </Group> */}

          </Group>
          {/* <Button
            rightSection={<IconExternalLink size={14} />}
            component="a"
            href={`${PREFIX}${studyId}/${encryptIndex(0)}?participantId=${participantData.participantId}`}
            target="_blank"
          >
            Go to replay
          </Button> */}
        </Group>

        <svg style={{ width, height: maxHeight, overflow: 'visible' }}>
          {tasks.map((t) => t.line)}
          {tasks.map((t) => t.label)}
          {browsedAway}
        </svg>
      </Stack>
    </Center>

  );
}
