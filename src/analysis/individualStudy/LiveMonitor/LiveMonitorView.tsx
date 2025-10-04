import {
  Stack, Group, Card, Text, Title, Grid, Badge, ActionIcon, RingProgress, Center, Indicator, Tooltip, Button, Flex,
} from '@mantine/core';
import { useMemo, useEffect, useState } from 'react';
import {
  IconCheck, IconWifi, IconWifiOff, IconRefresh,
} from '@tabler/icons-react';
import { StudyConfig } from '../../../parser/types';
import { StorageEngine, SequenceAssignment } from '../../../storage/engines/types';
import { ProgressHeatmap } from './ProgressHeatmap';

export function LiveMonitorView({ studyConfig: _studyConfig, storageEngine, studyId }: {
  studyConfig: StudyConfig;
  storageEngine?: StorageEngine;
  studyId?: string;
}) {
  const [sequenceAssignments, setSequenceAssignments] = useState<SequenceAssignment[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Function to handle successful data update
  const handleDataUpdate = (assignments: SequenceAssignment[]) => {
    setSequenceAssignments(assignments);
    setConnectionStatus('connected');
    setLastUpdateTime(new Date());
    setIsReconnecting(false);
  };

  // Function to manually reconnect
  const handleReconnect = async () => {
    if (!storageEngine || !studyId || isReconnecting) return;

    // Check if browser is online before attempting reconnection
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
    }, 5000); // 5 second timeout

    try {
      // Reinitialize the connection
      storageEngine.initializeStudyDb(studyId);

      // For Firebase, we need to access the realtime listener
      if (storageEngine.getEngine() === 'firebase') {
        // Try to get current data immediately
        const assignments = await (storageEngine as StorageEngine & { _getAllSequenceAssignments: (studyId: string) => Promise<SequenceAssignment[]> })._getAllSequenceAssignments(studyId);

        // Clear the timeout since connection was successful
        clearTimeout(connectionTimeout);
        handleDataUpdate(assignments);
      } else {
        // For non-Firebase engines, fetch data immediately
        const assignments = await (storageEngine as StorageEngine & { _getAllSequenceAssignments: (studyId: string) => Promise<SequenceAssignment[]> })._getAllSequenceAssignments(studyId);

        // Clear the timeout since connection was successful
        clearTimeout(connectionTimeout);
        handleDataUpdate(assignments);
      }
    } catch (error) {
      console.error('Reconnection failed:', error);
      clearTimeout(connectionTimeout);
      setConnectionStatus('disconnected');
      setIsReconnecting(false);
    }
  };

  // Set up realtime listener for sequence assignments
  useEffect(() => {
    if (!storageEngine || !studyId) {
      setConnectionStatus('disconnected');
      return undefined;
    }

    setConnectionStatus('connecting');
    storageEngine.initializeStudyDb(studyId);

    // For Firebase, we need to access the realtime listener
    if (storageEngine.getEngine() === 'firebase') {
      // Access the Firebase-specific methods through the engine
      const firebaseEngine = storageEngine as StorageEngine & { _setupSequenceAssignmentListener?: (studyId: string, callback: (assignments: SequenceAssignment[]) => void) => () => void };

      // Set up the realtime listener
      const unsubscribe = firebaseEngine._setupSequenceAssignmentListener?.(studyId, (assignments: SequenceAssignment[]) => {
        handleDataUpdate(assignments);
      });

      // Set connected status after a brief delay to show connection is established
      const initialConnectionTimeout = setTimeout(() => {
        if (connectionStatus === 'connecting') {
          setConnectionStatus('connected');
        }
      }, 1000);

      return () => {
        unsubscribe?.();
        clearTimeout(initialConnectionTimeout);
      };
    }

    // For non-Firebase engines, poll periodically
    const fetchData = async () => {
      try {
        const assignments = await (storageEngine as StorageEngine & { _getAllSequenceAssignments: (studyId: string) => Promise<SequenceAssignment[]> })._getAllSequenceAssignments(studyId);
        handleDataUpdate(assignments);
      } catch (error) {
        console.error('Error fetching sequence assignments:', error);
        setConnectionStatus('disconnected');
      }
    };

    // Initial fetch
    fetchData();

    const interval = setInterval(fetchData, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [storageEngine, studyId]);

  // Monitor browser online/offline status
  useEffect(() => {
    const handleOnline = () => {
      if (storageEngine && studyId && connectionStatus === 'disconnected') {
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
  }, [storageEngine, studyId]);

  // Calculate progress for each participant using live monitor data
  const participantProgress = useMemo(() => sequenceAssignments.map((assignment) => {
    const progress = assignment.total > 0 ? (assignment.answered / assignment.total) * 100 : 0;

    return {
      assignment,
      progress,
      isCompleted: assignment.completed !== null,
      isRejected: assignment.rejected,
    };
  }).sort((a, b) => b.assignment.createdTime - a.assignment.createdTime), [sequenceAssignments]);

  return (
    <Stack gap="sm">
      {/* Compact Banner Header - Sticky */}
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
          {/* Left side: Title and Stats */}
          <Group gap="md">
            <Title order={5} size="h5">Live Monitor</Title>
            <Text size="sm" c="dimmed">
              Total:
              {' '}
              {sequenceAssignments.length}
            </Text>
            <Group gap="xs">
              <Badge color="green" variant="light" size="sm">
                {sequenceAssignments.filter((a) => a.completed).length}
                {' '}
                Completed
              </Badge>
              <Badge color="orange" variant="light" size="sm">
                {sequenceAssignments.filter((a) => !a.completed && !a.rejected).length}
                {' '}
                Active
              </Badge>
              <Badge color="red" variant="light" size="sm">
                {sequenceAssignments.filter((a) => a.rejected).length}
                {' '}
                Rejected
              </Badge>
            </Group>
          </Group>

          <Group gap="xs">
            {/* Reconnect button - only show when disconnected */}
            {connectionStatus === 'disconnected' && (
              <Button
                size="xs"
                variant="light"
                color="blue"
                leftSection={<IconRefresh size={12} />}
                loading={isReconnecting}
                onClick={handleReconnect}
                disabled={!storageEngine || !studyId}
              >
                Reconnect
              </Button>
            )}

            <Tooltip
              label={
                connectionStatus === 'connected'
                  ? `Connected${lastUpdateTime ? ` - Established since: ${lastUpdateTime.toLocaleTimeString()}` : ''}`
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

      {/* Participant Progress Section */}
      <Title order={4} mt="lg">Participant Progress</Title>

      {(() => {
        const inProgress = participantProgress.filter((p) => !p.isCompleted && !p.isRejected);
        const completed = participantProgress.filter((p) => p.isCompleted && !p.isRejected);
        const rejected = participantProgress.filter((p) => p.isRejected);

        return (
          <Stack gap="md">
            {/* In Progress Section */}
            {inProgress.length > 0 && (
              <>
                <Title order={5} c="orange">
                  In Progress (
                  {inProgress.length}
                  )
                </Title>
                <Grid>
                  {inProgress.map(({ assignment, progress }, index) => (
                    <Grid.Col span={12} key={assignment.participantId || `inprogress-${index}`}>
                      <Card shadow="sm" padding="sm" radius="md" withBorder>
                        <Group justify="space-between" align="center">
                          <div>
                            <Group gap="xs" align="center">
                              <Text fw={500} size="sm">
                                Participant:
                                {' '}
                                {assignment.participantId || `#${index + 1}`}
                              </Text>
                              {assignment.isDynamic && (
                                <Badge size="xs" color="cyan">
                                  DYNAMIC
                                </Badge>
                              )}
                            </Group>

                            <Text size="xs" c="dimmed">
                              Started:
                              {' '}
                              {new Date(assignment.createdTime).toLocaleString()}
                            </Text>
                          </div>

                          <ProgressHeatmap total={assignment.total} answered={assignment.answered} isDynamic={assignment.isDynamic} />
                          <RingProgress
                            size={60}
                            thickness={6}
                            sections={[{
                              value: assignment.isDynamic ? 50 : progress,
                              color: 'orange',
                            }]}
                            label={(
                              <Text
                                c="orange"
                                fw={700}
                                ta="center"
                                size="xs"
                              >
                                {assignment.isDynamic ? '?' : Math.round(progress)}
                                %
                              </Text>
                                )}
                          />
                        </Group>
                      </Card>
                    </Grid.Col>
                  ))}
                </Grid>
              </>
            )}

            {/* Completed Section */}
            {completed.length > 0 && (
              <>
                <Title order={5} c="teal">
                  Completed (
                  {completed.length}
                  )
                </Title>
                <Grid>
                  {completed.map(({ assignment }, index) => (
                    <Grid.Col span={12} key={assignment.participantId || `completed-${index}`}>
                      <Card shadow="sm" padding="sm" radius="md" withBorder>
                        <Group justify="space-between" align="center">
                          <div>
                            <Text fw={500} size="sm">
                              Participant:
                              {' '}
                              {assignment.participantId || `#${index + 1}`}
                            </Text>

                            <Text size="xs" c="dimmed">
                              Started:
                              {' '}
                              {new Date(assignment.createdTime).toLocaleString()}
                            </Text>
                          </div>
                          <RingProgress
                            size={60}
                            thickness={6}
                            sections={[{
                              value: 100,
                              color: 'teal',
                            }]}
                            label={(
                              <Center>
                                <ActionIcon color="teal" variant="light" radius="xl" size="sm">
                                  <IconCheck size={16} />
                                </ActionIcon>
                              </Center>
                            )}
                          />
                        </Group>
                      </Card>
                    </Grid.Col>
                  ))}
                </Grid>
              </>
            )}

            {/* Rejected Section */}
            {rejected.length > 0 && (
              <>
                <Title order={5} c="red">
                  Rejected (
                  {rejected.length}
                  )
                </Title>
                <Grid>
                  {rejected.map(({ assignment, progress }, index) => (
                    <Grid.Col span={12} key={assignment.participantId || `rejected-${index}`}>
                      <Card shadow="sm" padding="sm" radius="md" withBorder>
                        <Group justify="space-between" align="center">
                          <div>
                            <Text fw={500} size="sm">
                              Participant:
                              {' '}
                              {assignment.participantId || `#${index + 1}`}
                            </Text>

                            <Text size="xs" c="dimmed">
                              Started:
                              {' '}
                              {new Date(assignment.createdTime).toLocaleString()}
                            </Text>
                          </div>
                          <RingProgress
                            size={60}
                            thickness={6}
                            sections={[{
                              value: progress,
                              color: 'red',
                            }]}
                            label={(
                              <Text
                                c="red"
                                fw={700}
                                ta="center"
                                size="xs"
                              >
                                {Math.round(progress)}
                                %
                              </Text>
                            )}
                          />
                        </Group>
                      </Card>
                    </Grid.Col>
                  ))}
                </Grid>
              </>
            )}
          </Stack>
        );
      })()}

    </Stack>
  );
}
