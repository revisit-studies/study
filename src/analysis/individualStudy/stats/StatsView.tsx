import {
  Box, Divider, Flex, Paper, Text,
} from '@mantine/core';
import { useParams } from 'react-router';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { TrialVisualization } from './TrialVisualization';
import { StepsPanel } from '../../../components/interface/StepsPanel';

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

  return (
    <Paper shadow="sm" p="md" withBorder>
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
  );
}
