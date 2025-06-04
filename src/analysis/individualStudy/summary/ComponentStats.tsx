import {
  Flex, Paper, Table, Text, Box,
} from '@mantine/core';
import { ParticipantData } from '../../../storage/types';
import { getCleanedDuration } from '../../../utils/getCleanedDuration';

function toDisplayData(milliseconds: number) {
  if (!Number.isFinite(milliseconds)) return 'N/A';
  const minutes = Math.floor(milliseconds / (1000 * 60));
  const seconds = ((milliseconds % (1000 * 60)) / 1000).toFixed(2);
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

interface ComponentStats {
  name: string;
  avgTime: number;
  avgCleanTime: number;
  participants: number;
}

function calculateComponentStats(participantData: ParticipantData[]) {
  const componentStats: ComponentStats[] = [];

  // Group answers by component
  const componentAnswers = new Map<string, ParticipantData['answers']>();

  participantData.forEach((record) => {
    Object.entries(record.answers).forEach(([_key, value]) => {
      const componentId = _key.split('_')[0];
      if (!componentAnswers.has(componentId)) {
        componentAnswers.set(componentId, {});
      }
      componentAnswers.get(componentId)![_key] = value;
    });
  });

  componentAnswers.forEach((answers, componentId) => {
    let totalTime = 0;
    let totalCleanTime = 0;
    let validResponses = 0;

    // Calculate times
    Object.entries(answers).forEach(([_key, answer]) => {
      if (Number.isFinite(answer.endTime) && Number.isFinite(answer.startTime)) {
        const duration = (answer.endTime - answer.startTime) / 1000; // Convert to seconds
        const cleanDuration = getCleanedDuration(answer as never);

        if (duration >= 0) {
          totalTime += duration;
          validResponses += 1;
        }

        if (cleanDuration !== undefined && Number.isFinite(cleanDuration)) {
          totalCleanTime += cleanDuration / 1000; // Convert to seconds
        }
      }
    });

    // Count participants who have any response for this component
    const participants = participantData.filter((participant) => Object.keys(participant.answers).some((key) => key.startsWith(`${componentId}_`))).length;

    componentStats.push({
      name: componentId,
      avgTime: validResponses > 0 ? totalTime / validResponses : 0,
      avgCleanTime: validResponses > 0 ? totalCleanTime / validResponses : 0,
      participants,
    });
  });

  return componentStats;
}

export function ComponentStats({ participantData }: { participantData: ParticipantData[]}) {
  const componentStats = calculateComponentStats(participantData);

  return (
    <Paper shadow="sm" p="md" withBorder>
      <Text fw="bold">Component Stats</Text>
      {(participantData.length === 0) ? (
        <Flex justify="center" align="center" pt="lg" pb="md">
          <Text>No data available</Text>
        </Flex>
      ) : (
        <Box>
          <Table mb="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Component</Table.Th>
                <Table.Th>Avg Time</Table.Th>
                <Table.Th>Avg Clean Time</Table.Th>
                <Table.Th>Participants</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {componentStats.map((component) => (
                <Table.Tr key={component.name}>
                  <Table.Td>{component.name}</Table.Td>
                  <Table.Td>{toDisplayData(component.avgTime * 1000)}</Table.Td>
                  <Table.Td>{toDisplayData(component.avgCleanTime * 1000)}</Table.Td>
                  <Table.Td>{component.participants}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Box>
      )}
    </Paper>
  );
}
