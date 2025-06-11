import { Stack, Group } from '@mantine/core';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { OverviewStats } from './OverviewStats';
import { ComponentStats } from './ComponentStats';
import { ResponseStats } from './ResponseStats';

interface StudyStatsProps {
  visibleParticipants: ParticipantData[];
  studyConfig?: StudyConfig;
}

export function SummaryView({ visibleParticipants, studyConfig }: StudyStatsProps) {
  return (
    <Stack gap="md">
      <OverviewStats visibleParticipants={visibleParticipants} />
      {studyConfig && (
        <Group align="flex-start" gap="md" grow>
          <ComponentStats visibleParticipants={visibleParticipants} />
          <ResponseStats participantData={visibleParticipants} studyConfig={studyConfig} />
        </Group>
      )}
    </Stack>
  );
}
