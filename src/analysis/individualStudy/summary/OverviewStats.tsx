import {
  Flex, Paper, Text, Title,
} from '@mantine/core';
import { OverviewData } from './types';

export function OverviewStats({ overviewData }: { overviewData: OverviewData | null}) {
  return (
    <Paper shadow="sm" p="md" withBorder>
      <Title order={4} mb="md">Overview Statistics</Title>
      {overviewData === null ? (
        <Text ta="center" mb="md">No data available</Text>
      ) : (
        <Flex justify="space-between" m="xs" gap="xl" wrap="wrap">
          <div>
            <Text size="xl" fw="bold">{overviewData.participantCounts.total}</Text>
            <Text size="sm" c="dimmed">Total Participants</Text>
          </div>
          <div>
            <Text size="xl" fw="bold" c="green">{overviewData.participantCounts.completed}</Text>
            <Text size="sm" c="dimmed">Completed</Text>
          </div>
          <div>
            <Text size="xl" fw="bold" c="yellow">{overviewData.participantCounts.inProgress}</Text>
            <Text size="sm" c="dimmed">In Progress</Text>
          </div>
          <div>
            <Text size="xl" fw="bold" c="red">{overviewData.participantCounts.rejected}</Text>
            <Text size="sm" c="dimmed">Rejected</Text>
          </div>
          <div>
            <Text size="xl" fw="bold">{overviewData.startDate?.toLocaleDateString() || 'N/A'}</Text>
            <Text size="sm" c="dimmed">Start Date</Text>
          </div>
          <div>
            <Text size="xl" fw="bold">{overviewData.endDate?.toLocaleDateString() || 'N/A'}</Text>
            <Text size="sm" c="dimmed">End Date</Text>
          </div>
          <div>
            <Text size="xl" fw="bold">
              {Number.isFinite(overviewData.avgTime) ? `${(overviewData.avgTime).toFixed(1)} s` : 'N/A'}
            </Text>
            <Text size="sm" c="dimmed">Average Time</Text>
          </div>
          <div>
            <Text size="xl" fw="bold">
              {Number.isFinite(overviewData.avgCleanTime) ? `${(overviewData.avgCleanTime).toFixed(1)} s` : 'N/A'}
            </Text>
            <Text size="sm" c="dimmed">Average Clean Time</Text>
          </div>
          <div>
            <Text size="xl" fw="bold">
              {Number.isFinite(overviewData.correctnessStats) ? `${overviewData.correctnessStats.toFixed(1)}%` : 'N/A'}
            </Text>
            <Text size="sm" c="dimmed">Correctness</Text>
          </div>
        </Flex>
      )}
    </Paper>
  );
}
