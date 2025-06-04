import {
  Flex, Paper, Text, Box,
} from '@mantine/core';
import { ParticipantData } from '../../../storage/types';

// Number of participants
// Number of completed participants
// Number of in progress participants
// Number of rejected participants

// Time frame (Start and end date or time)

// Average time
// Average clean time

// Average correctness
export function OverviewStats({ visibleParticipants }: { visibleParticipants: ParticipantData[] }) {
  const totalParticipants = visibleParticipants.length;
  const completedParticipants = visibleParticipants.filter((p) => p.completed).length;
  const inProgressParticipants = visibleParticipants.filter((p) => !p.completed && !p.rejected).length;
  const rejectedParticipants = visibleParticipants.filter((p) => p.rejected).length;

  return (
    <Paper shadow="sm" p="md" withBorder>
      <Flex direction="column" gap="md">
        <Text fw="bold">Overview Stats</Text>
        <Box>
          <Text>
            Total Participants:
            {totalParticipants}
          </Text>
          <Text>
            Completed:
            {completedParticipants}
          </Text>
          <Text>
            In Progress:
            {inProgressParticipants}
          </Text>
          <Text>
            Rejected:
            {rejectedParticipants}
          </Text>
        </Box>
      </Flex>
    </Paper>
  );
}
