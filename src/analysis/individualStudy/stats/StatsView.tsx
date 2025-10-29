import {
  Box, Divider, Flex, Paper, Text,
} from '@mantine/core';
import {
  useMemo,
} from 'react';
import { useParams } from 'react-router';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { TrialVisualization } from './TrialVisualization';
import { ComponentBlockWithOrderPath, StepsPanel } from '../../../components/interface/StepsPanel';
import { addPathToComponentBlock } from '../../../utils/getSequenceFlatMap';
import { OverviewStats } from './OverviewStats';
import {
  calculateParticipantCounts, calculateCorrectnessStats, calculateTimeStats, calculateDateStats, calculateComponentStats,
} from '../summary/utils';

export function StatsView(
  {
    studyConfig,
    visibleParticipants,
  }: {
    studyConfig: StudyConfig;
    visibleParticipants: ParticipantData[];
  },
) {
  const fullOrder = useMemo(() => {
    let r = structuredClone(studyConfig.sequence) as ComponentBlockWithOrderPath;
    r = addPathToComponentBlock(r, 'root') as ComponentBlockWithOrderPath;
    r.components.push('end');
    return r;
  }, [studyConfig.sequence]);

  const { trialId } = useParams();

  const filteredParticipants = useMemo(() => {
    if (!trialId) return visibleParticipants;

    return visibleParticipants
      .map((p) => {
        const filteredAnswers = Object.fromEntries(
          Object.entries(p.answers).filter(([_, answer]) => answer.componentName === trialId),
        );
        return { ...p, answers: filteredAnswers } as ParticipantData;
      })
      .filter((p) => Object.keys(p.answers).length > 0);
  }, [visibleParticipants, trialId]);

  const overviewData = useMemo(() => {
    if (!trialId) {
      const participantCounts = calculateParticipantCounts(visibleParticipants);
      const { avgTime, avgCleanTime } = calculateTimeStats(visibleParticipants);
      const { startDate, endDate } = calculateDateStats(visibleParticipants);
      const correctnessStats = calculateCorrectnessStats(visibleParticipants);
      const componentStats = calculateComponentStats(visibleParticipants);
      const componentData = componentStats.map((stat) => ({
        component: stat.name,
        participants: stat.participantCount,
        avgTime: Number.isFinite(stat.avgTime) ? `${stat.avgTime.toFixed(1)}s` : 'N/A',
        avgCleanTime: Number.isFinite(stat.avgCleanTime) ? `${stat.avgCleanTime.toFixed(1)}s` : 'N/A',
        correctness: !Number.isNaN(stat.correctness) ? `${stat.correctness.toFixed(1)}%` : 'N/A',
      }));
      return {
        participantCounts, avgTime, avgCleanTime, startDate, endDate, correctnessStats, componentData, responseData: [],
      };
    }

    if (filteredParticipants.length === 0) return null;

    const participantCounts = calculateParticipantCounts(filteredParticipants);
    const { avgTime, avgCleanTime } = calculateTimeStats(filteredParticipants);
    const { startDate, endDate } = calculateDateStats(filteredParticipants);
    const correctnessStats = calculateCorrectnessStats(filteredParticipants);

    const componentStats = calculateComponentStats(filteredParticipants);
    const componentData = componentStats.map((stat) => ({
      component: stat.name,
      participants: stat.participantCount,
      avgTime: Number.isFinite(stat.avgTime) ? `${stat.avgTime.toFixed(1)}s` : 'N/A',
      avgCleanTime: Number.isFinite(stat.avgCleanTime) ? `${stat.avgCleanTime.toFixed(1)}s` : 'N/A',
      correctness: !Number.isNaN(stat.correctness) ? `${stat.correctness.toFixed(1)}%` : 'N/A',
    }));

    return {
      participantCounts, avgTime, avgCleanTime, startDate, endDate, correctnessStats, componentData, responseData: [],
    };
  }, [filteredParticipants, trialId, visibleParticipants]);

  return (
    <>
      <OverviewStats overviewData={overviewData} mismatchDetails={null} />
      <Paper shadow="sm" p="md" mt="md" withBorder>
        {
        (visibleParticipants.length === 0)
          ? (
            <Flex justify="center" align="center" pt="lg" pb="md">
              <Text>No data available.</Text>
            </Flex>
          )
          : (
            <Flex direction="row">
              {/* Trial selection sidebar */}
              <Box w={340}>
                <StepsPanel configSequence={fullOrder} participantSequence={fullOrder} fullSequence={fullOrder} participantView={false} studyConfig={studyConfig} analysisNavigation />
              </Box>

              <Divider orientation="vertical" mx="md" />

              {/* Visualization and metadata */}
              <TrialVisualization participantData={visibleParticipants} studyConfig={studyConfig} trialId={trialId} />
            </Flex>
          )
      }
      </Paper>
    </>
  );
}
