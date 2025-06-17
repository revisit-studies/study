import {
  Flex, Paper, Table, Text, Title, ScrollArea,
} from '@mantine/core';
import { ParticipantData } from '../../../storage/types';
import { getCleanedDuration } from '../../../utils/getCleanedDuration';

interface ComponentStats {
  name: string;
  avgTime: number;
  avgCleanTime: number;
  participantCount: number;
  correctness: number;
}

function calculateComponentStats(visibleParticipants: ParticipantData[]): ComponentStats[] {
  // Filter out rejected participants
  const validParticipants = visibleParticipants.filter((p) => !p.rejected);
  const stats: Record<string, ComponentStats> = {};

  validParticipants.forEach((participant) => {
    const components = new Set<string>();
    Object.entries(participant.answers).forEach(([taskId, answer]) => {
      const component = `${taskId.split('_')[0]}`;

      if (!stats[component]) {
        stats[component] = {
          name: component,
          avgTime: 0,
          avgCleanTime: 0,
          participantCount: 0,
          correctness: 0,
        };
      }
      // In progress participants are not included in the stats
      if (answer.endTime === -1) {
        return;
      }
      const stat = stats[component];
      const time = (answer.endTime - answer.startTime) / 1000;
      const cleanTime = getCleanedDuration(answer as never);

      stat.avgTime += time;
      stat.avgCleanTime += cleanTime ? cleanTime / 1000 : 0;

      // This is to avoid counting the same participant multiple times for dynamic blocks and latin squares
      if (!components.has(component)) {
        components.add(component);
        stat.participantCount += 1;
      }

      if (answer.correctAnswer && answer.correctAnswer.length > 0) {
        const isCorrect = answer.correctAnswer.every((correctAnswer) => {
          const participantAnswer = answer.answer[correctAnswer.id];
          return correctAnswer.answer === participantAnswer;
        });
        stat.correctness += isCorrect ? 1 : 0;
      }
    });
  });

  return Object.values(stats)
    .map((stat) => {
      // Get all questions that belong to this component and have correct answers defined
      const questions = Object.values(validParticipants).flatMap((participant) => Object.keys(participant.answers).filter((key) => key.startsWith(stat.name) && participant.answers[key]?.correctAnswer?.length > 0));

      // Count total attempts for this component
      const totalAttempts = Object.values(validParticipants).reduce((count, participant) => count + Object.keys(participant.answers).filter((key) => key.startsWith(stat.name) && participant.answers[key].endTime !== -1).length, 0);

      // Check if any participant has correct answers defined for this component
      const hasCorrectAnswers = questions.length > 0;

      return {
        ...stat,
        // Calculate average time per attempt
        avgTime: totalAttempts ? stat.avgTime / totalAttempts : 0,
        avgCleanTime: totalAttempts ? stat.avgCleanTime / totalAttempts : 0,
        // Calculate correctness as percentage of correct answers out of questions with correct answers defined
        correctness: hasCorrectAnswers ? (stat.correctness / questions.length) * 100 : NaN,
      };
    });
}

export function ComponentStats({ visibleParticipants }: { visibleParticipants: ParticipantData[] }) {
  const stats = calculateComponentStats(visibleParticipants);

  return (
    <Paper shadow="sm" p="md" withBorder>
      <Title order={4} mb="md">Component Statistics</Title>
      {visibleParticipants.length === 0 || stats.length === 0 ? (
        <Flex justify="center" align="center" pt="lg" pb="md">
          <Text>No data available</Text>
        </Flex>
      ) : (
        <ScrollArea>
          <Table striped withTableBorder withColumnBorders highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Component</Table.Th>
                <Table.Th>Participants</Table.Th>
                <Table.Th>Avg Time</Table.Th>
                <Table.Th>Avg Clean Time</Table.Th>
                <Table.Th>Correctness</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {stats.map((stat) => (
                <Table.Tr key={stat.name}>
                  <Table.Td>{stat.name}</Table.Td>
                  <Table.Td>{stat.participantCount}</Table.Td>
                  <Table.Td>
                    {Number.isFinite(stat.avgTime) ? `${stat.avgTime.toFixed(1)} s` : 'N/A'}
                  </Table.Td>
                  <Table.Td>
                    {Number.isFinite(stat.avgCleanTime) ? `${stat.avgCleanTime.toFixed(1)} s` : 'N/A'}
                  </Table.Td>
                  <Table.Td>
                    {!Number.isNaN(stat.correctness) ? `${stat.correctness.toFixed(1)}%` : 'N/A'}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}
    </Paper>
  );
}
