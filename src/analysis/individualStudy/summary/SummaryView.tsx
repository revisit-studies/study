import { Stack, Group } from '@mantine/core';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { OverviewStats } from './OverviewStats';
import { ComponentStats } from './ComponentStats';
import { ResponseStats } from './ResponseStats';

export function SummaryView({
  visibleParticipants,
  studyConfig,
}: {
  visibleParticipants: ParticipantData[];
  studyConfig: StudyConfig;
}) {
  return (
    <Stack gap="md">
      <OverviewStats visibleParticipants={visibleParticipants} />
      <Group align="flex-start" gap="md" grow>
        <ComponentStats visibleParticipants={visibleParticipants} />
        <ResponseStats visibleParticipants={visibleParticipants} studyConfig={studyConfig} />
      </Group>
    </Stack>
  );
}
