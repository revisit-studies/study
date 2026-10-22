import {
  Paper, Stack,
} from '@mantine/core';
import { DataManagementItem } from './DataManagementItem';
import { RevisitModesItem } from './RevisitModesItem';
import { StageManagementItem } from './StageManagementItem';
import { StudyVisibilityItem } from './StudyVisibilityItem';
import { ParticipantDataWithStatus } from '../../../storage/types';

export function ManageView({ studyId, refresh }: { studyId: string, refresh: () => Promise<ParticipantDataWithStatus[]> }) {
  return (
    <Stack gap="lg" w="60%" mx="auto">
      <Paper shadow="sm" p="lg" radius="md" withBorder>
        <RevisitModesItem studyId={studyId} />
      </Paper>
      <Paper shadow="sm" p="lg" radius="md" withBorder>
        <StudyVisibilityItem studyId={studyId} />
      </Paper>
      <Paper shadow="sm" p="lg" radius="md" withBorder>
        <StageManagementItem studyId={studyId} />
      </Paper>
      <Paper shadow="sm" p="lg" radius="md" withBorder>
        <DataManagementItem studyId={studyId} refresh={refresh} />
      </Paper>
    </Stack>
  );
}
