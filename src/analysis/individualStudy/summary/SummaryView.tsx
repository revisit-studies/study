import { Stack, Group } from '@mantine/core';
import { useMemo } from 'react';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { OverviewStats } from './OverviewStats';
import { ComponentStats } from './ComponentStats';
import { ResponseStats } from './ResponseStats';
import {
  calculateParticipantCounts, calculateCorrectnessStats, calculateTimeStats, calculateDateStats,
} from './utils';
import { OverviewData } from './types';

interface StudyStatsProps {
  visibleParticipants: ParticipantData[];
  studyConfig?: StudyConfig;
}

export function SummaryView({ visibleParticipants, studyConfig }: StudyStatsProps) {
  const overviewData: OverviewData | null = useMemo(() => {
    if (visibleParticipants.length === 0) return null;

    const participantCounts = calculateParticipantCounts(visibleParticipants);
    const { avgTime, avgCleanTime } = calculateTimeStats(visibleParticipants);
    const { startDate, endDate } = calculateDateStats(visibleParticipants);
    const correctnessStats = calculateCorrectnessStats(visibleParticipants);

    return {
      participantCounts,
      avgTime,
      avgCleanTime,
      startDate,
      endDate,
      correctnessStats,
      responseData: [],
      componentData: [],
    };
  }, [visibleParticipants]);

  return (
    <Stack gap="md">
      <OverviewStats overviewData={overviewData} />
      {studyConfig && (
        <Group align="flex-start" gap="md" grow>
          <ComponentStats visibleParticipants={visibleParticipants} />
          <ResponseStats visibleParticipants={visibleParticipants} studyConfig={studyConfig} />
        </Group>
      )}
    </Stack>
  );
}
