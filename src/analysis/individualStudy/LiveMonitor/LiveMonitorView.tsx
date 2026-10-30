import {
  Stack, Group, Card, Text, Title, Badge, ActionIcon, Center, Indicator, Tooltip, Button, Flex,
} from '@mantine/core';
import {
  useMemo, useEffect, useState, useCallback,
} from 'react';
import {
  IconCheck, IconWifi, IconWifiOff, IconRefresh,
} from '@tabler/icons-react';
import { StudyConfig } from '../../../parser/types';
import { StorageEngine, SequenceAssignment } from '../../../storage/engines/types';
import { ParticipantSection } from './ParticipantSection';
import { FirebaseStorageEngine } from '../../../storage/engines/FirebaseStorageEngine';
import {
  ParticipantStatus, countParticipantStatuses, getSequenceAssignmentStatus,
} from '../../../storage/participantStatus';

export interface LiveMonitorParticipantProgress {
  assignment: SequenceAssignment;
  progress: number;
  status: ParticipantStatus;
}

export function getFilteredParticipantProgress(
  sequenceAssignments: SequenceAssignment[],
  includedParticipants: string[],
  selectedStages: string[],
): LiveMonitorParticipantProgress[] {
  return sequenceAssignments
    .map((assignment) => ({
      assignment,
      progress: assignment.total > 0 ? (assignment.answered.length / assignment.total) * 100 : 0,
      status: getSequenceAssignmentStatus(assignment),
    }))
    .filter(({ status, assignment }) => {
      const statusMatch = includedParticipants.includes(status);
      const stageMatch = selectedStages.includes('ALL') || selectedStages.includes(assignment.stage || '');

      return statusMatch && stageMatch;
    })
    .sort((a, b) => b.assignment.createdTime - a.assignment.createdTime);
}

export function groupParticipantProgress(filteredParticipantProgress: LiveMonitorParticipantProgress[]) {
  const byStatus = (status: ParticipantStatus) => filteredParticipantProgress.filter(
    (participant) => participant.status === status,
  );

  return {
    inProgress: byStatus('inProgress'),
    completed: byStatus('completed'),
    rejected: byStatus('rejected'),
    timedOut: byStatus('timedOut'),
    completedLate: byStatus('completedLate'),
  };
}

// Progress label components
function InProgressLabel({ assignment, progress }: { assignment: SequenceAssignment; progress: number }) {
  return (
    <Text
      c="orange"
      fw={700}
      ta="center"
      size="xs"
    >
      {assignment.isDynamic ? '?' : Math.round(progress)}
      %
    </Text>
  );
}

function CompletedLabel() {
  return (
    <Center>
      <ActionIcon color="teal" variant="light" radius="xl" size="sm">
        <IconCheck size={16} />
      </ActionIcon>
    </Center>
  );
}

function percentLabel(color: string) {
  return function PercentLabel({ progress }: { progress: number }) {
    return (
      <Text c={color} fw={700} ta="center" size="xs">
        {Math.round(progress)}
        %
      </Text>
    );
  };
}

const RejectedLabel = percentLabel('red');
const TimedOutLabel = percentLabel('yellow');

