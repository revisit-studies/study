import {
  Flex, Paper, Text, Table, Box,
} from '@mantine/core';
import { ParticipantData } from '../../../storage/types';

// Component name
// Correctness
interface ResponseStats {
  name: string;
  responseType: string;
  correctness: number;
  totalResponses: number;
  correctResponses: number;
}

function calculateResponseStats(participantData: ParticipantData[]): ResponseStats[] {
  const componentStats = new Map<string, Map<string, { total: number; correct: number }>>();

  // Process each participant's data
  participantData.forEach((participant) => {
    Object.entries(participant.answers).forEach(([key, answer]) => {
      const [componentId, responseId] = key.split('_');

      // Initialize stats for this component if not exists
      if (!componentStats.has(componentId)) {
        componentStats.set(componentId, new Map());
      }

      const componentMap = componentStats.get(componentId)!;

      // Initialize stats for this response type if not exists
      if (!componentMap.has(responseId)) {
        componentMap.set(responseId, { total: 0, correct: 0 });
      }

      const stats = componentMap.get(responseId)!;
      stats.total += 1;

      // Check if the answer is correct
      if (answer.answer && Object.keys(answer.answer).length > 0) {
        stats.correct += 1;
      }
    });
  });

  // Convert to array format
  const stats: ResponseStats[] = [];
  componentStats.forEach((responseMap, componentId) => {
    responseMap.forEach((responseStats, responseId) => {
      stats.push({
        name: componentId,
        responseType: responseId,
        correctness: responseStats.total > 0 ? (responseStats.correct / responseStats.total) * 100 : 0,
        totalResponses: responseStats.total,
        correctResponses: responseStats.correct,
      });
    });
  });

  return stats;
}

export function ResponseStats({ participantData }: { participantData: ParticipantData[]}) {
  const responseStats = calculateResponseStats(participantData);
  return (
    <Paper shadow="sm" p="md" withBorder>
      {(participantData.length === 0) ? (
        <Flex justify="center" align="center" pt="lg" pb="md">
          <Text>No data available</Text>
        </Flex>
      ) : (
        <Box>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Component</Table.Th>
                <Table.Th>Response Type</Table.Th>
                <Table.Th>Correctness</Table.Th>
                <Table.Th>Responses</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {responseStats.map((stat) => (
                <Table.Tr key={`${stat.name}_${stat.responseType}`}>
                  <Table.Td>{stat.name}</Table.Td>
                  <Table.Td>{stat.responseType}</Table.Td>
                  <Table.Td>
                    {stat.correctness.toFixed(1)}
                    %
                  </Table.Td>
                  <Table.Td>
                    {stat.correctResponses}
                    /
                    {stat.totalResponses}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Box>
      )}
    </Paper>
  );
}
