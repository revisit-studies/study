import {
  Flex, Paper, Text, Title,
} from '@mantine/core';
import { useMemo } from 'react';
import { getOverviewStats, convertNumberToString } from './utils';
import { ParticipantData } from '../../../storage/types';

export function OverviewStats({
  visibleParticipants,
  componentName,
}: {
  visibleParticipants: ParticipantData[];
  componentName?: string;
}) {
  const overviewData = useMemo(
    () => getOverviewStats(visibleParticipants, componentName),
    [visibleParticipants, componentName],
  );

  return (
    <Paper shadow="sm" p="md" withBorder>
      <Title order={4} mb="md">Overview Statistics</Title>
      <Flex justify="space-between" m="xs" gap="xl" wrap="wrap">
        <Flex direction="column">
          <Text size="xl" fw="bold">{overviewData.participantCounts.total}</Text>
          <Text size="sm" c="dimmed">Total Participants</Text>
        </Flex>
        <Flex direction="column">
          <Text size="xl" fw="bold" c="green">{overviewData.participantCounts.completed}</Text>
          <Text size="sm" c="dimmed">Completed</Text>
        </Flex>
        <Flex direction="column">
          <Text size="xl" fw="bold" c="yellow">{overviewData.participantCounts.inProgress}</Text>
          <Text size="sm" c="dimmed">In Progress</Text>
        </Flex>
        <Flex direction="column">
          <Text size="xl" fw="bold" c="red">{overviewData.participantCounts.rejected}</Text>
          <Text size="sm" c="dimmed">Rejected</Text>
        </Flex>
        <Flex direction="column">
          <Text size="xl" fw="bold">{convertNumberToString(overviewData.startDate, 'date')}</Text>
          <Text size="sm" c="dimmed">Start Date</Text>
        </Flex>
        <Flex direction="column">
          <Text size="xl" fw="bold">{convertNumberToString(overviewData.endDate, 'date')}</Text>
          <Text size="sm" c="dimmed">End Date</Text>
        </Flex>
        <Flex direction="column">
          <Text size="xl" fw="bold">{convertNumberToString(overviewData.avgTime, 'time')}</Text>
          <Text size="sm" c="dimmed">Average Time</Text>
        </Flex>
        <Flex direction="column">
          <Text size="xl" fw="bold">{convertNumberToString(overviewData.avgCleanTime, 'time')}</Text>
          <Text size="sm" c="dimmed">Average Clean Time</Text>
        </Flex>
        <Flex direction="column">
          <Text size="xl" fw="bold">{convertNumberToString(overviewData.correctness, 'correctness')}</Text>
          <Text size="sm" c="dimmed">Correctness</Text>
        </Flex>
      </Flex>
    </Paper>
  );
}
