import {
  Box,
  Group, ScrollArea, Skeleton, Stack, Switch,
} from '@mantine/core';
import { useDebouncedState, useResizeObserver } from '@mantine/hooks';
import { useParams } from 'react-router';
import {
  useEffect, useMemo, useState,
} from 'react';
import { AllTasksTimeline } from './AllTasksTimeline';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';

const REPLAY_HEIGHT = 269;

// current active stimuli presented to the user
export function AllReplays({
  virtualizedParticipants, studyConfig, participantList, setVirtualRange,
}: {virtualizedParticipants : Record<string, ParticipantData>, studyConfig: StudyConfig | undefined, participantList: string[], setVirtualRange: (range: [number, number]) => void}) {
  const { studyId } = useParams();
  const [scrollHeight, setScrollHeight] = useDebouncedState<number>(0, 200);

  useEffect(() => {
    setVirtualRange([Math.max(0, Math.round((participantList?.length || 0) * scrollHeight) - 10), Math.min(Math.round((participantList?.length || 0) * scrollHeight) + 10, participantList?.length || 0)]);
  }, [participantList, scrollHeight, setScrollHeight, setVirtualRange]);

  const totalHeight = useMemo(() => participantList.length * REPLAY_HEIGHT, [participantList]);

  const [ref, { width }] = useResizeObserver();

  const [scaleByTime, setScaleByTime] = useState(false);

  const maxLength = useMemo(() => {
    if (!scaleByTime) {
      return undefined;
    }

    const maxDiff = Math.max(...Object.values(virtualizedParticipants).map((part) => {
      const minStart = Math.min(...Object.values(part.answers).map((answer) => answer.startTime || 0));
      const maxEnd = Math.max(...Object.values(part.answers).map((answer) => answer.endTime || 0));

      return maxEnd && minStart ? maxEnd - minStart : 0;
    }));

    return maxDiff;
  }, [scaleByTime, virtualizedParticipants]);

  const timelines = useMemo(
    () => (
      <>
        {participantList.map((part) => {
          if (virtualizedParticipants[part]) {
            return (
              <Box key={part} style={{ width: '100%', height: REPLAY_HEIGHT }}>
                <AllTasksTimeline maxLength={maxLength} studyConfig={studyConfig} studyId={studyId || ''} height={200} participantData={virtualizedParticipants[part]} width={width} />
              </Box>
            );
          }
          return (
            <Box key={part} style={{ width: '100%', height: REPLAY_HEIGHT }}>
              <Skeleton visible height={REPLAY_HEIGHT} />
            </Box>
          );
        })}
      </>
    ),
    [maxLength, participantList, studyConfig, studyId, virtualizedParticipants, width],
  );

  return (
    <Stack ref={ref} style={{ width: '100%' }}>
      <Group>
        <Switch
          checked={scaleByTime}
          label="Scale by time"
          onChange={(event) => setScaleByTime(event.currentTarget.checked)}
        />
      </Group>
      <ScrollArea h="100dvh" type="auto" onScrollPositionChange={(e) => { setScrollHeight(e.y / totalHeight); }}>
        <Stack h={totalHeight} style={{ width: '100%' }}>
          {timelines}
        </Stack>
      </ScrollArea>

    </Stack>
  );
}
