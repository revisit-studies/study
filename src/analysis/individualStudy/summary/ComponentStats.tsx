import {
  Flex, Paper, Table, Text, Title,
} from '@mantine/core';
import { ParticipantData } from '../../../storage/types';
// import { getCleanedDuration } from '../../../utils/getCleanedDuration';

interface ComponentStatsProps {
  participantData: ParticipantData[];
}

interface TaskStats {
  name: string;
  avgTime: number;
  avgCleanTime: number;
  attempts: number;
  correctness: number;
}

function toDisplayData(milliseconds: number) {
  if (!Number.isFinite(milliseconds)) return 'N/A';
  const minutes = Math.floor(milliseconds / (1000 * 60));
  const seconds = ((milliseconds % (1000 * 60)) / 1000).toFixed(1);
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function calculateTaskStats(participants: ParticipantData[]): TaskStats[] {
  const stats: Record<string, TaskStats> = {};

  participants.forEach((participant) => {
    Object.entries(participant.answers).forEach(([taskId, answer]) => {
      const [taskName, trialNumber] = taskId.split('_');
      const displayName = `${taskName}_${trialNumber}`;

      if (!stats[displayName]) {
        stats[displayName] = {
          name: displayName,
          avgTime: 0,
          avgCleanTime: 0,
          attempts: 0,
          correctness: 0,
        };
      }

      if (answer.endTime !== -1) {
        const time = answer.endTime - answer.startTime;
        const cleanTime = Math.max(0, time - (answer.windowEvents?.length || 0) * 100);

        stats[displayName].avgTime += time;
        stats[displayName].avgCleanTime += cleanTime;
        stats[displayName].attempts += 1;

        // Calculate correctness if correctAnswer exists
        if (answer.correctAnswer && answer.correctAnswer.length > 0) {
          const isCorrect = answer.correctAnswer.some((ca) => JSON.stringify(ca.answer) === JSON.stringify(answer.answer[ca.id]));
          stats[displayName].correctness += isCorrect ? 1 : 0;
        }
      }
    });
  });

  // Calculate averages
  Object.values(stats).forEach((stat) => {
    if (stat.attempts > 0) {
      stat.avgTime /= stat.attempts;
      stat.avgCleanTime /= stat.attempts;
      stat.correctness = (stat.correctness / stat.attempts) * 100;
    }
  });

  return Object.values(stats).sort((a, b) => {
    const [aComponent] = a.name.split('_');
    const [bComponent] = b.name.split('_');
    if (aComponent !== bComponent) {
      return aComponent.localeCompare(bComponent);
    }
    const [, aTrial] = a.name.split('_');
    const [, bTrial] = b.name.split('_');
    return Number.parseInt(aTrial, 10) - Number.parseInt(bTrial, 10);
  });
}

export function ComponentStats({ participantData }: ComponentStatsProps) {
  const taskStats = calculateTaskStats(participantData);

  return (
    <Paper withBorder p="md" radius="md">
      <Title order={4} mb="md">Component Timing Statistics</Title>
      {participantData.length === 0 ? (
        <Flex justify="center" align="center" pt="lg" pb="md">
          <Text>No data available</Text>
        </Flex>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Component</Table.Th>
              <Table.Th>Avg Time</Table.Th>
              <Table.Th>Avg Clean Time</Table.Th>
              <Table.Th>Attempts</Table.Th>
              <Table.Th>Correctness</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {taskStats.map((stat) => (
              <Table.Tr key={stat.name}>
                <Table.Td>{stat.name}</Table.Td>
                <Table.Td>{toDisplayData(stat.avgTime)}</Table.Td>
                <Table.Td>{toDisplayData(stat.avgCleanTime)}</Table.Td>
                <Table.Td>{stat.attempts}</Table.Td>
                <Table.Td>{`${stat.correctness.toFixed(1)}%`}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Paper>
  );
}
