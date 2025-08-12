import {
  Flex, Paper, Text, Title, Tooltip,
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { OverviewData } from '../../types';

export function OverviewStats({
  overviewData,
  mismatchDetails,
}: {
  overviewData: OverviewData | null;
  mismatchDetails?: {
    completed: { current: number; calculated: number };
    inProgress: { current: number; calculated: number };
    rejected: { current: number; calculated: number };
  } | null;
}) {
  const hasMismatch = (type: 'completed' | 'inProgress' | 'rejected') => {
    if (!mismatchDetails) return false;
    const details = mismatchDetails[type];
    return details.current !== details.calculated;
  };

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
            <Flex align="center" gap="xs">

              {hasMismatch('completed') && mismatchDetails && (
                <Tooltip label={`Calculated: ${mismatchDetails.completed.calculated}, Current: ${mismatchDetails.completed.current}`}>
                  <IconAlertTriangle size={16} color="orange" />
                </Tooltip>
              )}
              <Text size="xl" fw="bold" c="green">{overviewData.participantCounts.completed}</Text>
            </Flex>
            <Text size="sm" c="dimmed">Completed</Text>
          </div>
          <div>
            <Flex align="center" gap="xs">

              {hasMismatch('inProgress') && mismatchDetails && (
                <Tooltip label={`Calculated: ${mismatchDetails.inProgress.calculated}, Current: ${mismatchDetails.inProgress.current}`}>
                  <IconAlertTriangle size={16} color="orange" />
                </Tooltip>
              )}
              <Text size="xl" fw="bold" c="yellow">{overviewData.participantCounts.inProgress}</Text>
            </Flex>
            <Text size="sm" c="dimmed">In Progress</Text>
          </div>
          <div>
            <Flex align="center" gap="xs">

              {hasMismatch('rejected') && mismatchDetails && (
                <Tooltip label={`Calculated: ${mismatchDetails.rejected.calculated}, Current: ${mismatchDetails.rejected.current}`}>
                  <IconAlertTriangle size={16} color="orange" />
                </Tooltip>
              )}
              <Text size="xl" fw="bold" c="red">{overviewData.participantCounts.rejected}</Text>
            </Flex>
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
