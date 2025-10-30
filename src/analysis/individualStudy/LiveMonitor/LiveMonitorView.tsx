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

function RejectedLabel({ progress }: { progress: number }) {
  return (
    <Text
      c="red"
      fw={700}
      ta="center"
      size="xs"
    >
      {Math.round(progress)}
      %
    </Text>
  );
}

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

  const filteredParticipantProgress = useMemo(() => sequenceAssignments
    .map((assignment) => {
      const progress = assignment.total > 0 ? (assignment.answered.length / assignment.total) * 100 : 0;
      const isCompleted = assignment.completed !== null;
      const isRejected = assignment.rejected;

      return {
        assignment,
        progress,
        isCompleted,
        isRejected,
      };
    })
    .filter(({ isCompleted, isRejected, assignment }) => {
      // Determine participant status
      const status = isRejected ? 'rejected' : (isCompleted ? 'completed' : 'inprogress');

      // Check if this status is included in the filter
      const statusMatch = includedParticipants.includes(status);

      // Check stage filter - if "ALL" is selected, show all participants
      const stageMatch = selectedStages.includes('ALL') || selectedStages.includes(assignment.stage || '');

      return statusMatch && stageMatch;
    })
    .sort((a, b) => b.assignment.createdTime - a.assignment.createdTime), [sequenceAssignments, includedParticipants, selectedStages]);

  // Group participants by status
  const participantGroups = useMemo(() => {
    const inProgress = filteredParticipantProgress.filter((p) => !p.isCompleted && !p.isRejected);
    const completed = filteredParticipantProgress.filter((p) => p.isCompleted && !p.isRejected);
    const rejected = filteredParticipantProgress.filter((p) => p.isRejected);

    return { inProgress, completed, rejected };
  }, [filteredParticipantProgress]);

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
          backgroundColor: 'white',
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
                {filteredParticipantProgress.filter((p) => p.isCompleted).length}
                {' '}
                Completed
              </Badge>
              <Badge color="orange" variant="light" size="sm">
                {filteredParticipantProgress.filter((p) => !p.isCompleted && !p.isRejected).length}
                {' '}
                Active
              </Badge>
              <Badge color="red" variant="light" size="sm">
                {filteredParticipantProgress.filter((p) => p.isRejected).length}
                {' '}
                Rejected
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
                  <IconWifi size={22} color="green" />
                ) : (
                  <IconWifiOff size={22} color={connectionStatus === 'connecting' ? 'orange' : 'red'} />
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
      </Stack>

    </Stack>
  );
}
