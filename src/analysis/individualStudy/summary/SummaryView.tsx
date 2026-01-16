import { Stack, Group } from '@mantine/core';
import { useMemo } from 'react';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { OverviewStats } from './OverviewStats';
import { ComponentStats } from './ComponentStats';
import { ResponseStats } from './ResponseStats';
import { getOverviewStats } from './utils';

export function SummaryView({
  visibleParticipants,
  studyConfig,
}: {
  visibleParticipants: ParticipantData[];
  studyConfig: StudyConfig;
}) {
  const overviewData = useMemo(() => getOverviewStats(visibleParticipants), [visibleParticipants]);

  return (
    <Stack gap="md">
      <OverviewStats overviewData={overviewData} />
      <Group align="flex-start" gap="md" grow>
        <ComponentStats visibleParticipants={visibleParticipants} studyConfig={studyConfig} />
        <ResponseStats visibleParticipants={visibleParticipants} studyConfig={studyConfig} />
      </Group>
    </Stack>
  );
}
