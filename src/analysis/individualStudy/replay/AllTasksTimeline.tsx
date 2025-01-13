import { useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import {
  Anchor, Center, Group, Stack, Tooltip, Text,
  Divider,
} from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { ParticipantData } from '../../../storage/types';
import { SingleTaskLabelLines } from './SingleTaskLabelLines';
import { SingleTask } from './SingleTask';
import { encryptIndex } from '../../../utils/encryptDecryptIndex';
import { humanReadableDuration } from '../../../utils/humanReadableDuration';

const LABEL_GAP = 25;
const CHARACTER_SIZE = 8;

const margin = {
  left: 20, top: 0, right: 20, bottom: 0,
};

export function AllTasksTimeline({
  participantData, width, height, selectedTask, studyId,
} : {participantData: ParticipantData, width: number, studyId: string, height: number, selectedTask?: string | null }) {
  const navigate = useNavigate();

  const clickTask = useCallback((task: string) => {
    const split = task.split('_');
    const index = +split[split.length - 1];

    navigate(`/${studyId}/${encryptIndex(index)}?participantId=${participantData.participantId}`);
  }, [navigate, participantData.participantId, studyId]);

  const xScale = useMemo(() => {
    const allStartTimes = Object.values(participantData.answers || {}).filter((answer) => answer.startTime).map((answer) => [answer.startTime, answer.endTime]).flat();

    const extent = d3.extent(allStartTimes) as [number, number];

    const scale = d3.scaleLinear([margin.left, width - margin.left - margin.right]).domain(extent).clamp(true);

    return scale;
  }, [participantData, width]);

  // Creating labels for the tasks
  const tasks = useMemo(() => {
    let currentHeight = 0;

    const sortedEntries = Object.entries(participantData.answers || {}).filter((answer) => !!(answer[1].startTime)).sort((a, b) => a[1].startTime - b[1].startTime);

    return sortedEntries.map((entry, i) => {
      const [name, answer] = entry;

      const prev = i > 0 ? sortedEntries[i - currentHeight - 1] : null;

      if (prev && prev[0].length * CHARACTER_SIZE + xScale(prev[1].startTime) > xScale(answer.startTime)) {
        currentHeight += 1;
      } else {
        currentHeight = 0;
      }

      return {
        line: <SingleTaskLabelLines key={name} labelHeight={currentHeight * LABEL_GAP} answer={answer} height={height} xScale={xScale} />,
        label: <SingleTask key={name} labelHeight={currentHeight * LABEL_GAP} isSelected={selectedTask === name} setSelectedTask={clickTask} answer={answer} height={height} name={name} xScale={xScale} />,
      };
    });
  }, [height, participantData.answers, selectedTask, clickTask, xScale]);

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
  }, [height, participantData, xScale]);

  return (
    <Center>
      <Stack gap={25} style={{ width: '100%' }}>
        <Divider size="md" />
        <Group justify="center">
          <Anchor
            href=""
            onClick={() => navigate(`/${studyId}/${encryptIndex(0)}?participantId=${participantData.participantId}`)}
          >
            {participantData.participantId}
          </Anchor>
          {participantData.completed ? null : <Text size="xl" c="red">Not completed</Text>}
          <Text size="xl">{`${humanReadableDuration(duration)}`}</Text>
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
