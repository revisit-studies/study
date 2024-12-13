import { useMemo } from 'react';
import * as d3 from 'd3';
import {
  Anchor, Center, Group, Stack, Tooltip, Text,
} from '@mantine/core';
import { Link, useNavigate } from 'react-router-dom';
import { ParticipantData } from '../../../storage/types';
import { SingleTaskLabelLines } from '../../../components/audioAnalysis/SingleTaskLabelLines';
import { SingleTask } from '../../../components/audioAnalysis/SingleTask';

const LABEL_GAP = 25;
const CHARACTER_SIZE = 8;

const margin = {
  left: 20, top: 0, right: 0, bottom: 0,
};

function humanReadableDuration(msDuration: number): string {
  const h = Math.floor(msDuration / 1000 / 60 / 60);
  const m = Math.floor((msDuration / 1000 / 60 / 60 - h) * 60);
  const s = Math.floor(((msDuration / 1000 / 60 / 60 - h) * 60 - m) * 60);

  // To get time format 00:00:00
  const seconds: string = s < 10 ? `0${s}` : `${s}`;
  const minutes: string = m < 10 ? `0${m}` : `${m}`;
  const hours: string = h < 10 ? `0${h}` : `${h}`;

  return `${hours}h ${minutes}m ${seconds}s`;
}

export function AllTasksTimeline({
  participantData, width, height, setSelectedTask, selectedTask, studyId,
} : {participantData: ParticipantData, width: number, studyId: string, height: number, setSelectedTask: (task: string) => void, selectedTask?: string | null }) {
  const navigate = useNavigate();

  const xScale = useMemo(() => {
    const allStartTimes = Object.values(participantData.answers || {}).map((answer) => [answer.startTime, answer.endTime]).flat();

    const extent = d3.extent(allStartTimes) as [number, number];

    const scale = d3.scaleLinear([margin.left, width + margin.left + margin.right]).domain(extent).clamp(true);

    return scale;
  }, [participantData, width]);

  // Creating labels for the tasks
  const tasks = useMemo(() => {
    let currentHeight = 0;

    const sortedEntries = Object.entries(participantData.answers || {}).sort((a, b) => a[1].startTime - b[1].startTime);

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
        label: <SingleTask key={name} labelHeight={currentHeight * LABEL_GAP} isSelected={selectedTask === name} setSelectedTask={setSelectedTask} answer={answer} height={height} name={name} xScale={xScale} />,
      };
    });
  }, [height, participantData.answers, selectedTask, setSelectedTask, xScale]);

  const duration = useMemo(() => {
    if (!participantData.answers || Object.entries(participantData.answers).length === 0) {
      return 0;
    }

    const answersSorted = Object.values(participantData.answers).sort((a, b) => a.startTime - b.startTime);

    return new Date(answersSorted[answersSorted.length - 1].endTime - (answersSorted[1] ? answersSorted[1].startTime : 0)).getTime();
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
        <Group justify="space-between">
          <Anchor
            size="25px"
            component={Link}
            target="_blank"
            to=""
            onClick={() => navigate(`/${studyId}/${participantData.participantId}/0`)}
          >
            {participantData.participantId}
          </Anchor>
          {participantData.completed || duration > 10000000 ? null : <Text size="xl" color="red">Not completed</Text>}
          <Text size="xl">{`${humanReadableDuration(duration)}`}</Text>
        </Group>

        { participantData.completed && duration < 10000000 ? (
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