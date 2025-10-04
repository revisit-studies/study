import {
  Stack, Group, Card, Text, Title, Grid, Badge,
} from '@mantine/core';
import { useMemo, useEffect, useState } from 'react';
import { IconUsers, IconClock } from '@tabler/icons-react';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { StorageEngine, SequenceAssignment } from '../../../storage/engines/types';

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

    // Initialize study database
    storageEngine.initializeStudyDb(studyId);

    // For Firebase, we need to access the realtime listener
    // Since the base StorageEngine doesn't expose this directly, we'll need to check if it's a Firebase engine
    if (storageEngine.getEngine() === 'firebase') {
      // Access the Firebase-specific methods through the engine
      const firebaseEngine = storageEngine as StorageEngine & { _setupSequenceAssignmentListener?: (studyId: string, callback: (assignments: SequenceAssignment[]) => void) => () => void };

      // Set up the realtime listener
      const unsubscribe = firebaseEngine._setupSequenceAssignmentListener?.(studyId, (assignments: SequenceAssignment[]) => {
        // eslint-disable-next-line no-console
        console.log('Sequence assignments snapshot:', assignments);
        setSequenceAssignments(assignments);
      });

      return unsubscribe;
    }

    // For non-Firebase engines, poll periodically
    const interval = setInterval(async () => {
      try {
        const assignments = await (storageEngine as StorageEngine & { _getAllSequenceAssignments: (studyId: string) => Promise<SequenceAssignment[]> })._getAllSequenceAssignments(studyId);
        // eslint-disable-next-line no-console
        console.log('Sequence assignments snapshot:', assignments);
        setSequenceAssignments(assignments);
      } catch (error) {
        console.error('Error fetching sequence assignments:', error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [storageEngine, studyId]);

  const overviewStats = useMemo(() => {
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
    const completionRate = totalParticipants > 0 ? (completedParticipants / totalParticipants) * 100 : 0;

    // Calculate average completion time
    const completedWithTime = visibleParticipants.filter((p) => p.completed && !p.rejected);
    const totalTime = completedWithTime.reduce((sum, p) => {
      const times = Object.values(p.answers).map((a) => a.endTime - a.startTime).filter((t) => !Number.isNaN(t));
      return sum + (times.length > 0 ? times.reduce((a, b) => a + b, 0) : 0);
    }, 0);
    const avgCompletionTime = completedWithTime.length > 0 ? totalTime / completedWithTime.length : 0;

    return {
      totalParticipants,
      completedParticipants,
      inProgressParticipants,
      rejectedParticipants,
      completionRate,
      avgCompletionTime: avgCompletionTime / 1000, // Convert to seconds
    };
  }, [visibleParticipants]);

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
            <Text size="xl" fw={700}>{overviewStats.totalParticipants}</Text>
            <Group gap="xs" mt="sm">
              <Badge color="green" variant="light">
                {overviewStats.completedParticipants}
                {' '}
                Completed
              </Badge>
              <Badge color="yellow" variant="light">
                {overviewStats.inProgressParticipants}
                {' '}
                In Progress
              </Badge>
              <Badge color="red" variant="light">
                {overviewStats.rejectedParticipants}
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
              <Badge color="yellow" variant="light">
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

    </Stack>
  );
}
