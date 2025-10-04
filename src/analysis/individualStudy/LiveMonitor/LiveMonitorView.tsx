import {
  Stack, Group, Card, Text, Title, Grid, Badge, ActionIcon, RingProgress, Center,
} from '@mantine/core';
import { useMemo, useEffect, useState } from 'react';
import { IconUsers, IconClock, IconCheck } from '@tabler/icons-react';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { StorageEngine, SequenceAssignment } from '../../../storage/engines/types';
import { ProgressHeatmap } from './ProgressHeatmap';

export function LiveMonitorView({
  visibleParticipants, studyConfig: _studyConfig, storageEngine, studyId,
}: {
  visibleParticipants: ParticipantData[];
  studyConfig: StudyConfig;
  storageEngine?: StorageEngine;
  studyId?: string;
}) {
  const [sequenceAssignments, setSequenceAssignments] = useState<SequenceAssignment[]>([]);

  // Set up realtime listener for sequence assignments
  useEffect(() => {
    if (!storageEngine || !studyId) return undefined;

    storageEngine.initializeStudyDb(studyId);

    // For Firebase, we need to access the realtime listener
    if (storageEngine.getEngine() === 'firebase') {
      // Access the Firebase-specific methods through the engine
      const firebaseEngine = storageEngine as StorageEngine & { _setupSequenceAssignmentListener?: (studyId: string, callback: (assignments: SequenceAssignment[]) => void) => () => void };

      // Set up the realtime listener
      const unsubscribe = firebaseEngine._setupSequenceAssignmentListener?.(studyId, (assignments: SequenceAssignment[]) => {
        setSequenceAssignments(assignments);
      });

      return unsubscribe;
    }

    // For non-Firebase engines, poll periodically
    const interval = setInterval(async () => {
      try {
        const assignments = await (storageEngine as StorageEngine & { _getAllSequenceAssignments: (studyId: string) => Promise<SequenceAssignment[]> })._getAllSequenceAssignments(studyId);

        setSequenceAssignments(assignments);
      } catch (error) {
        console.error('Error fetching sequence assignments:', error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [storageEngine, studyId]);

  const liveStats = useMemo(() => {
    if (visibleParticipants.length === 0) {
      return {
        totalParticipants: 0,
        completedParticipants: 0,
        inProgressParticipants: 0,
        rejectedParticipants: 0,
        completionRate: 0,
        avgCompletionTime: 0,
      };
    }

    const totalParticipants = visibleParticipants.length;
    const completedParticipants = visibleParticipants.filter((p) => p.completed && !p.rejected).length;
    const inProgressParticipants = visibleParticipants.filter((p) => !p.completed && !p.rejected).length;
    const rejectedParticipants = visibleParticipants.filter((p) => p.rejected).length;

    return {
      totalParticipants,
      completedParticipants,
      inProgressParticipants,
      rejectedParticipants,
    };
  }, [visibleParticipants]);

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
    <Stack gap="md">
      <Title order={3}>Live Monitor</Title>

      <Grid>
        <Grid.Col span={6}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group gap="apart" mb="xs">
              <Text fw={500}>Participants</Text>
              <IconUsers size={20} />
            </Group>
            <Text size="xl" fw={700}>{liveStats.totalParticipants}</Text>
            <Group gap="xs" mt="sm">
              <Badge color="green" variant="light">
                {liveStats.completedParticipants}
                {' '}
                Completed
              </Badge>
              <Badge color="orange" variant="light">
                {liveStats.inProgressParticipants}
                {' '}
                In Progress
              </Badge>
              <Badge color="red" variant="light">
                {liveStats.rejectedParticipants}
                {' '}
                Rejected
              </Badge>
            </Group>
          </Card>
        </Grid.Col>
        <Grid.Col span={6}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group gap="apart" mb="xs">
              <Text fw={500}>Live Monitor</Text>
              <IconClock size={20} />
            </Group>
            <Text size="xl" fw={700}>{sequenceAssignments.length}</Text>
            <Group gap="xs" mt="sm">
              <Badge color="green" variant="light">
                {sequenceAssignments.filter((a) => a.completed).length}
                {' '}
                Completed
              </Badge>
              <Badge color="orange" variant="light">
                {sequenceAssignments.filter((a) => !a.completed && !a.rejected).length}
                {' '}
                In Progress
              </Badge>
              <Badge color="red" variant="light">
                {sequenceAssignments.filter((a) => a.rejected).length}
                {' '}
                Rejected
              </Badge>
            </Group>
          </Card>
        </Grid.Col>
      </Grid>

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
                      <Card shadow="sm" padding="lg" radius="md" withBorder>
                        <Group justify="space-between" align="center">
                          <div>
                            <Text fw={500} size="sm">
                              Participant:
                              {' '}
                              {assignment.participantId || `#${index + 1}`}
                            </Text>
                            <Text size="sm" c="dimmed">
                              In Progress
                            </Text>
                            <Text size="xs" c="dimmed">
                              Started:
                              {' '}
                              {new Date(assignment.createdTime).toLocaleString()}
                            </Text>
                          </div>

                          <ProgressHeatmap total={assignment.total} answered={assignment.answered} />
                          <RingProgress
                            size={80}
                            thickness={8}
                            sections={[{
                              value: progress,
                              color: 'orange',
                            }]}
                            label={(
                              <Text
                                c="orange"
                                fw={700}
                                ta="center"
                                size="sm"
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
                      <Card shadow="sm" padding="lg" radius="md" withBorder>
                        <Group justify="space-between" align="center">
                          <div>
                            <Text fw={500} size="sm">
                              Participant:
                              {' '}
                              {assignment.participantId || `#${index + 1}`}
                            </Text>
                            <Text size="sm" c="dimmed">
                              Completed
                            </Text>
                            <Text size="xs" c="dimmed">
                              Started:
                              {' '}
                              {new Date(assignment.createdTime).toLocaleString()}
                            </Text>
                          </div>
                          <RingProgress
                            size={80}
                            thickness={8}
                            sections={[{
                              value: 100,
                              color: 'teal',
                            }]}
                            label={(
                              <Center>
                                <ActionIcon color="teal" variant="light" radius="xl" size="xl">
                                  <IconCheck size={22} />
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
                      <Card shadow="sm" padding="lg" radius="md" withBorder>
                        <Group justify="space-between" align="center">
                          <div>
                            <Text fw={500} size="sm">
                              Participant:
                              {' '}
                              {assignment.participantId || `#${index + 1}`}
                            </Text>
                            <Text size="sm" c="dimmed">
                              Rejected
                            </Text>
                            <Text size="xs" c="dimmed">
                              Started:
                              {' '}
                              {new Date(assignment.createdTime).toLocaleString()}
                            </Text>
                          </div>
                          <RingProgress
                            size={80}
                            thickness={8}
                            sections={[{
                              value: progress,
                              color: 'red',
                            }]}
                            label={(
                              <Text
                                c="red"
                                fw={700}
                                ta="center"
                                size="sm"
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
