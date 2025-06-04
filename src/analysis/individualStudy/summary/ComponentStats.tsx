import {
  Flex, Paper, Table, Text, Box, Badge, Group,
} from '@mantine/core';
import { ParticipantData } from '../../../storage/types';

function toDisplayData(milliseconds: number) {
  const minutes = Math.floor(milliseconds / (1000 * 60));
  const seconds = ((milliseconds % (1000 * 60)) / 1000).toFixed(2);
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

interface ComponentStats {
  name: string;
  avgTime: number;
  avgCleanTime: number;
  min: number;
  max: number;
  mean: number;
  mid: number;
  maxUser: string;
  minUser: string;
}

function calculateComponentStats(participantData: ParticipantData[]) {
  const componentStats: ComponentStats[] = [];

  // Group answers by component
  const componentAnswers = new Map<string, ParticipantData['answers']>();

  participantData.forEach((record) => {
    Object.entries(record.answers).forEach(([key, value]) => {
      const componentId = key.split('_')[0];
      if (!componentAnswers.has(componentId)) {
        componentAnswers.set(componentId, {});
      }
      componentAnswers.get(componentId)![key] = value;
    });
  });

  // Calculate stats for each component
  componentAnswers.forEach((answers, componentId) => {
    let max = 0;
    let min = Number.MAX_VALUE;
    let minUser = '';
    let maxUser = '';
    let sum = 0;
    const durationAry: number[] = [];

    Object.entries(answers).forEach(([pid, answer]) => {
      const duration = answer.endTime - answer.startTime;
      if (duration < 0) return;

      sum += duration;
      durationAry.push(duration);
      if (duration > max) {
        max = duration;
        maxUser = pid;
      }
      if (duration < min) {
        min = duration;
        minUser = pid;
      }
    });

    durationAry.sort((a, b) => a - b);
    const mean = sum / durationAry.length;
    const mid = durationAry.length % 2 === 0
      ? (durationAry[durationAry.length / 2] + durationAry[durationAry.length / 2 - 1]) / 2
      : durationAry[Math.floor(durationAry.length / 2)];

    componentStats.push({
      name: componentId,
      avgTime: mean,
      avgCleanTime: mid,
      min,
      max,
      mean,
      mid,
      maxUser,
      minUser,
    });
  });

  return componentStats;
}

export function ComponentStats({ participantData }: { participantData: ParticipantData[]}) {
  const componentStats = calculateComponentStats(participantData);

  return (
    <Paper shadow="sm" p="md" withBorder>
      {(participantData.length === 0) ? (
        <Flex justify="center" align="center" pt="lg" pb="md">
          <Text>No data available</Text>
        </Flex>
      ) : (
        <Box style={{ maxWidth: '100%', overflowX: 'auto' }}>
          <Table mb="md" style={{ width: '100%' }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: '25%' }}>Component</Table.Th>
                <Table.Th style={{ width: '25%' }}>Avg Time</Table.Th>
                <Table.Th style={{ width: '25%' }}>Median Time</Table.Th>
                <Table.Th style={{ width: '25%' }}>Fastest</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {componentStats.map((component) => (
                <Table.Tr key={component.name}>
                  <Table.Td style={{ width: '25%' }}>{component.name}</Table.Td>
                  <Table.Td style={{ width: '25%' }}>{toDisplayData(component.mean)}</Table.Td>
                  <Table.Td style={{ width: '25%' }}>{toDisplayData(component.mid)}</Table.Td>
                  <Table.Td style={{ width: '25%' }}>
                    <Group gap="xs">
                      <Badge radius="xs">{component.minUser}</Badge>
                      <Text size="sm">{toDisplayData(component.min)}</Text>
                    </Group>
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
