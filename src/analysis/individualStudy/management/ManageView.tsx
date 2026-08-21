import {
  Paper, Stack,
} from '@mantine/core';
import { DataManagementItem } from './DataManagementItem';
import { RevisitModesItem } from './RevisitModesItem';
import { StageManagementItem } from './StageManagementItem';
import { ParticipantDataWithStatus } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';

export function ManageView({ studyId, refresh, studyConfig }: { studyId: string, refresh: () => Promise<ParticipantDataWithStatus[]>, studyConfig?: StudyConfig }) {
  return (
    <Stack gap="lg" w="60%" mx="auto">
      <Paper shadow="sm" p="lg" radius="md" withBorder>
        <RevisitModesItem studyId={studyId} />
      </Paper>
      <Paper shadow="sm" p="lg" radius="md" withBorder>
        <StageManagementItem studyId={studyId} studyConfig={studyConfig} />
      </Paper>
      <Paper shadow="sm" p="lg" radius="md" withBorder>
        <DataManagementItem studyId={studyId} refresh={refresh} />
      </Paper>
    </Stack>
  );
}
