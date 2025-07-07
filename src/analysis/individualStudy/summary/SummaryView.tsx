import { Stack, Group } from '@mantine/core';
import { useMemo, useEffect } from 'react';
import { useParams } from 'react-router';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { useOverviewData } from '../../../store/hooks/useOverviewData';
import { OverviewStats } from './OverviewStats';
import { ComponentStats } from './ComponentStats';
import { ResponseStats } from './ResponseStats';
import {
  calculateParticipantCounts, calculateCorrectnessStats, calculateTimeStats, calculateDateStats, calculateComponentStats,
  calculateResponseStats, getResponseOptions,
} from './utils';
import { studyComponentToIndividualComponent } from '../../../utils/handleComponentInheritance';
import { OverviewData, ResponseData } from './types';

interface StudyStatsProps {
  visibleParticipants: ParticipantData[];
  studyConfig?: StudyConfig;
}

export function SummaryView({ visibleParticipants, studyConfig }: StudyStatsProps) {
  const { studyId } = useParams();
  const { saveOverviewData } = useOverviewData();

  const overviewData: OverviewData | null = useMemo(() => {
    if (visibleParticipants.length === 0) return null;

    const participantCounts = calculateParticipantCounts(visibleParticipants);
    const { avgTime, avgCleanTime } = calculateTimeStats(visibleParticipants);
    const { startDate, endDate } = calculateDateStats(visibleParticipants);
    const correctnessStats = calculateCorrectnessStats(visibleParticipants);

    // Calculate component data
    const componentStats = calculateComponentStats(visibleParticipants);
    const componentData = componentStats.map((stat) => ({
      component: stat.name,
      participants: stat.participantCount,
      avgTime: Number.isFinite(stat.avgTime) ? `${stat.avgTime.toFixed(1)}s` : 'N/A',
      avgCleanTime: Number.isFinite(stat.avgCleanTime) ? `${stat.avgCleanTime.toFixed(1)}s` : 'N/A',
      correctness: !Number.isNaN(stat.correctness) ? `${stat.correctness.toFixed(1)}%` : 'N/A',
    }));

    // Calculate response data
    const responseData = studyConfig ? (() => {
      const taskStats = calculateResponseStats(visibleParticipants);
      const data: ResponseData[] = [];

      taskStats.forEach((stat) => {
        const component = studyConfig.components[stat.name];
        if (!component) return;

        const responses = studyComponentToIndividualComponent(component, studyConfig).response;
        if (responses.length === 0) return;

        responses.forEach((response) => {
          const correctnessStr = !Number.isNaN(stat.correctness) ? `${stat.correctness.toFixed(1)}%` : 'N/A';
          data.push({
            component: stat.name,
            type: response.type,
            question: response.prompt,
            options: getResponseOptions(response),
            correctness: correctnessStr,
          });
        });
      });

      return data;
    })() : [];

    return {
      participantCounts,
      avgTime,
      avgCleanTime,
      startDate,
      endDate,
      correctnessStats,
      responseData,
      componentData,
    };
  }, [visibleParticipants, studyConfig]);

  useEffect(() => {
    if (overviewData) {
      saveOverviewData(overviewData);
    }
  }, [overviewData, saveOverviewData]);

  if (!studyId) return null;

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
