import {
  Box, Divider, Flex, Paper, Text,
} from '@mantine/core';
import {
  useMemo,
} from 'react';
import { useParams } from 'react-router-dom';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import TrialVisualization from './TrialVisualization';
import { ComponentBlockWithOrderPath, StepsPanel } from '../../../components/interface/StepsPanel';
import { deepCopy } from '../../../utils/deepCopy';
import { addPathToComponentBlock } from '../../../utils/getSequenceFlatMap';

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
    let r = deepCopy(studyConfig.sequence) as ComponentBlockWithOrderPath;
    r = addPathToComponentBlock(r, 'root') as ComponentBlockWithOrderPath;
    r.components.push('end');
    return r;
  }, [studyConfig.sequence]);

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
                <StepsPanel configSequence={fullOrder} participantSequence={fullOrder} fullSequence={fullOrder} participantView={false} studyConfig={studyConfig} analysisNavigation />
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
