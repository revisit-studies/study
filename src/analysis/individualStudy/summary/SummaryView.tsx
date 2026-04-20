import { Stack, Group } from '@mantine/core';
import { useMemo } from 'react';
import { ParticipantDataWithStatus } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { OverviewStats } from './OverviewStats';
import { ComponentStats } from './ComponentStats';
import { ResponseStats } from './ResponseStats';
import { getOverviewStats } from './utils';
import { ParticipantCounts } from '../../types';

export function SummaryView({
  visibleParticipants,
  studyConfig,
  allConfigs,
  studyId,
  showStoredCountMismatch,
  comparisonParticipantCounts,
}: {
  visibleParticipants: ParticipantDataWithStatus[];
  studyConfig: StudyConfig;
  allConfigs: Record<string, StudyConfig>;
  studyId?: string;
  showStoredCountMismatch: boolean;
  comparisonParticipantCounts?: ParticipantCounts;
}) {
  const overviewData = useMemo(
    () => getOverviewStats(visibleParticipants, undefined, studyConfig, allConfigs),
    [visibleParticipants, studyConfig, allConfigs],
  );

  return (
    <Stack gap="md">
      <OverviewStats
        overviewData={overviewData}
        studyId={studyId}
        showStoredCountMismatch={showStoredCountMismatch}
        comparisonParticipantCounts={comparisonParticipantCounts}
      />
      <Group align="flex-start" gap="md" grow>
        <ComponentStats visibleParticipants={visibleParticipants} studyConfig={studyConfig} allConfigs={allConfigs} />
        <ResponseStats visibleParticipants={visibleParticipants} studyConfig={studyConfig} allConfigs={allConfigs} />
      </Group>
    </Stack>
  );
}
