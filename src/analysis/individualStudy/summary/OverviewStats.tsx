import {
  Flex, Paper, Text, Title,
} from '@mantine/core';
import { ParticipantData } from '../../../storage/types';
import { getCleanedDuration } from '../../../utils/getCleanedDuration';

function calculateParticipantCounts(visibleParticipants: ParticipantData[]): { total: number; completed: number; inProgress: number; rejected: number } {
  return {
    total: visibleParticipants.length,
    completed: visibleParticipants.filter((p) => p.completed).length,
    inProgress: visibleParticipants.filter((p) => !p.completed && !p.rejected).length,
    rejected: visibleParticipants.filter((p) => p.rejected).length,
  };
}

function calculateTimeStats(visibleParticipants: ParticipantData[]): { avgTime: number; avgCleanTime: number } {
  const time = visibleParticipants.reduce((acc, participant) => {
    const timeStats = Object.values(participant.answers)
      .filter((answer) => answer.endTime !== -1)
      .map((answer) => ({
        totalTime: (answer.endTime - answer.startTime) / 1000,
        cleanTime: getCleanedDuration(answer as never) || 0,
      }));
    if (timeStats.length > 0) {
      acc.count += timeStats.length;
      acc.totalTimeSum += timeStats.reduce((sum, t) => sum + t.totalTime, 0);
      acc.cleanTimeSum += timeStats.reduce((sum, t) => sum + t.cleanTime, 0);
    }
    return acc;
  }, { totalTimeSum: 0, cleanTimeSum: 0, count: 0 });

  return {
    avgTime: time.count > 0 ? time.totalTimeSum / time.count : NaN,
    avgCleanTime: time.count > 0 ? time.cleanTimeSum / time.count : NaN,
  };
}

function calculateDateStats(visibleParticipants: ParticipantData[]): { startDate: Date | null; endDate: Date | null } {
  const dates = visibleParticipants.map((participant) => {
    const answers = Object.values(participant.answers)
      .filter((data) => data.startTime)
      .sort((a, b) => a.startTime - b.startTime);
    return {
      startTime: answers.length > 0 ? answers[0].startTime : undefined,
      endTime: answers.length > 0 ? answers[answers.length - 1].endTime : undefined,
    };
  });
  const startTimes = dates.map((d) => d.startTime).filter((t): t is number => t != null);
  const endTimes = dates.map((d) => d.endTime).filter((t): t is number => t != null);
  return {
    startDate: startTimes.length > 0 ? new Date(Math.min(...startTimes)) : null,
    endDate: endTimes.length > 0 ? new Date(Math.max(...endTimes)) : null,
  };
}

function calculateCorrectnessStats(visibleParticipants: ParticipantData[]): { avgCorrectness: number } {
  const correctness = visibleParticipants.reduce((acc, participant) => {
    const answers = Object.values(participant.answers)
      .filter((answer) => answer.correctAnswer?.length > 0);

    if (answers.length > 0) {
      const correctCount = answers.filter((answer) => {
        const isCorrect = answer.correctAnswer.every((correctAnswer) => {
          const participantAnswer = answer.answer[correctAnswer.id];
          return correctAnswer.answer === participantAnswer;
        });
        return isCorrect;
      }).length;

      acc.correctSum += correctCount;
      acc.totalSum += answers.length;
    }
    return acc;
  }, { correctSum: 0, totalSum: 0 });

  return {
    avgCorrectness: correctness.totalSum > 0 ? (correctness.correctSum / correctness.totalSum) * 100 : NaN,
  };
}

export function OverviewStats({ visibleParticipants }: { visibleParticipants: ParticipantData[] }) {
  const participantCounts = calculateParticipantCounts(visibleParticipants);
  const { avgTime, avgCleanTime } = calculateTimeStats(visibleParticipants);
  const { startDate, endDate } = calculateDateStats(visibleParticipants);
  const correctnessStats = calculateCorrectnessStats(visibleParticipants);

  return (
    <Paper shadow="sm" p="md" withBorder>
      <Title order={4} mb="md">Overview Statistics</Title>
      {visibleParticipants.length === 0 ? (
        <Flex justify="center" align="center" pt="lg" pb="md">
          <Text>No data available</Text>
        </Flex>
      ) : (
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
            <Text size="xl" fw="bold">{startDate?.toLocaleDateString() || 'N/A'}</Text>
            <Text size="sm" c="dimmed">Start Date</Text>
          </div>
          <div>
            <Text size="xl" fw="bold">{endDate?.toLocaleDateString() || 'N/A'}</Text>
            <Text size="sm" c="dimmed">End Date</Text>
          </div>
          <div>
            <Text size="xl" fw="bold">
              {Number.isFinite(avgTime) ? `${(avgTime).toFixed(1)} s` : 'N/A'}
            </Text>
            <Text size="sm" c="dimmed">Average Time</Text>
          </div>
          <div>
            <Text size="xl" fw="bold">
              {Number.isFinite(avgCleanTime) ? `${(avgCleanTime / 1000).toFixed(1)} s` : 'N/A'}
            </Text>
            <Text size="sm" c="dimmed">Average Clean Time</Text>
          </div>
          <div>
            <Text size="xl" fw="bold">
              {!Number.isNaN(correctnessStats.avgCorrectness) ? `${correctnessStats.avgCorrectness.toFixed(1)}%` : 'N/A'}
            </Text>
            <Text size="sm" c="dimmed">Correctness</Text>
          </div>
        </Flex>
      )}
    </Paper>
  );
}
