import {
  Stack, Group, Card, Text, Title, Badge, ActionIcon, Center, Indicator, Tooltip, Button, Flex, Switch, NumberInput, Modal,
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
import { useAuth } from '../../../store/hooks/useAuth';

export interface LiveMonitorParticipantProgress {
  assignment: SequenceAssignment;
  progress: number;
  isCompleted: boolean;
  isRejected: boolean;
  isTimedOut?: boolean;
}

export function getFilteredParticipantProgress(
  sequenceAssignments: SequenceAssignment[],
  includedParticipants: string[],
  selectedStages: string[],
): LiveMonitorParticipantProgress[] {
  return sequenceAssignments
    .map((assignment) => {
      const progress = assignment.total > 0 ? (assignment.answered.length / assignment.total) * 100 : 0;
      const isCompleted = assignment.completed !== null;
      const isRejected = assignment.rejected;
      const isTimedOut = assignment.autoTimedOutAt !== undefined;

      return {
        assignment,
        progress,
        isCompleted,
        isRejected,
        isTimedOut,
      };
    })
    .filter(({
      isCompleted, isRejected, isTimedOut, assignment,
    }) => {
      const status = isRejected ? 'rejected' : (isTimedOut ? 'timedOut' : (isCompleted ? 'completed' : 'inProgress'));
      const statusMatch = includedParticipants.includes(status);
      const stageMatch = selectedStages.includes('ALL') || selectedStages.includes(assignment.stage || '');

      return statusMatch && stageMatch;
    })
    .sort((a, b) => b.assignment.createdTime - a.assignment.createdTime);
}

export function groupParticipantProgress(filteredParticipantProgress: LiveMonitorParticipantProgress[]) {
  const inProgress = filteredParticipantProgress.filter((participant) => !participant.isCompleted && !participant.isRejected && !participant.isTimedOut);
  const completed = filteredParticipantProgress.filter((participant) => participant.isCompleted && !participant.isRejected && !participant.isTimedOut);
  const rejected = filteredParticipantProgress.filter((participant) => participant.isRejected);
  const timedOut = filteredParticipantProgress.filter((participant) => participant.isTimedOut && !participant.isRejected);

  return {
    inProgress, completed, rejected, timedOut,
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
  const isFirebaseEngine = storageEngine?.getEngine() === 'firebase';
  const firebaseStoreageEngine = isFirebaseEngine ? storageEngine as FirebaseStorageEngine : undefined;
  const { user } = useAuth();
  const [sequenceAssignments, setSequenceAssignments] = useState<SequenceAssignment[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [autoTimeoutMinutes, setAutoTimeoutMinutes] = useState<number | undefined>();
  const [autoTimeoutDraftMinutes, setAutoTimeoutDraftMinutes] = useState(60);
  const [enableConfirmationOpen, setEnableConfirmationOpen] = useState(false);
  const [timeoutSettingsLoading, setTimeoutSettingsLoading] = useState(true);
  const [timeoutSettingsSaving, setTimeoutSettingsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!storageEngine || !studyId) {
      setTimeoutSettingsLoading(false);
      return () => { cancelled = true; };
    }
    storageEngine.getModes(studyId)
      .then((modes) => {
        if (!cancelled) {
          setAutoTimeoutMinutes(modes.autoTimeoutMinutes);
          setAutoTimeoutDraftMinutes(modes.autoTimeoutMinutes ?? 60);
          setTimeoutSettingsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setTimeoutSettingsLoading(false);
      });
    return () => { cancelled = true; };
  }, [storageEngine, studyId]);

  const saveAutoTimeout = useCallback(async (minutes: number | undefined) => {
    if (!storageEngine || !studyId || !user.isAdmin) return;
    setTimeoutSettingsSaving(true);
    try {
      await storageEngine.setAutoTimeoutMinutes(studyId, minutes);
      setAutoTimeoutMinutes(minutes);
      if (minutes !== undefined) {
        setAutoTimeoutDraftMinutes(minutes);
      }
    } catch (error) {
      console.error('Failed to save auto-timeout setting:', error);
    } finally {
      setTimeoutSettingsSaving(false);
    }
  }, [storageEngine, studyId, user.isAdmin]);

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

  return (
    <Stack gap="sm">
      <Modal
        centered
        opened={enableConfirmationOpen}
        onClose={() => setEnableConfirmationOpen(false)}
        title="Enable auto-timeout?"
      >
        <Stack gap="md">
          <Text size="sm">
            On the next new participant assignment, participants who started more than
            {' '}
            {autoTimeoutDraftMinutes}
            {' '}
            minutes ago will no longer count toward participant limits. They can still finish the study normally.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEnableConfirmationOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                setEnableConfirmationOpen(false);
                saveAutoTimeout(autoTimeoutDraftMinutes).catch(() => undefined);
              }}
            >
              Enable auto-timeout
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Card shadow="sm" padding="sm" radius="md" withBorder>
        <Group justify="space-between" align="flex-start">
          <Stack gap={2}>
            <Title order={5} size="h5">Auto-timeout</Title>
            <Text size="sm" c="dimmed">
              When a new participant starts, people who began more than this long ago no longer count toward participant limits. Timed-out participants can still finish normally.
            </Text>
          </Stack>
          <Group align="center" wrap="nowrap">
            <NumberInput
              aria-label="Auto-timeout minutes"
              value={autoTimeoutDraftMinutes}
              min={1}
              allowDecimal={false}
              hideControls
              suffix=" minutes"
              disabled={!user.isAdmin || timeoutSettingsLoading || timeoutSettingsSaving}
              w={125}
              onChange={(value) => setAutoTimeoutDraftMinutes(
                typeof value === 'number' ? Math.max(1, Math.floor(value)) : 60,
              )}
              onBlur={() => {
                if (autoTimeoutMinutes !== undefined) {
                  saveAutoTimeout(autoTimeoutDraftMinutes).catch(() => undefined);
                }
              }}
            />
            <Switch
              aria-label="Enable auto-timeout"
              checked={autoTimeoutMinutes !== undefined}
              disabled={!user.isAdmin || timeoutSettingsLoading || timeoutSettingsSaving}
              onChange={(event) => {
                if (event.currentTarget.checked) {
                  setEnableConfirmationOpen(true);
                } else {
                  saveAutoTimeout(undefined).catch(() => undefined);
                }
              }}
            />
          </Group>
        </Group>
        {!user.isAdmin && <Text size="xs" c="dimmed" mt="xs">Only study administrators can change auto-timeout.</Text>}
      </Card>

      {!isFirebaseEngine && (
        <Center py="xl">
          <Text c="dimmed">Live participant monitoring is currently available with Firebase. Auto-timeout settings are available for this storage engine.</Text>
        </Center>
      )}

      {isFirebaseEngine ? (
        <>
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
                    {filteredParticipantProgress.filter((p) => p.isCompleted && !p.isRejected && !p.isTimedOut).length}
                    {' '}
                    Completed
                  </Badge>
                  <Badge color="orange" variant="light" size="sm">
                    {filteredParticipantProgress.filter((p) => !p.isCompleted && !p.isRejected && !p.isTimedOut).length}
                    {' '}
                    Active
                  </Badge>
                  <Badge color="red" variant="light" size="sm">
                    {filteredParticipantProgress.filter((p) => p.isRejected).length}
                    {' '}
                    Rejected
                  </Badge>
                  <Badge color="yellow" variant="light" size="sm">
                    {filteredParticipantProgress.filter((p) => p.isTimedOut && !p.isRejected).length}
                    {' '}
                    Timed Out
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
            <ParticipantSection
              title="Timed Out"
              titleColor="yellow"
              participants={participantGroups.timedOut}
              progressValue={(_, progress) => progress}
              progressColor="yellow"
              progressLabel={RejectedLabel}
            />
          </Stack>
        </>
      ) : null}

    </Stack>
  );
}
