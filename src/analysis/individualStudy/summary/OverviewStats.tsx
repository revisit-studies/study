import {
  Flex, Paper, Text, Title,
} from '@mantine/core';
import { useMemo } from 'react';
import { getOverviewStats } from './utils';
import { ParticipantData } from '../../../storage/types';

export function OverviewStats({
  visibleParticipants,
}: {
  visibleParticipants: ParticipantData[];
}) {
  const overviewData = useMemo(() => getOverviewStats(visibleParticipants), [visibleParticipants]);

  return (
    <Paper shadow="sm" p="md" withBorder>
      <Title order={4} mb="md">Overview Statistics</Title>
      <Flex justify="space-between" m="xs" gap="xl" wrap="wrap">
        <Flex direction="column">
          <Text size="xl" fw="bold">{overviewData.participantCounts.total}</Text>
          <Text size="sm" c="dimmed">Total Participants</Text>
        </Flex>
        <Flex direction="column">
          <Flex align="center" gap="xs">
            <Text size="xl" fw="bold" c="green">{overviewData.participantCounts.completed}</Text>
          </Flex>
          <Text size="sm" c="dimmed">Completed</Text>
        </Flex>
        <Flex direction="column">
          <Flex align="center" gap="xs">
            <Text size="xl" fw="bold" c="yellow">{overviewData.participantCounts.inProgress}</Text>
          </Flex>
          <Text size="sm" c="dimmed">In Progress</Text>
        </Flex>
        <Flex direction="column">
          <Flex align="center" gap="xs">
            <Text size="xl" fw="bold" c="red">{overviewData.participantCounts.rejected}</Text>
          </Flex>
          <Text size="sm" c="dimmed">Rejected</Text>
        </Flex>
        <Flex direction="column">
          <Text size="xl" fw="bold">{overviewData.startDate?.toLocaleDateString() || 'N/A'}</Text>
          <Text size="sm" c="dimmed">Start Date</Text>
        </Flex>
        <Flex direction="column">
          <Text size="xl" fw="bold">{overviewData.endDate?.toLocaleDateString() || 'N/A'}</Text>
          <Text size="sm" c="dimmed">End Date</Text>
        </Flex>
        <Flex direction="column">
          <Text size="xl" fw="bold">
            {Number.isFinite(overviewData.avgTime) ? `${(overviewData.avgTime).toFixed(1)} s` : 'N/A'}
          </Text>
          <Text size="sm" c="dimmed">Average Time</Text>
        </Flex>
        <Flex direction="column">
          <Text size="xl" fw="bold">
            {Number.isFinite(overviewData.avgCleanTime) ? `${(overviewData.avgCleanTime).toFixed(1)} s` : 'N/A'}
          </Text>
          <Text size="sm" c="dimmed">Average Clean Time</Text>
        </Flex>
        <Flex direction="column">
          <Text size="xl" fw="bold">
            {Number.isFinite(overviewData.correctness) ? `${overviewData.correctness.toFixed(1)}%` : 'N/A'}
          </Text>
          <Text size="sm" c="dimmed">Correctness</Text>
        </Flex>
      </Flex>
    </Paper>
  );
}
