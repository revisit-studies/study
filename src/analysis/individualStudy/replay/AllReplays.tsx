import {
  Stack,
} from '@mantine/core';

import { useResizeObserver } from '@mantine/hooks';

import { useParams } from 'react-router-dom';
import { StorageEngine } from '../../../storage/engines/StorageEngine';
import { useStorageEngine } from '../../../storage/storageEngineHooks';
import { useAsync } from '../../../store/hooks/useAsync';
import { AllTasksTimeline } from './AllTasksTimeline';

function getAllParticipantData(storageEngine: StorageEngine | undefined, studyId: string | undefined) {
  if (storageEngine && studyId) {
    return storageEngine.getAllParticipantsDataByStudy(studyId);
  }

  return null;
}
// current active stimuli presented to the user
export default function AllReplays() {
  const { studyId } = useParams();

  const { storageEngine } = useStorageEngine();

  const [ref, { width }] = useResizeObserver();

  const { value: participants } = useAsync(getAllParticipantData, [storageEngine, studyId]);

  return (
    <Stack ref={ref} style={{ width: '100%' }}>
      { participants
        ? participants.map((part) => <AllTasksTimeline studyId={studyId || ''} key={part.participantId} height={200} participantData={part} setSelectedTask={() => null} width={width} />) : null}
    </Stack>
  );
}
