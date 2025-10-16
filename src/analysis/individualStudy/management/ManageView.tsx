import {
  Container, Title, Box, Space,
} from '@mantine/core';
import { DataManagementItem } from './DataManagementItem';
import { RevisitModesItem } from './RevisitModesItem';
import { ParticipantData } from '../../../storage/types';

export function ManageView({ studyId, refresh }: { studyId: string, refresh: () => Promise<Record<number, ParticipantData>> }) {
  return (
    <Container size="xl" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 120px)' }}>
      <Box>
        <Title order={2} mb="md">ReVISit Modes</Title>
        <RevisitModesItem studyId={studyId} />
      </Box>
      <Space h="lg" />
      <Box>
        <Title order={2} mb="md">Data Management</Title>
        <DataManagementItem studyId={studyId} refresh={refresh} />
      </Box>
    </Container>
  );
}
