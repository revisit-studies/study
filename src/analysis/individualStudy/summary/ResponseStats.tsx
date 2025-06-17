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
  // Filter out rejected participants
  const validParticipants = visibleParticipants.filter((p) => !p.rejected);

  const stats: Record<string, TaskStats> = {};

  validParticipants.forEach((participant) => {
    Object.entries(participant.answers).forEach(([taskId, answer]) => {
      // For dynamic blocks: blockId_stepNumber_componentName_index
      // For regular components: componentName_index
      const parts = taskId.split('_');
      const component = parts.length === 4 ? parts[2] : parts[0];

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
      // Check if any participant has correct answers defined for this component
      const hasCorrectAnswers = Object.values(validParticipants).some((participant) => Object.entries(participant.answers).some(([key, answer]) => {
        const parts = key.split('_');
        const component = parts.length === 4 ? parts[2] : parts[0];
        return component === stat.name && answer.correctAnswer && answer.correctAnswer.length > 0;
      }));
      return {
        ...stat,
        correctness: hasCorrectAnswers ? (stat.correctness / stat.participantCount) * 100 : NaN,
      };
    });
}

export function ResponseStats({ visibleParticipants, studyConfig }: { visibleParticipants: ParticipantData[]; studyConfig: StudyConfig }) {
  const stats = calculateTaskStats(visibleParticipants);

  // Check if any component has responses
  const hasResponses = stats.some((stat) => {
    const component = studyConfig.components[stat.name];
    if (!component) return false;
    const responses = studyComponentToIndividualComponent(component, studyConfig).response;
    return responses.length > 0;
  });

  return (
    <Paper shadow="sm" p="md" withBorder>
      <Title order={4} mb="md">Response Statistics</Title>
      {visibleParticipants.length === 0 || stats.length === 0 || !hasResponses ? (
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
                // Filter out components that have no responses
                if (!component) return null;
                const responses = studyComponentToIndividualComponent(component, studyConfig).response;
                if (responses.length === 0) return null;

                return responses.map((response) => (
                  <Table.Tr key={`${stat.name}`}>
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
