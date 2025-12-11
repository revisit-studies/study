import { Stack, Group } from '@mantine/core';
import { ParticipantData } from '../../../storage/types';
import { OverviewStats } from './OverviewStats';
import { ComponentStats } from './ComponentStats';
import { ResponseStats } from './ResponseStats';

export function SummaryView({
  visibleParticipants,
}: {
  visibleParticipants: ParticipantData[];
}) {
  return (
    <Stack gap="md">
      <OverviewStats visibleParticipants={visibleParticipants} />
      <Group align="flex-start" gap="md" grow>
        <ComponentStats visibleParticipants={visibleParticipants} />
        <ResponseStats visibleParticipants={visibleParticipants} />
      </Group>
    </Stack>
  );
}
