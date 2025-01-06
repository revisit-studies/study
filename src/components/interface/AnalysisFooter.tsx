/* eslint-disable no-nested-ternary */
import {
  AppShell, Box, Group, Text,
} from '@mantine/core';
import { useParams } from 'react-router-dom';
import { useMemo } from 'react';
import { useAsync } from '../../store/hooks/useAsync';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { StorageEngine } from '../../storage/engines/StorageEngine';

function getParticipantData(trrackId: string | undefined, storageEngine: StorageEngine | undefined) {
  if (storageEngine) {
    return storageEngine.getParticipantData(trrackId);
  }

  return null;
}

function humanReadableDuration(msDuration: number): string {
  const h = Math.floor(msDuration / 1000 / 60 / 60);
  const m = Math.floor((msDuration / 1000 / 60 / 60 - h) * 60);
  const s = Math.floor(((msDuration / 1000 / 60 / 60 - h) * 60 - m) * 60);

  // To get time format 00:00:00
  const seconds: string = s < 10 ? `0${s}` : `${s}`;
  const minutes: string = m < 10 ? `0${m}` : `${m}`;
  const hours: string = h < 10 ? `0${h}` : `${h}`;

  return `${hours}h ${minutes}m ${seconds}s`;
}

export function AnalysisFooter() {
  const { participantId } = useParams();
  const { storageEngine } = useStorageEngine();

  const { value: participant } = useAsync(getParticipantData, [participantId, storageEngine]);

  const duration = useMemo(() => {
    if (!participant || !participant.answers || Object.entries(participant.answers).length === 0) {
      return 0;
    }

    const answersSorted = Object.values(participant.answers).sort((a, b) => a.startTime - b.startTime);

    return new Date(answersSorted[answersSorted.length - 1].endTime - (answersSorted[1] ? answersSorted[1].startTime : 0)).getTime();
  }, [participant]);

  return (
    <AppShell.Footer zIndex={101} withBorder={false}>
      <Box style={{ backgroundColor: 'var(--mantine-color-blue-2)' }}>
        <Group>
          <Text mx="sm">
            {`Analyzing participant ${participant?.participantId}`}
          </Text>
          <Text mx="sm">
            {`Duration: ${humanReadableDuration(duration)}`}
          </Text>
          <Text mx="sm">
            {`Status: ${participant?.rejected ? 'Rejected' : participant?.completed ? 'Completed' : 'Incomplete'}`}
          </Text>
        </Group>
      </Box>
    </AppShell.Footer>
  );
}
