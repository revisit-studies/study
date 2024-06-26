import {
  Flex, Stack, Text,
} from '@mantine/core';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';

export default function TrialVisualization({ participantData, studyConfig, trialId }: { participantData: ParticipantData[]; studyConfig: StudyConfig; trialId?: string; }) {
  return trialId ? (
    <Flex w="100%">
      <Stack align="flex-start" p={5}>
        {trialId}
      </Stack>
    </Flex>
  )
    : (
      <Flex justify="center" align="center" pt="lg" pb="md" w="100%">
        <Text>No trial selected</Text>
      </Flex>
    );
}
