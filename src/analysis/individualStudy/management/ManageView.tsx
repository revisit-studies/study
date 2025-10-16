import {
  Title, Paper, ScrollArea, Stack,
} from '@mantine/core';
import { DataManagementItem } from './DataManagementItem';
import { RevisitModesItem } from './RevisitModesItem';
import { ParticipantData } from '../../../storage/types';

export function ManageView({ studyId, refresh }: { studyId: string, refresh: () => Promise<Record<number, ParticipantData>> }) {
  return (
    <ScrollArea style={{ height: '70%', overflow: 'auto' }}>
      <Stack gap="lg">
        <Paper shadow="sm" p="lg" radius="md" withBorder>
          <Title order={2} mb="md">ReVISit Modes</Title>
          <RevisitModesItem studyId={studyId} />
        </Paper>
        <Paper shadow="sm" p="lg" radius="md" withBorder>
          <Title order={2} mb="md">Data Management</Title>
          <DataManagementItem studyId={studyId} refresh={refresh} />
        </Paper>
      </Stack>
    </ScrollArea>
  );
}
