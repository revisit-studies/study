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
  allConfigs,
  studyId,
  showStoredCountMismatch,
  includedParticipants,
  currentConfigLabel,
}: {
  visibleParticipants: ParticipantDataWithStatus[];
  studyConfig: StudyConfig;
  allConfigs: Record<string, StudyConfig>;
  studyId?: string;
  showStoredCountMismatch: boolean;
  includedParticipants: string[];
  currentConfigLabel?: string;
}) {
  const overviewData = useMemo(
    () => getOverviewStats(visibleParticipants),
    [visibleParticipants],
  );

  const selectedConfigRows = useMemo(() => {
    const visibleConfigHashes = [...new Set(visibleParticipants.map((participant) => participant.participantConfigHash))];

    return visibleConfigHashes.flatMap((configHash) => {
      const config = allConfigs[configHash];
      if (!config) {
        return [];
      }

      const version = config.studyMetadata?.version;
      return [
        {
          configHash,
          configLabel: version ? `${version} - ${configHash.slice(0, 6)}` : configHash.slice(0, 6),
          studyConfig: config,
        },
      ];
    });
  }, [visibleParticipants, allConfigs]);

  return (
    <Stack gap="md">
      <OverviewStats
        overviewData={overviewData}
        studyId={studyId}
        showStoredCountMismatch={showStoredCountMismatch}
        includedParticipants={includedParticipants}
      />
      <Group align="flex-start" gap="md" grow>
        <ComponentStats
          visibleParticipants={visibleParticipants}
          studyConfig={studyConfig}
          selectedConfigRows={selectedConfigRows}
          currentConfigLabel={currentConfigLabel}
        />
        <ResponseStats
          visibleParticipants={visibleParticipants}
          studyConfig={studyConfig}
          selectedConfigRows={selectedConfigRows}
          currentConfigLabel={currentConfigLabel}
        />
      </Group>
    </Stack>
  );
}
