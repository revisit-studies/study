import {
  Box, Divider, Flex, Paper, Text,
} from '@mantine/core';
import { useMemo } from 'react';
import { useParams } from 'react-router';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { TrialVisualization } from './TrialVisualization';
import { StepsPanel } from '../../../components/interface/StepsPanel';
import { OverviewStats } from '../summary/OverviewStats';
import { getOverviewStats } from '../summary/utils';

export function StatsView(
  {
    studyConfig,
    visibleParticipants,
  }: {
    studyConfig: StudyConfig;
    visibleParticipants: ParticipantData[];
  },
) {
  const { trialId } = useParams();

  const overviewData = useMemo(
    () => (trialId && trialId !== 'end' ? getOverviewStats(visibleParticipants, trialId) : null),
    [visibleParticipants, trialId],
  );

  return (
    <>
      {overviewData && (
        <OverviewStats overviewData={overviewData} />
      )}
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
                <StepsPanel participantAnswers={{}} studyConfig={studyConfig} isAnalysis />
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
