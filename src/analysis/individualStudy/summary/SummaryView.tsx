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
  currentConfigLabel,
}: {
  visibleParticipants: ParticipantDataWithStatus[];
  studyConfig: StudyConfig;
  allConfigs: Record<string, StudyConfig>;
  studyId?: string;
  showStoredCountMismatch: boolean;
  comparisonParticipantCounts?: ParticipantCounts;
  currentConfigLabel?: string;
}) {
  const overviewData = useMemo(
    () => getOverviewStats(visibleParticipants, undefined, studyConfig, allConfigs),
    [visibleParticipants, studyConfig, allConfigs],
  );

  const selectedConfigRows = useMemo(() => {
    const visibleConfigHashes = [...new Set(visibleParticipants.map((participant) => participant.participantConfigHash))]
      .filter((hash) => hash in allConfigs);

    return visibleConfigHashes.map((configHash) => {
      const config = allConfigs[configHash];
      const version = config?.studyMetadata?.version;
      return {
        configHash,
        configLabel: version ? `${version} - ${configHash.slice(0, 6)}` : configHash.slice(0, 6),
        studyConfig: config,
      };
    });
  }, [visibleParticipants, allConfigs]);

  return (
    <Stack gap="md">
      <OverviewStats
        overviewData={overviewData}
        studyId={studyId}
        showStoredCountMismatch={showStoredCountMismatch}
        comparisonParticipantCounts={comparisonParticipantCounts}
      />
      <Group align="flex-start" gap="md" grow>
        <ComponentStats
          visibleParticipants={visibleParticipants}
          studyConfig={studyConfig}
          allConfigs={allConfigs}
          selectedConfigRows={selectedConfigRows}
          currentConfigLabel={currentConfigLabel}
        />
        <ResponseStats
          visibleParticipants={visibleParticipants}
          studyConfig={studyConfig}
          allConfigs={allConfigs}
          selectedConfigRows={selectedConfigRows}
          currentConfigLabel={currentConfigLabel}
        />
      </Group>
    </Stack>
  );
}
