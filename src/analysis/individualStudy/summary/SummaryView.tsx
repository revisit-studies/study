import { Flex } from '@mantine/core';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { OverviewStats } from './OverviewStats';
import { ComponentStats } from './ComponentStats';
import { ResponseStats } from './ResponseStats';

interface StudyStatsProps {
  visibleParticipants: ParticipantData[];
  studyConfig?: StudyConfig;
}

// First row: Overview Stats & Response Stats
// Second row: Component Stats & Response Stats
export function SummaryView({ visibleParticipants, studyConfig }: StudyStatsProps) {
  return (
    <Flex justify="space-between">
      <OverviewStats visibleParticipants={visibleParticipants} />
      {studyConfig && <ComponentStats participantData={visibleParticipants} />}
      {studyConfig && <ResponseStats participantData={visibleParticipants} />}
    </Flex>
  );
}
