import {
  Box,
  Checkbox, Divider, Flex, Group, MultiSelect, Paper, Text,
} from '@mantine/core';
import {
  useCallback, useMemo, useState,
} from 'react';
import { useParams } from 'react-router-dom';
import { IconChartBar } from '@tabler/icons-react';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import TrialVisualization from './TrialVisualization';
import { ComponentBlockWithOrderPath, StepsPanel } from '../../../components/interface/StepsPanel';
import { deepCopy } from '../../../utils/deepCopy';
import { addPathToComponentBlock } from '../../../utils/getSequenceFlatMap';
import { studyComponentToIndividualComponent } from '../../../utils/handleComponentInheritance';

export function StatsView({
  studyConfig,
  inprogress,
  completed,
  rejected,
}: {
studyConfig: StudyConfig;
completed: ParticipantData[];
inprogress: ParticipantData[];
rejected: ParticipantData[];
}) {
  const [participantsToVisualize, setParticipantsToVisualize] = useState<ParticipantData[]>([...completed]);

  const handleCheckboxChange = useCallback((value: string[]) => {
    const participants = [];
    if (value.includes('completed')) {
      participants.push(...completed);
    }
    if (value.includes('inprogress')) {
      participants.push(...inprogress);
    }
    if (value.includes('rejected')) {
      participants.push(...rejected);
    }
    setParticipantsToVisualize(participants);
  }, [completed, inprogress, rejected]);

  const fullOrder = useMemo(() => {
    let r = deepCopy(studyConfig.sequence) as ComponentBlockWithOrderPath;
    r = addPathToComponentBlock(r, 'root') as ComponentBlockWithOrderPath;
    r.components.push('end');
    return r;
  }, [studyConfig.sequence]);

  const { trialId } = useParams();

  const responseOptions = useMemo(() => {
    if (!trialId) return [];
    const trialConfig = studyConfig.components[trialId];
    if (!trialConfig) return [];
    const componentConfig = studyComponentToIndividualComponent(trialConfig, studyConfig);
    return componentConfig.response.map((r) => r.id);
  }, [studyConfig, trialId]);
  const [selectedResponses, setSelectedResponses] = useState<string[]>([]);

  return (
    <Paper shadow="sm" p="md" withBorder>
      <Flex direction="row" justify="space-between">
        <Checkbox.Group
          defaultValue={['completed']}
          onChange={handleCheckboxChange}
          mb="xs"
          mt={8}
          ml="xs"
        >
          <Group>
            <Checkbox value="completed" label="Completed" />
            <Checkbox value="inprogress" label="In Progress" />
            <Checkbox value="rejected" label="Rejected" />
          </Group>
        </Checkbox.Group>

        <MultiSelect
          data={responseOptions}
          placeholder="Responses to Visualize"
          value={selectedResponses}
          onChange={setSelectedResponses}
          searchable
          nothingFoundMessage="No responses found"
          clearable
          maxValues={2}
          leftSection={<IconChartBar />}
          w={600}
        />
      </Flex>

      <Divider my="xs" />

      {
        (participantsToVisualize.length === 0)
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
              <TrialVisualization participantData={participantsToVisualize} studyConfig={studyConfig} responseIds={selectedResponses} trialId={trialId} />
            </Flex>
          )
      }
    </Paper>
  );
}
