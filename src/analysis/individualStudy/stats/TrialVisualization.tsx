import {
  Flex, Stack, Text,
} from '@mantine/core';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { studyComponentToIndividualComponent } from '../../../utils/handleComponentInheritance';

export default function TrialVisualization({
  participantData, studyConfig, responseIds, trialId,
}: {
  participantData: ParticipantData[]; studyConfig: StudyConfig; responseIds: string[], trialId?: string;
}) {
  const trialConfig = trialId && studyComponentToIndividualComponent(studyConfig.components[trialId], studyConfig);

  return trialId ? (
    <Flex w="100%">
      <Stack align="flex-start" p={5}>
        {trialId}
        {responseIds}
        {JSON.stringify(trialConfig)}
      </Stack>
    </Flex>
  )
    : (
      <Flex justify="center" align="center" pt="lg" pb="md" w="100%">
        <Text>No trial selected</Text>
      </Flex>
    );
}
