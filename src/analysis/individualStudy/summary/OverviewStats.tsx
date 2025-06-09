import {
  Flex, Paper, Text, Title,
} from '@mantine/core';
import { ParticipantData } from '../../../storage/types';

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
      <Title order={4} mb="md">Overview Stats</Title>
      <Flex justify="space-between" m="xs">
        <div>
          <Text size="xl" fw="bold">{participantCounts.total}</Text>
          <Text size="sm" c="dimmed">Total Participants</Text>
        </div>
        <div>
          <Text size="xl" fw="bold" c="green">{participantCounts.completed}</Text>
          <Text size="sm" c="dimmed">Completed</Text>
        </div>
        <div>
          <Text size="xl" fw="bold" c="yellow">{participantCounts.inProgress}</Text>
          <Text size="sm" c="dimmed">In Progress</Text>
        </div>
        <div>
          <Text size="xl" fw="bold" c="red">{participantCounts.rejected}</Text>
          <Text size="sm" c="dimmed">Rejected</Text>
        </div>
        <div>
          <Text size="xl" fw="bold">{startTime?.toLocaleDateString() || 'N/A'}</Text>
          <Text size="sm" c="dimmed">Start Date</Text>
        </div>
        <div>
          <Text size="xl" fw="bold">
            {participantCounts.inProgress > 0 ? 'N/A' : endTime?.toLocaleDateString() || 'N/A'}
          </Text>
          <Text size="sm" c="dimmed">End Date</Text>
        </div>
        <div>
          <Text size="xl" fw="bold">
            {(timeStats.avgTime / 1000).toFixed(1)}
            s
          </Text>
          <Text size="sm" c="dimmed">Average Time</Text>
        </div>
        <div>
          <Text size="xl" fw="bold">
            {(timeStats.avgCleanTime / 1000).toFixed(1)}
            s
          </Text>
          <Text size="sm" c="dimmed">Average Clean Time</Text>
        </div>
        <div>
          <Text size="xl" fw="bold">
            {correctnessStats.avgCorrectness.toFixed(1)}
            %
          </Text>
          <Text size="sm" c="dimmed">Correctness</Text>
        </div>
      </Flex>
    </Paper>
  );
}
