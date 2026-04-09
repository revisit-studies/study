import { Stack, Group } from '@mantine/core';
import { useMemo } from 'react';
import { ParticipantDataWithStatus } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { OverviewStats } from './OverviewStats';
import { ComponentStats } from './ComponentStats';
import { ResponseStats } from './ResponseStats';
import { getOverviewStats } from './utils';

export function SummaryView({
  visibleParticipants,
  studyConfig,
  studyId,
}: {
  visibleParticipants: ParticipantDataWithStatus[];
  studyConfig: StudyConfig;
  studyId?: string;
}) {
  const overviewData = useMemo(() => getOverviewStats(visibleParticipants), [visibleParticipants]);

  return (
    <Stack gap="md">
      <OverviewStats overviewData={overviewData} studyId={studyId} />
      <Group align="flex-start" gap="md" grow>
        <ComponentStats visibleParticipants={visibleParticipants} studyConfig={studyConfig} />
        <ResponseStats visibleParticipants={visibleParticipants} studyConfig={studyConfig} />
      </Group>
    </Stack>
  );
}
