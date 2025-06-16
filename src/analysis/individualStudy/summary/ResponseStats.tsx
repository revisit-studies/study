import {
  Paper, Table, Title, Text, Flex, ScrollArea,
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
  // Slider
  // example: Bad (0), Mid (50), Good (100)
  if (response.type === 'slider') {
    return response.options.map((option) => `${option.label} (${option.value})`).join(', ');
  }
  // Dropdown, Checkbox, Radio, Button
  // example: Option 1, Option 2, Option 3
  if ('options' in response) {
    return response.options.join(', ');
  }
  // Matrix Radio, Matrix Checkbox
  // example: Questions: Question 1, Question 2, Question 3
  // example: Answers: Answer 1, Answer 2, Answer 3
  if ('answerOptions' in response && 'questionOptions' in response) {
    return `Questions: ${response.questionOptions.join(', ')} \n Answers: ${Array.isArray(response.answerOptions) ? response.answerOptions.join(', ') : response.answerOptions}`;
  }
  // Likert Scale
  // example: Dislike ~ Like (9 items)
  if ('numItems' in response) {
    return `${response.leftLabel ? ` ${response.leftLabel} ~ ${response.rightLabel}` : ''} (${response.numItems} items)`;
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
      const hasCorrectAnswers = Object.values(visibleParticipants).some((participant) => Object.values(participant.answers).some((answer) => answer.correctAnswer && answer.correctAnswer.length > 0));
      return {
        ...stat,
        correctness: hasCorrectAnswers ? (stat.correctness / stat.participantCount) * 100 : NaN,
      };
    });
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
        <ScrollArea>
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
                      {!Number.isNaN(stat.correctness) ? `${stat.correctness.toFixed(1)}%` : 'N/A'}
                    </Table.Td>
                  </Table.Tr>
                ));
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}
    </Paper>
  );
}
