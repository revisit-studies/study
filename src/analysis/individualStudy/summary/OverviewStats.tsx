import {
  Flex, Paper, Text, Title, Tooltip,
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { convertNumberToString } from './utils';
import { OverviewData } from '../../types';

export function OverviewStats({
  overviewData,
}: {
  overviewData: OverviewData;
}) {
  const hasExcluded = overviewData && overviewData.participantsWithInvalidCleanTimeCount > 0;

  if (!overviewData) {
    return (
      <Paper shadow="sm" p="md" withBorder>
        <Text ta="center" mb="md">No data available</Text>
      </Paper>
    );
  }

  const hasMismatch = (type: 'completed' | 'inProgress' | 'rejected') => {
    if (!overviewData.mismatchInfo) return false;
    const details = overviewData.mismatchInfo[type];
    return details.stored !== details.calculated;
  };

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
            {hasMismatch('completed') && overviewData.mismatchInfo && (
              <Tooltip label={`Calculated: ${overviewData.mismatchInfo.completed.calculated}, Current: ${overviewData.mismatchInfo.completed.stored}`}>
                <IconAlertTriangle size={16} color="orange" />
              </Tooltip>
            )}
            <Text size="xl" fw="bold" c="green">
              {overviewData.participantCounts.completed}
              {hasMismatch('completed') && overviewData.mismatchInfo && ` (current: ${overviewData.mismatchInfo.completed.stored})`}
            </Text>
          </Flex>
          <Text size="sm" c="dimmed">Completed</Text>
        </Flex>
        <Flex direction="column">
          <Flex align="center" gap="xs">
            {hasMismatch('inProgress') && overviewData.mismatchInfo && (
              <Tooltip label={`Calculated: ${overviewData.mismatchInfo.inProgress.calculated}, Current: ${overviewData.mismatchInfo.inProgress.stored}`}>
                <IconAlertTriangle size={16} color="orange" />
              </Tooltip>
            )}
            <Text size="xl" fw="bold" c="yellow">
              {overviewData.participantCounts.inProgress}
              {hasMismatch('inProgress') && overviewData.mismatchInfo && ` (current: ${overviewData.mismatchInfo.inProgress.stored})`}
            </Text>
          </Flex>
          <Text size="sm" c="dimmed">In Progress</Text>
        </Flex>
        <Flex direction="column">
          <Flex align="center" gap="xs">
            {hasMismatch('rejected') && overviewData.mismatchInfo && (
              <Tooltip label={`Calculated: ${overviewData.mismatchInfo.rejected.calculated}, Current: ${overviewData.mismatchInfo.rejected.stored}`}>
                <IconAlertTriangle size={16} color="orange" />
              </Tooltip>
            )}
            <Text size="xl" fw="bold" c="red">
              {overviewData.participantCounts.rejected}
              {hasMismatch('rejected') && overviewData.mismatchInfo && ` (current: ${overviewData.mismatchInfo.rejected.stored})`}
            </Text>
          </Flex>
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
          <Flex align="center" gap="xs">
            {hasExcluded && (
              <Tooltip label={`${overviewData.participantsWithInvalidCleanTimeCount} participants with invalid timing data were excluded from the average clean time calculation`}>
                <IconAlertTriangle size={16} color="orange" />
              </Tooltip>
            )}
            <Text size="xl" fw="bold">
              {Number.isFinite(overviewData.avgCleanTime) ? `${(overviewData.avgCleanTime).toFixed(1)} s` : 'N/A'}
            </Text>
          </Flex>
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
