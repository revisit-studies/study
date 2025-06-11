import {
  Paper, Table, Title, Text, Flex,
} from '@mantine/core';
import { ParticipantData } from '../../../storage/types';
import { Response, StudyConfig } from '../../../parser/types';
import { studyComponentToIndividualComponent } from '../../../utils/handleComponentInheritance';

interface TaskStats {
  name: string;
  correctness: number;
  participantCount: number;
}

function getResponseOptions(response: Response): string {
  // Dropdown, Checkbox, Radio, Button, Slider
  if ('options' in response) {
    return JSON.stringify(response.options);
  }
  // Matrix Radio, Matrix Checkbox
  if ('answerOptions' in response && 'questionOptions' in response) {
    return `Questions: ${JSON.stringify(response.questionOptions)} \n Answers: ${JSON.stringify(response.answerOptions)}}`;
  }
  // Likert Scale
  if ('numItems' in response) {
    return `${response.leftLabel ? ` ${response.leftLabel} - ${response.rightLabel}` : ''} (${response.numItems} items)`;
  }
  return 'N/A';
}

function calculateTaskStats(visibleParticipants: ParticipantData[]): TaskStats[] {
  const stats: Record<string, TaskStats> = {};

  visibleParticipants.forEach((participant) => {
    Object.entries(participant.answers).forEach(([taskId, answer]) => {
      const component = `${taskId.split('_')[0]}`;

      if (!stats[component]) {
        stats[component] = {
          name: component,
          correctness: 0,
          participantCount: 0,
        };
      }
      // In progress participants are not included in the stats
      if (answer.endTime === -1) {
        return;
      }
      const stat = stats[component];
      stat.participantCount += 1;

      if (answer.correctAnswer.length > 0) {
        const isCorrect = answer.correctAnswer.every((correctAnswer) => {
          const participantAnswer = answer.answer[correctAnswer.id];
          return correctAnswer.answer === participantAnswer;
        });
        stat.correctness += isCorrect ? 1 : 0;
      }
    });
  });

  return Object.values(stats)
    .map((stat) => ({
      ...stat,
      correctness: stat.participantCount ? (stat.correctness / stat.participantCount) * 100 : 0,
    }));
}

export function ResponseStats({ visibleParticipants, studyConfig }: { visibleParticipants: ParticipantData[]; studyConfig: StudyConfig }) {
  const stats = calculateTaskStats(visibleParticipants);

  return (
    <Paper shadow="sm" p="md" withBorder>
      <Title order={4} mb="md">Response Statistics</Title>
      {visibleParticipants.length === 0 ? (
        <Flex justify="center" align="center" pt="lg" pb="md">
          <Text>No data available</Text>
        </Flex>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Component</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Question</Table.Th>
              <Table.Th>Options</Table.Th>
              <Table.Th>Correctness</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {stats.map((stat) => {
              const component = studyConfig.components[stat.name];
              const responses = studyComponentToIndividualComponent(component, studyConfig).response;

              return responses.map((response) => (
                <Table.Tr key={stat.name}>
                  <Table.Td>{stat.name}</Table.Td>
                  <Table.Td>{response.type}</Table.Td>
                  <Table.Td>{response.prompt}</Table.Td>
                  <Table.Td>{getResponseOptions(response)}</Table.Td>
                  <Table.Td>
                    {Number.isNaN(stat.correctness) ? `${stat.correctness.toFixed(1)}%` : 'N/A'}
                  </Table.Td>
                </Table.Tr>
              ));
            })}
          </Table.Tbody>
        </Table>
      )}
    </Paper>
  );
}
