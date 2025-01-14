import { useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import {
  Center, Group, Stack, Tooltip, Text,
  Divider,
  Button,
  Badge,
} from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import {
  IconCheck, IconExternalLink, IconHourglassEmpty, IconX,
} from '@tabler/icons-react';
import { ParticipantData } from '../../../storage/types';
import { SingleTaskLabelLines } from './SingleTaskLabelLines';
import { SingleTask } from './SingleTask';
import { encryptIndex } from '../../../utils/encryptDecryptIndex';
import { humanReadableDuration } from '../../../utils/humanReadableDuration';
import { StudyConfig } from '../../../parser/types';
import { PREFIX } from '../../../utils/Prefix';

const LABEL_GAP = 25;
const CHARACTER_SIZE = 8;

const margin = {
  left: 20, top: 0, right: 20, bottom: 0,
};

export function AllTasksTimeline({
  participantData, width, height, selectedTask, studyId, studyConfig, maxLength,
} : {participantData: ParticipantData, width: number, studyId: string, height: number, selectedTask?: string | null, studyConfig: StudyConfig | undefined, maxLength: number | undefined}) {
  const navigate = useNavigate();

  const clickTask = useCallback((task: string) => {
    const split = task.split('_');
    const index = +split[split.length - 1];

    navigate(`/${studyId}/${encryptIndex(index)}?participantId=${participantData.participantId}`);
  }, [navigate, participantData.participantId, studyId]);

  const xScale = useMemo(() => {
    const allStartTimes = Object.values(participantData.answers || {}).filter((answer) => answer.startTime).map((answer) => [answer.startTime, answer.endTime]).flat();

    const extent = d3.extent(allStartTimes) as [number, number];

    const scale = d3.scaleLinear([margin.left, width - margin.left - margin.right]).domain([extent[0], maxLength ? extent[0] + maxLength : extent[1]]).clamp(true);

    return scale;
  }, [maxLength, participantData.answers, width]);

  // Creating labels for the tasks
  const [correctAnswersCount, totalAnswersWithCorrectCount, tasks] : [number, number, {line: JSX.Element, label: JSX.Element}[]] = useMemo(() => {
    let currentHeight = 0;

    const sortedEntries = Object.entries(participantData.answers || {}).filter((answer) => !!(answer[1].startTime)).sort((a, b) => a[1].startTime - b[1].startTime);

    let _correctAnswersCount = 0;
    let _totalAnswersWithCorrectCount = 0;

    const allElements = sortedEntries.map((entry, i) => {
      const [name, answer] = entry;

      const prev = i > 0 ? sortedEntries[i - currentHeight - 1] : null;

      if (prev && prev[0].length * (CHARACTER_SIZE + 1) + xScale(prev[1].startTime) > xScale(answer.startTime)) {
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

          if (!answer.answer[id]) {
            hasCorrect = false;
          }
          if (!component || !component.correctAnswer || answer.answer[id] !== componentCorrectAnswer) {
            isCorrect = false;
          }
        });

        hasCorrect = true;
      } else {
        hasCorrect = false;
      }

      if (isCorrect && hasCorrect) {
        _correctAnswersCount += 1;
      }
      if (hasCorrect) {
        _totalAnswersWithCorrectCount += 1;
      }

      return {
        line: <SingleTaskLabelLines key={name} labelHeight={currentHeight * LABEL_GAP} answer={answer} height={height} xScale={xScale} />,
        label: (
          <Tooltip
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
              <SingleTask isCorrect={isCorrect} hasCorrect={hasCorrect} key={name} labelHeight={currentHeight * LABEL_GAP} isSelected={selectedTask === name} setSelectedTask={clickTask} answer={answer} height={height} name={name} xScale={xScale} />
            </g>
          </Tooltip>),
      };
    });

    return [_correctAnswersCount, _totalAnswersWithCorrectCount, allElements];
  }, [participantData.answers, xScale, studyConfig?.components, height, selectedTask, clickTask]);

  const duration = useMemo(() => {
    if (!participantData.answers || Object.entries(participantData.answers).length === 0) {
      return 0;
    }

    const answersSorted = Object.values(participantData.answers).filter((data) => data.startTime).sort((a, b) => a.startTime - b.startTime);

    return new Date(answersSorted[answersSorted.length - 1].endTime - (answersSorted[0] ? answersSorted[0].startTime : 0)).getTime();
  }, [participantData]);

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
        browsedAwayList.map((browse, i) => <Tooltip withinPortal key={i} label="Browsed away"><rect x={xScale(browse[0])} width={xScale(browse[1]) - xScale(browse[0])} y={height - 5} height={10} /></Tooltip>)
      );
    });
  }, [xScale, height, participantData.answers]);

  const partName = useMemo(() => {
    if (studyConfig?.uiConfig && studyConfig.uiConfig.participantNameField) {
      const [task, response] = studyConfig.uiConfig.participantNameField.split('.');
      const fullTaskName = Object.keys(participantData.answers).find((a) => a.startsWith(task));

      if (fullTaskName) {
        return participantData.answers[fullTaskName].answer[response];
      }
    }
    return null;
  }, [participantData.answers, studyConfig]);

  return (
    <Center>
      <Stack gap={15} style={{ width: '100%' }}>
        <Divider size="md" />
        <Group justify="space-between">
          {/* dummy box to make the group justify space-between work */ }
          {/* <Box style={{ width: '120px' }} /> */}

          <Group justify="center">
            {participantData.participantIndex
              ? (
                <Text>
                  {`P-${participantData.participantIndex < 10 ? '0' : 'none'}${participantData.participantIndex}`}
                </Text>
              ) : null }

            <Text size="md">
              {partName || participantData.participantId}
            </Text>

            {participantData.completed ? null : <Text size="xl" c="red">Not completed</Text>}

            <Group gap={10}>
              <Badge
                variant="light"
                size="lg"
                color="green"
                leftSection={<IconCheck width={18} height={18} style={{ paddingTop: 1 }} />}
                pb={1}
              >
                {correctAnswersCount}
              </Badge>

              <Badge
                variant="light"
                size="lg"
                color="red"
                leftSection={<IconX width={18} height={18} style={{ paddingTop: 1 }} />}
                pb={1}
              >
                {totalAnswersWithCorrectCount - correctAnswersCount}
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
            </Group>

          </Group>
          <Button
            rightSection={<IconExternalLink size={14} />}
            component="a"
            href={`${PREFIX}${studyId}/${encryptIndex(0)}?participantId=${participantData.participantId}`}
            target="_blank"
          >
            Go to replay
          </Button>
        </Group>

        { participantData.completed ? (
          <svg style={{ width, height, overflow: 'visible' }}>
            {tasks.map((t) => t.line)}
            {tasks.map((t) => t.label)}
            {browsedAway}
          </svg>
        ) : null}
      </Stack>
    </Center>

  );
}
