import {
  Paper, Table, Title, Text,
} from '@mantine/core';
import { ParticipantData } from '../../../storage/types';
import { Response, StudyConfig } from '../../../parser/types';
import { studyComponentToIndividualComponent } from '../../../utils/handleComponentInheritance';

interface ResponseStatsProps {
  participantData: ParticipantData[];
  studyConfig: StudyConfig;
}

interface TaskStats {
  name: string;
  correctness: number;
  attempts: number;
  responseCorrectness: Record<string, { correct: number; total: number }>;
}

function getResponseOptions(response: Response): string {
  if ('options' in response) {
    return JSON.stringify(response.options);
  }
  if ('answerOptions' in response && 'questionOptions' in response) {
    return `Answers: ${JSON.stringify(response.answerOptions)}\nQuestions: ${JSON.stringify(response.questionOptions)}`;
  }
  if ('numItems' in response) {
    return `${response.numItems} items${response.leftLabel ? ` (${response.leftLabel} - ${response.rightLabel})` : ''}`;
  }
  return 'N/A';
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
          correctness: 0,
          attempts: 0,
          responseCorrectness: {},
        };
      }

      if (answer.endTime !== -1) {
        stats[displayName].attempts += 1;

        if (answer.correctAnswer?.length > 0) {
          answer.correctAnswer.forEach((ca) => {
            if (!stats[displayName].responseCorrectness[ca.id]) {
              stats[displayName].responseCorrectness[ca.id] = { correct: 0, total: 0 };
            }
            stats[displayName].responseCorrectness[ca.id].total += 1;

            const participantAnswer = answer.answer[ca.id];
            if (participantAnswer !== undefined && JSON.stringify(ca.answer) === JSON.stringify(participantAnswer)) {
              stats[displayName].correctness += 1;
              stats[displayName].responseCorrectness[ca.id].correct += 1;
            }
          });
        }
      }
    });
  });

  // Calculate averages
  Object.values(stats).forEach((stat) => {
    if (stat.attempts > 0) {
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

export function ResponseStats({ participantData, studyConfig }: ResponseStatsProps) {
  const taskStats = calculateTaskStats(participantData);

  return (
    <Paper withBorder p="md" radius="md">
      <Title order={4} mb="md">Response Statistics</Title>
      {participantData.length === 0 ? (
        <Text ta="center" py="lg">No data available</Text>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Component</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Prompt</Table.Th>
              <Table.Th>Options</Table.Th>
              <Table.Th>Correctness</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {taskStats.map((stat) => {
              try {
                const [componentName] = stat.name.split('_');
                const componentConfig = studyConfig.components[componentName];
                if (!componentConfig) {
                  return (
                    <Table.Tr key={stat.name}>
                      <Table.Td>{stat.name}</Table.Td>
                      <Table.Td>N/A</Table.Td>
                      <Table.Td>N/A</Table.Td>
                      <Table.Td>N/A</Table.Td>
                      <Table.Td>{stat.attempts > 0 ? `${stat.correctness.toFixed(1)}%` : 'N/A'}</Table.Td>
                    </Table.Tr>
                  );
                }
                const resolvedComponent = studyComponentToIndividualComponent(componentConfig, studyConfig);
                const responses = resolvedComponent.response || [];

                return responses.map((response, index) => {
                  const responseStats = stat.responseCorrectness[response.id] || { correct: 0, total: 0 };
                  const responseCorrectness = responseStats.total > 0
                    ? (responseStats.correct / responseStats.total) * 100
                    : 0;

                  return (
                    <Table.Tr key={`${stat.name}_${index}`}>
                      <Table.Td>{index === 0 ? stat.name : ''}</Table.Td>
                      <Table.Td>{response.type || 'N/A'}</Table.Td>
                      <Table.Td>
                        <Text size="xs" style={{ whiteSpace: 'pre-wrap' }}>
                          {response.prompt || 'N/A'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" style={{ whiteSpace: 'pre-wrap' }}>
                          {getResponseOptions(response)}
                        </Text>
                      </Table.Td>
                      <Table.Td>{responseStats.total > 0 ? `${responseCorrectness.toFixed(1)}%` : 'N/A'}</Table.Td>
                    </Table.Tr>
                  );
                });
              } catch (error) {
                console.error('Error rendering component stats:', error);
                return (
                  <Table.Tr key={stat.name}>
                    <Table.Td>{stat.name}</Table.Td>
                    <Table.Td>Error</Table.Td>
                    <Table.Td>Error</Table.Td>
                    <Table.Td>Error</Table.Td>
                    <Table.Td>{stat.attempts > 0 ? `${stat.correctness.toFixed(1)}%` : 'N/A'}</Table.Td>
                  </Table.Tr>
                );
              }
            })}
          </Table.Tbody>
        </Table>
      )}
    </Paper>
  );
}
