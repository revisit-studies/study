import { Group, Stack, Switch } from '@mantine/core';
import { useResizeObserver } from '@mantine/hooks';
import { useParams } from 'react-router';
import { useMemo, useState } from 'react';
import { AllTasksTimeline } from './AllTasksTimeline';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';

// current active stimuli presented to the user
export function AllReplays({ visibleParticipants, studyConfig }: {visibleParticipants : ParticipantData[], studyConfig: StudyConfig | undefined}) {
  const { studyId } = useParams();

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

  return (
    <Stack ref={ref} style={{ width: '100%' }}>
      <Group>
        <Switch
          checked={scaleByTime}
          label="Scale by time"
          onChange={(event) => setScaleByTime(event.currentTarget.checked)}
        />
      </Group>
      {visibleParticipants.map((part) => <AllTasksTimeline maxLength={maxLength} studyConfig={studyConfig} studyId={studyId || ''} key={part.participantId} height={200} participantData={part} width={width} />)}
    </Stack>
  );
}
