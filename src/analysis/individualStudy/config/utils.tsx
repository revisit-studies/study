import { JSX } from 'react';
import { Text } from '@mantine/core';
import { StudyConfig } from '../../../parser/types';

export interface ConfigInfo {
  version: string;
  hash: string;
  date: string;
  timeFrame: string;
  participantCount: number;
  config: StudyConfig;
}

export function formatDate(date: Date): string | JSX.Element {
  if (date.valueOf() === 0 || Number.isNaN(date.valueOf())) {
    return <Text size="sm" c="dimmed">None</Text>;
  }

  return date.toLocaleDateString([], { hour: '2-digit', minute: '2-digit' });
}

export function buildConfigRows(
  fetchedConfigs: Record<string, StudyConfig>,
  visibleParticipants: { participantConfigHash: string; answers: Record<string, { startTime: number; endTime: number }>; rejected: { reason: string; timestamp: number } | false; createdTime?: number }[],
): ConfigInfo[] {
  return Object.entries(fetchedConfigs).map(([hash, config]) => {
    const filteredParticipants = visibleParticipants.filter((participant) => participant.participantConfigHash === hash);
    const storedAnswers = filteredParticipants.flatMap((p) => Object.values(p.answers));

    const startTime = storedAnswers.map((answer: { startTime: number; endTime: number }) => answer.startTime).filter((t): t is number => t !== undefined && t > 0);
    const endTime = storedAnswers.map((answer: { startTime: number; endTime: number }) => answer.endTime).filter((t): t is number => t !== undefined && t > 0);
    const createdTimestamps = filteredParticipants.map((p) => p.createdTime).filter((t): t is number => t !== undefined && t > 0);

    const earliestStartTime = startTime.length > 0 ? Math.min(...startTime) : null;
    const latestEndTime = endTime.length > 0 ? Math.max(...endTime) : null;
    const earliestCreatedTime = createdTimestamps.length > 0 ? Math.min(...createdTimestamps) : null;

    const formatTimeFrame = (timestamp: number) => {
      const formatted = formatDate(new Date(timestamp));
      return typeof formatted === 'string' ? formatted : 'N/A';
    };

    const getTimeFrame = (): string => {
      const startTimeToUse = earliestStartTime || earliestCreatedTime;
      if (!startTimeToUse) return 'N/A';

      const endTimeStr = latestEndTime ? formatTimeFrame(latestEndTime) : 'N/A';
      return `${formatTimeFrame(startTimeToUse)} - ${endTimeStr}`;
    };

    return {
      version: config.studyMetadata.version,
      hash,
      date: config.studyMetadata.date,
      timeFrame: getTimeFrame(),
      participantCount: filteredParticipants.length,
      config,
    };
  });
}
