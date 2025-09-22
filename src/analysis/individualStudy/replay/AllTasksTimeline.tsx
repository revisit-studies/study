import { JSX, useMemo } from 'react';
import * as d3 from 'd3';
import {
  Center, Stack, Tooltip, Text,
} from '@mantine/core';
import { ParticipantData } from '../../../storage/types';
import { SingleTaskLabelLines } from './SingleTaskLabelLines';
import { SingleTask } from './SingleTask';
import { StoredAnswer, StudyConfig } from '../../../parser/types';
import { componentAnswersAreCorrect } from '../../../utils/correctAnswer';

const LABEL_GAP = 25;
const CHARACTER_SIZE = 8;

const margin = {
  left: 20, top: 20, right: 20, bottom: 20,
};

const sortedTaskNames = (a: [string, StoredAnswer], b: [string, StoredAnswer]) => {
  const splitA = a[1].trialOrder.split('_');
  const splitB = b[1].trialOrder.split('_');
  return splitA[0] === splitB[0] ? +splitA[1] - +splitB[1] : +splitA[0] - +splitB[0];
};

export function AllTasksTimeline({
  participantData, width, studyId, studyConfig, maxLength,
} : {participantData: ParticipantData, width: number, studyId: string, studyConfig: StudyConfig | undefined, maxLength: number | undefined}) {
  const percentComplete = useMemo(() => {
    const incompleteEntries = Object.entries(participantData.answers || {}).filter((e) => e[1].startTime === 0);

    return (Object.entries(participantData.answers).length - incompleteEntries.length) / (Object.entries(participantData.answers).length);
  }, [participantData.answers]);

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

    return (_maxHeight + 1) * LABEL_GAP + margin.top + margin.bottom;
  }, [participantData.answers, xScale]);

  // Creating labels for the tasks
  const tasks: {line: JSX.Element, label: JSX.Element}[] = useMemo(() => {
    let currentHeight = 0;

    const incompleteEntries = Object.entries(participantData.answers || {}).filter((e) => e[1].startTime === 0).sort(sortedTaskNames);

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

      const isCorrect = componentAnswersAreCorrect(answer.answer, answer.correctAnswer);
      const hasCorrect = !!((component && component.correctAnswer) || answer.correctAnswer.length > 0);

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
              <SingleTask incomplete={answer.startTime === 0} isCorrect={isCorrect} hasCorrect={hasCorrect} key={name} labelHeight={currentHeight * LABEL_GAP} height={maxHeight} name={name} xScale={scale} scaleStart={scaleStart} scaleEnd={scaleEnd} trialOrder={answer.trialOrder} participantId={participantData.participantId} studyId={studyId} />
            </g>
          </Tooltip>),
      };
    });

    return allElements;
  }, [participantData.answers, participantData.participantId, incompleteXScale, xScale, studyConfig?.components, maxHeight, studyId]);

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
        <svg style={{ width, height: maxHeight, overflow: 'visible' }}>
          {tasks.map((t) => t.line)}
          {tasks.map((t) => t.label)}
          {browsedAway}
        </svg>
      </Stack>
    </Center>

  );
}
