import {
  Flex, Paper, Text, Title, Tooltip,
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useMemo } from 'react';
import { convertNumberToString } from './utils';
import { OverviewData, ParticipantCounts } from '../../types';
import { useStorageEngine } from '../../../storage/storageEngineHooks';
import { useAsync } from '../../../store/hooks/useAsync';
import { StorageEngine } from '../../../storage/engines/types';

async function getStoredParticipantCounts(storageEngine: StorageEngine, studyId: string | undefined) {
  if (!storageEngine || !studyId) return null;
  return storageEngine.getParticipantsStatusCounts(studyId);
}

export function OverviewStats({
  overviewData,
  studyId,
  showStoredCountMismatch = false,
  comparisonParticipantCounts,
}: {
  overviewData: OverviewData;
  studyId?: string;
  showStoredCountMismatch?: boolean;
  comparisonParticipantCounts?: ParticipantCounts;
}) {
  // Check if there are participants with invalid clean time (e.g. due to a window events bug)
  const hasExcluded = overviewData && overviewData.participantsWithInvalidCleanTimeCount > 0;

  const { storageEngine } = useStorageEngine();

  // Get the stored participant counts from the storage engine
  const { value: storedCounts } = useAsync(
    getStoredParticipantCounts,
    showStoredCountMismatch && storageEngine && studyId ? [storageEngine, studyId] : null,
  );

  const mismatchComparisonCounts = comparisonParticipantCounts ?? overviewData.participantCounts;

  const mismatchDetails = useMemo(() => {
    if (!showStoredCountMismatch || !storedCounts) return null;
    return {
      completed: {
        current: storedCounts.completed,
        calculated: mismatchComparisonCounts.completed,
      },
      inProgress: {
        current: storedCounts.inProgress,
        calculated: mismatchComparisonCounts.inProgress,
      },
      rejected: {
        current: storedCounts.rejected,
        calculated: mismatchComparisonCounts.rejected,
      },
    };
  }, [mismatchComparisonCounts, showStoredCountMismatch, storedCounts]);

  // Check if the stored participant counts match the calculated participant counts
  const hasMismatch = (type: 'completed' | 'inProgress' | 'rejected') => {
    if (!mismatchDetails) return false;
    const details = mismatchDetails[type];
    return details.current !== details.calculated;
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
            {hasMismatch('completed') && mismatchDetails && (
              <Tooltip label={`Calculated: ${mismatchDetails.completed.calculated}, Stored: ${mismatchDetails.completed.current}`}>
                <IconAlertTriangle size={16} color="orange" />
              </Tooltip>
            )}
            <Text size="xl" fw="bold" c="green">{overviewData.participantCounts.completed}</Text>
          </Flex>
          <Text size="sm" c="dimmed">Completed</Text>
        </Flex>
        <Flex direction="column">
          <Flex align="center" gap="xs">
            {hasMismatch('inProgress') && mismatchDetails && (
              <Tooltip label={`Calculated: ${mismatchDetails.inProgress.calculated}, Stored: ${mismatchDetails.inProgress.current}`}>
                <IconAlertTriangle size={16} color="orange" />
              </Tooltip>
            )}
            <Text size="xl" fw="bold" c="yellow">{overviewData.participantCounts.inProgress}</Text>
          </Flex>
          <Text size="sm" c="dimmed">In Progress</Text>
        </Flex>
        <Flex direction="column">
          <Flex align="center" gap="xs">
            {hasMismatch('rejected') && mismatchDetails && (
              <Tooltip label={`Calculated: ${mismatchDetails.rejected.calculated}, Stored: ${mismatchDetails.rejected.current}`}>
                <IconAlertTriangle size={16} color="orange" />
              </Tooltip>
            )}
            <Text size="xl" fw="bold" c="red">{overviewData.participantCounts.rejected}</Text>
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
            <Text size="xl" fw="bold">{convertNumberToString(overviewData.avgCleanTime, 'time')}</Text>
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
