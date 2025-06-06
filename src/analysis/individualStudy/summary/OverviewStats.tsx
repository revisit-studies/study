import {
  Flex, Paper, Text, Group, Stack,
} from '@mantine/core';
import { ParticipantData } from '../../../storage/types';

// Number of participants
// Number of completed participants
// Number of in progress participants
// Number of rejected participants
// interface ParticipantCounts {
//   total: number;
//   completed: number;
//   rejected: number;
//   inProgress: number;
// }

// Time frame (Start and end date or time)

// Average time
// Average clean time
interface TimeStats {
  avgTime: number;
  avgCleanTime: number;
}

interface CorrectnessStats {
  avgCorrectness: number;
}

function calculateTimeStats(participants: ParticipantData[]): TimeStats {
  const stats = participants.reduce((acc, participant) => {
    const times = Object.values(participant.answers)
      .filter((answer) => answer.endTime !== -1)
      .map((answer) => ({
        totalTime: answer.endTime - answer.startTime,
        cleanTime: Math.max(0, answer.endTime - answer.startTime - (answer.windowEvents || []).length * 100),
      }));

    if (times.length > 0) {
      acc.totalTimeSum += times.reduce((sum, t) => sum + t.totalTime, 0);
      acc.cleanTimeSum += times.reduce((sum, t) => sum + t.cleanTime, 0);
      acc.count += times.length;
    }
    return acc;
  }, { totalTimeSum: 0, cleanTimeSum: 0, count: 0 });

  return {
    avgTime: stats.count > 0 ? stats.totalTimeSum / stats.count : 0,
    avgCleanTime: stats.count > 0 ? stats.cleanTimeSum / stats.count : 0,
  };
}

function calculateCorrectnessStats(participants: ParticipantData[]): CorrectnessStats {
  const stats = participants.reduce((acc, participant) => {
    const answers = Object.values(participant.answers)
      .filter((answer) => answer.correctAnswer && answer.correctAnswer.length > 0);

    if (answers.length > 0) {
      const correctCount = answers.filter((answer) => answer.correctAnswer.some((ca) => JSON.stringify(ca.answer) === JSON.stringify(answer.answer[ca.id]))).length;
      acc.correctSum += correctCount;
      acc.totalSum += answers.length;
    }
    return acc;
  }, { correctSum: 0, totalSum: 0 });

  return {
    avgCorrectness: stats.totalSum > 0 ? (stats.correctSum / stats.totalSum) * 100 : 0,
  };
}

function calculateStudyTimes(participants: ParticipantData[]): { startTime: Date | null; endTime: Date | null } {
  const studyTimes = participants.reduce((acc, participant) => {
    Object.values(participant.answers).forEach((answer) => {
      if (answer.startTime > 0) acc.startTimes.push(answer.startTime);
      if (answer.endTime > 0) acc.endTimes.push(answer.endTime);
    });
    return acc;
  }, { startTimes: [] as number[], endTimes: [] as number[] });

  return {
    startTime: studyTimes.startTimes.length > 0 ? new Date(Math.min(...studyTimes.startTimes)) : null,
    endTime: studyTimes.endTimes.length > 0 ? new Date(Math.max(...studyTimes.endTimes)) : null,
  };
}

// Average correctness
export function OverviewStats({ visibleParticipants }: { visibleParticipants: ParticipantData[] }) {
  const participantCounts = {
    total: visibleParticipants.length,
    completed: visibleParticipants.filter((p) => p.completed).length,
    inProgress: visibleParticipants.filter((p) => !p.completed && !p.rejected).length,
    rejected: visibleParticipants.filter((p) => p.rejected).length,
  };

  const timeStats = calculateTimeStats(visibleParticipants);
  const correctnessStats = calculateCorrectnessStats(visibleParticipants);
  const { startTime, endTime } = calculateStudyTimes(visibleParticipants);

  return (
    <Paper shadow="sm" p="md" withBorder>
      <Stack gap="md">
        <Text fw="bold">Overview Stats</Text>

        <Flex gap="xl" wrap="wrap">
          <Group gap="xl">
            <div>
              <Text size="xl" fw={700}>{participantCounts.total}</Text>
              <Text size="xs" c="dimmed">Total Participants</Text>
            </div>
            <Stack gap={4}>
              <Group gap="xs" wrap="nowrap">
                <Text size="sm" fw={500} c="green.6" w={30} ta="right">{participantCounts.completed}</Text>
                <Text size="xs" c="dimmed">Completed</Text>
              </Group>
              <Group gap="xs" wrap="nowrap">
                <Text size="sm" fw={500} c="yellow.6" w={30} ta="right">{participantCounts.inProgress}</Text>
                <Text size="xs" c="dimmed">In Progress</Text>
              </Group>
              <Group gap="xs" wrap="nowrap">
                <Text size="sm" fw={500} c="red.6" w={30} ta="right">{participantCounts.rejected}</Text>
                <Text size="xs" c="dimmed">Rejected</Text>
              </Group>
            </Stack>
          </Group>

          <Group gap="xl">
            <div>
              <Text size="xl" fw={700}>{startTime?.toLocaleDateString() || 'N/A'}</Text>
              <Text size="xs" c="dimmed">Start Date</Text>
            </div>
            <div>
              <Text size="xl" fw={700}>
                {participantCounts.inProgress > 0 ? 'N/A' : endTime?.toLocaleDateString() || 'N/A'}
              </Text>
              <Text size="xs" c="dimmed">End Date</Text>
            </div>
          </Group>
        </Flex>

        <Flex gap="xl" wrap="wrap">
          <div>
            <Text size="xl" fw={700}>
              {(timeStats.avgTime / 1000).toFixed(1)}
              s
            </Text>
            <Text size="xs" c="dimmed">Average Time</Text>
          </div>
          <div>
            <Text size="xl" fw={700}>
              {(timeStats.avgCleanTime / 1000).toFixed(1)}
              s
            </Text>
            <Text size="xs" c="dimmed">Average Clean Time</Text>
          </div>
          <div>
            <Text size="xl" fw={700}>
              {correctnessStats.avgCorrectness.toFixed(1)}
              %
            </Text>
            <Text size="xs" c="dimmed">Correctness</Text>
          </div>
        </Flex>
      </Stack>
    </Paper>
  );
}
