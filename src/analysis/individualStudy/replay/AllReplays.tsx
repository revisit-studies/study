import {
  Stack,
} from '@mantine/core';
import { useResizeObserver } from '@mantine/hooks';
import { useParams } from 'react-router-dom';
import { AllTasksTimeline } from './AllTasksTimeline';
import { ParticipantData } from '../../../storage/types';

// current active stimuli presented to the user
export default function AllReplays({ visibleParticipants }: {visibleParticipants : ParticipantData[]}) {
  const { studyId } = useParams();

  const [ref, { width }] = useResizeObserver();

  return (
    <Stack ref={ref} style={{ width: '100%' }}>
      { visibleParticipants.map((part) => <AllTasksTimeline studyId={studyId || ''} key={part.participantId} height={200} participantData={part} width={width} />)}
    </Stack>
  );
}
