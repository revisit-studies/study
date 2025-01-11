/* eslint-disable no-nested-ternary */
import {
  ActionIcon,
  AppShell, Box, Button, Center, Group, LoadingOverlay, Select, Text,
} from '@mantine/core';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import { IconPlayerPauseFilled, IconPlayerPlayFilled } from '@tabler/icons-react';
import { useAsync } from '../../store/hooks/useAsync';

import { useStorageEngine } from '../../storage/storageEngineHooks';
import { StorageEngine } from '../../storage/engines/StorageEngine';
import { useCurrentComponent, useCurrentStep } from '../../routes/utils';
import { encryptIndex } from '../../utils/encryptDecryptIndex';
import {
  useStoreActions, useStoreDispatch, useStoreSelector,
} from '../../store/store';
import { getSequenceFlatMap } from '../../utils/getSequenceFlatMap';
import { AnalysisPopout } from '../audioAnalysis/AnalysisPopout';

function getParticipantData(trrackId: string | undefined, storageEngine: StorageEngine | undefined) {
  if (storageEngine) {
    return storageEngine.getParticipantData(trrackId);
  }
  return null;
}

function getAllParticipantsData(storageEngine: StorageEngine | undefined) {
  if (storageEngine) {
    return storageEngine.getAllParticipantsData();
  }
  return null;
}

export function AnalysisFooter() {
  const [searchParams] = useSearchParams();

  const participantId = useMemo(() => searchParams.get('participantId') || undefined, [searchParams]);

  const currentComponent = useCurrentComponent();
  const currentStep = useCurrentStep();
  const navigate = useNavigate();

  const { setAnalysisIsPlaying } = useStoreActions();
  const storeDispatch = useStoreDispatch();

  const analysisIsPlaying = useStoreSelector((state) => state.analysisIsPlaying);

  const { storageEngine } = useStorageEngine();

  const { value: participant, status: loadingPartStatus } = useAsync(getParticipantData, [participantId, storageEngine]);
  const { value: allParticipants } = useAsync(getAllParticipantsData, [storageEngine]);

  const nextParticipantNameAndIndex: [string, number] = useMemo(() => {
    if (allParticipants && participant && participantId && currentComponent) {
      const filteredParticipants = allParticipants.filter((part) => part.participantConfigHash === participant.participantConfigHash);
      const index = filteredParticipants.findIndex((part) => part.participantId === participantId);
      const nextPart = index < filteredParticipants.length - 1 ? filteredParticipants[index + 1] : filteredParticipants[0];

      return [nextPart.participantId, getSequenceFlatMap(nextPart.sequence).indexOf(currentComponent)];
    }
    return ['', 0];
  }, [allParticipants, currentComponent, participant, participantId]);

  const selectData = useMemo(() => {
    const configHashMap: Record<string, Set<string>> = {};
    allParticipants?.forEach((part) => {
      if (!configHashMap[part.participantConfigHash]) {
        configHashMap[part.participantConfigHash] = new Set();
      }
      configHashMap[part.participantConfigHash].add(part.participantId);
    });

    return Object.keys(configHashMap).sort((groupA, groupB) => (groupA === participant?.participantConfigHash ? -1 : groupB === participant?.participantConfigHash ? 1 : 0)).map((key) => ({
      group: `Config version: ${key}`,
      items: [...configHashMap[key]].map((k) => ({ value: k, label: k, disabled: key !== participant?.participantConfigHash })),
    }));
  }, [allParticipants, participant?.participantConfigHash]);

  return (
    <AppShell.Footer zIndex={101} withBorder={false}>
      <Box style={{ backgroundColor: 'var(--mantine-color-blue-2)', height: '150px' }}>
        <LoadingOverlay visible={loadingPartStatus !== 'success'} overlayProps={{ backgroundOpacity: 0.4 }} />

        <AnalysisPopout />
        <Center>
          <Group style={{ height: '50px' }}>
            <ActionIcon variant="filled" size={30} onClick={() => storeDispatch(setAnalysisIsPlaying(!analysisIsPlaying))}>
              {analysisIsPlaying ? <IconPlayerPauseFilled /> : <IconPlayerPlayFilled />}
            </ActionIcon>
            <Text mx="sm">
              Participant:
            </Text>
            <Select
              style={{ width: '300px' }}
              value={participant?.participantId || ''}
              onChange={(e) => {
                navigate(`./${encryptIndex(0)}?participantId=${e}`, { relative: 'path' });
              }}
              data={selectData}
            />
            <Button onClick={() => navigate(`./${encryptIndex(+currentStep - 1)}?participantId=${participantId}`, { relative: 'path' })}>
              Previous Task
            </Button>
            <Button onClick={() => navigate(`./${encryptIndex(+currentStep + 1)}?participantId=${participantId}`, { relative: 'path' })}>
              Next Task
            </Button>
            <Button onClick={() => navigate(`./${encryptIndex(nextParticipantNameAndIndex[1])}?participantId=${nextParticipantNameAndIndex[0]}`)}>
              Next Participant
            </Button>
          </Group>
        </Center>
      </Box>
    </AppShell.Footer>
  );
}
