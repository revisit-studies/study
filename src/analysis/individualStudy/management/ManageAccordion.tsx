import {
  Container, Title, Box, Space,
} from '@mantine/core';
import { DataManagementItem } from './DataManagementItem';
import { RevisitModesItem } from './RevisitModesItem';
import { ParticipantData } from '../../../storage/types';

export function ManageAccordion({ studyId, refresh }: { studyId: string, refresh: () => Promise<Record<number, ParticipantData>> }) {
  return (
    <Container>
      <Box>
        <Title order={2} mb="md">ReVISit Modes</Title>
        <RevisitModesItem studyId={studyId} />
      </Box>

      <Space h="xl" />

      <Box>
        <Title order={2} mb="md">Data Management</Title>
        <DataManagementItem studyId={studyId} refresh={refresh} />
      </Box>
    </Container>
  );
}
