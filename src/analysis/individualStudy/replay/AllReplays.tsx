import {
  Group, ScrollArea, Stack, Switch,
} from '@mantine/core';
import { useResizeObserver } from '@mantine/hooks';
import { useParams } from 'react-router';
import { useMemo, useState } from 'react';
import { AllTasksTimeline } from './AllTasksTimeline';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';

const REPLAY_HEIGHT = 269;

// current active stimuli presented to the user
export function AllReplays({
  visibleParticipants, studyConfig, participantCount, onScroll,
}: {visibleParticipants : ParticipantData[], studyConfig: StudyConfig | undefined, participantCount: number, onScroll: (scrollPosition: number) => void}) {
  const { studyId } = useParams();

  const totalHeight = useMemo(() => participantCount * REPLAY_HEIGHT, [participantCount]);

  const [ref, { width }] = useResizeObserver();

  const [scaleByTime, setScaleByTime] = useState(false);

  const maxLength = useMemo(() => {
    if (!scaleByTime) {
      return undefined;
    }

    const maxDiff = Math.max(...visibleParticipants.map((part) => {
      const minStart = Math.min(...Object.values(part.answers).map((answer) => answer.startTime || 0));
      const maxEnd = Math.max(...Object.values(part.answers).map((answer) => answer.endTime || 0));

      return maxEnd && minStart ? maxEnd - minStart : 0;
    }));

    return maxDiff;
  }, [scaleByTime, visibleParticipants]);

  const timelines = useMemo(() => visibleParticipants.map((part) => <AllTasksTimeline maxLength={maxLength} studyConfig={studyConfig} studyId={studyId || ''} key={part.participantId} height={200} participantData={part} width={width} />), [maxLength, studyConfig, studyId, visibleParticipants, width]);

  return (
    <Stack ref={ref} style={{ width: '100%' }}>
      <Group>
        <Switch
          checked={scaleByTime}
          label="Scale by time"
          onChange={(event) => setScaleByTime(event.currentTarget.checked)}
        />
      </Group>
      <ScrollArea type="auto" h="1000" onScrollPositionChange={(e) => onScroll(e.y / totalHeight)}>
        <Stack h={totalHeight} style={{ width: '100%' }}>
          {timelines}
        </Stack>
      </ScrollArea>

    </Stack>
  );
}
