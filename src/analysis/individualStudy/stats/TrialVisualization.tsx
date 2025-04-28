import {
  Flex, Text,
} from '@mantine/core';
import { useMemo } from 'react';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { studyComponentToIndividualComponent } from '../../../utils/handleComponentInheritance';
import { ResponseVisualization } from './ResponseVisualization';

export function TrialVisualization({
  participantData, studyConfig, trialId,
}: {
  participantData: ParticipantData[]; studyConfig: StudyConfig, trialId?: string;
}) {
  const trialConfig = trialId && trialId !== 'end' && studyComponentToIndividualComponent(studyConfig.components[trialId], studyConfig);

  const items = useMemo(() => [
    { id: 'Config and Timing', type: 'metadata' } as { id: 'Config and Timing', type: 'metadata'},
    ...(trialConfig ? trialConfig.response : []),
  ], [trialConfig]);

  return trialConfig ? (
    <Flex w="100%" direction="column" gap="xs">
      {items.map((c) => (
        <ResponseVisualization
          key={c.id}
          response={c}
          participantData={participantData}
          trialId={trialId}
          trialConfig={trialConfig}
        />
      ))}
    </Flex>
  )
    : (
      <Flex justify="center" align="center" pt="lg" pb="md" w="100%">
        <Text>{trialId !== 'end' ? 'No trial selected' : 'The end component has no data.'}</Text>
      </Flex>
    );
}