export function LiveMonitorView({
  studyConfig: _studyConfig, storageEngine, studyId, includedParticipants, selectedStages,
}: {
  studyConfig: StudyConfig;
  storageEngine?: StorageEngine;
  studyId?: string;
  includedParticipants: string[];
  selectedStages: string[];
}) {
  const firebaseStoreageEngine = storageEngine as FirebaseStorageEngine;
  const [sequenceAssignments, setSequenceAssignments] = useState<SequenceAssignment[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Function to handle successful data update
  const handleDataUpdate = (assignments: SequenceAssignment[]) => {
    setSequenceAssignments(assignments);
    setLastUpdateTime(new Date());
    setIsReconnecting(false);
  };

  // Function to manually reconnect
  const handleReconnect = useCallback(async () => {
    if (!firebaseStoreageEngine || !studyId || isReconnecting) return;

    if (!navigator.onLine) {
      setConnectionStatus('disconnected');
      return;
    }

    setIsReconnecting(true);
    setConnectionStatus('connecting');

    // Set up a timeout to handle connection failures
    const connectionTimeout = setTimeout(() => {
      if (connectionStatus === 'connecting') {
        setConnectionStatus('disconnected');
        setIsReconnecting(false);
      }
    }, 10000); // 10 second timeout

    try {
      firebaseStoreageEngine.initializeStudyDb(studyId);
      const assignments = await firebaseStoreageEngine.getAllSequenceAssignments(studyId);
      clearTimeout(connectionTimeout);
      handleDataUpdate(assignments);
      setConnectionStatus('connected');
    } catch (error) {
      console.error('Reconnection failed:', error);
      clearTimeout(connectionTimeout);
      setConnectionStatus('disconnected');
      setIsReconnecting(false);
    }
  }, [firebaseStoreageEngine, studyId, isReconnecting, connectionStatus]);

  // Set up realtime listener for sequence assignments
  useEffect(() => {
    if (!firebaseStoreageEngine || !studyId) {
      setConnectionStatus('disconnected');
      return undefined;
    }

    setConnectionStatus('connecting');
    firebaseStoreageEngine.initializeStudyDb(studyId);

    const unsubscribe = firebaseStoreageEngine._setupSequenceAssignmentListener?.(studyId, (assignments: SequenceAssignment[]) => {
      handleDataUpdate(assignments);
    });

    // Set connection status based on listener availability
    if (typeof unsubscribe === 'function') {
      setConnectionStatus('connected');
    } else {
      setConnectionStatus('disconnected');
    }

    return () => {
      unsubscribe?.();
    };
  }, [firebaseStoreageEngine, studyId]);

  // Monitor browser online/offline status
  useEffect(() => {
    const handleOnline = () => {
      if (firebaseStoreageEngine && studyId && connectionStatus === 'disconnected') {
        // Trigger a reconnection attempt when coming back online
        handleReconnect();
      }
    };

    const handleOffline = () => {
      setConnectionStatus('disconnected');
      setIsReconnecting(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [firebaseStoreageEngine, studyId, connectionStatus, handleReconnect]);

  const filteredParticipantProgress = useMemo(
    () => getFilteredParticipantProgress(sequenceAssignments, includedParticipants, selectedStages),
    [sequenceAssignments, includedParticipants, selectedStages],
  );

  // Group participants by status
  const participantGroups = useMemo(
    () => groupParticipantProgress(filteredParticipantProgress),
    [filteredParticipantProgress],
  );

  const statusCounts = useMemo(
    () => countParticipantStatuses(filteredParticipantProgress, (participant) => participant.status),
    [filteredParticipantProgress],
  );

  return (
    <Stack gap="sm">
      <Card
        shadow="sm"
        padding="sm"
        radius="md"
        withBorder
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          marginBottom: '1rem',
        }}
      >
        <Flex justify="space-between" align="center">
          <Group gap="md">
            <Title order={5} size="h5">Live Monitor</Title>
            <Text size="sm" c="dimmed">
              Total:
              {' '}
              {filteredParticipantProgress.length}
            </Text>
            <Group gap="xs">
              <Badge color="green" variant="light" size="sm">
                {statusCounts.completed}
                {' '}
                Completed
              </Badge>
              <Badge color="orange" variant="light" size="sm">
                {statusCounts.inProgress}
                {' '}
                Active
              </Badge>
              <Badge color="red" variant="light" size="sm">
                {statusCounts.rejected}
                {' '}
                Rejected
              </Badge>
              <Badge color="yellow" variant="light" size="sm">
                {statusCounts.timedOut}
                {' '}
                Timed Out
              </Badge>
              <Badge color="grape" variant="light" size="sm">
                {statusCounts.completedLate}
                {' '}
                Completed Late
              </Badge>
            </Group>
          </Group>

          <Group gap="xs">
            {connectionStatus === 'disconnected' && (
              <Button
                size="xs"
                variant="light"
                color="blue"
                leftSection={<IconRefresh size={12} />}
                loading={isReconnecting}
                onClick={handleReconnect}
                disabled={!firebaseStoreageEngine || !studyId}
              >
                Reconnect
              </Button>
            )}

            <Tooltip
              label={
                connectionStatus === 'connected'
                  ? `Connected${lastUpdateTime ? ` - Last data update: ${lastUpdateTime.toLocaleTimeString()}` : ''}`
                  : connectionStatus === 'connecting'
                    ? 'Connecting...'
                    : 'Disconnected'
              }
              position="bottom-end"
            >
              <Indicator
                color={
                  connectionStatus === 'connected'
                    ? 'green'
                    : connectionStatus === 'connecting'
                      ? 'yellow'
                      : 'red'
                }
                position="top-end"
                size={10}
                withBorder
              >
                {connectionStatus === 'connected' ? (
                  <IconWifi size={22} color="var(--mantine-color-green-text)" />
                ) : (
                  <IconWifiOff size={22} color={connectionStatus === 'connecting' ? 'var(--mantine-color-orange-text)' : 'var(--mantine-color-red-text)'} />
                )}
              </Indicator>
            </Tooltip>
          </Group>
        </Flex>
      </Card>

      <Title order={4} mt="lg">Participant Progress</Title>

      <Stack gap="md">
        <ParticipantSection
          title="In Progress"
          titleColor="orange"
          participants={participantGroups.inProgress}
          showProgressHeatmap
          showDynamicBadge
          progressValue={(assignment, progress) => (assignment.isDynamic ? 50 : progress)}
          progressColor="orange"
          progressLabel={InProgressLabel}
        />

        <ParticipantSection
          title="Completed"
          titleColor="teal"
          participants={participantGroups.completed}
          progressValue={() => 100}
          progressColor="teal"
          progressLabel={CompletedLabel}
        />

        <ParticipantSection
          title="Rejected"
          titleColor="red"
          participants={participantGroups.rejected}
          progressValue={(_, progress) => progress}
          progressColor="red"
          progressLabel={RejectedLabel}
        />

        <ParticipantSection
          title="Timed Out"
          titleColor="yellow"
          participants={participantGroups.timedOut}
          progressValue={(_, progress) => progress}
          progressColor="yellow"
          progressLabel={TimedOutLabel}
        />

        <ParticipantSection
          title="Completed Late"
          titleColor="grape"
          participants={participantGroups.completedLate}
          progressValue={() => 100}
          progressColor="grape"
          progressLabel={CompletedLabel}
        />
      </Stack>

    </Stack>
  );
}
