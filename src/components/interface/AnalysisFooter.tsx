import {
  ActionIcon,
  AppShell, Box, Button, Center, Group, Select, Text,
} from '@mantine/core';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useMemo, useState } from 'react';
import {
  IconArrowLeft, IconArrowRight, IconPlayerPauseFilled, IconPlayerPlayFilled, IconUser,
} from '@tabler/icons-react';
import { useAsync } from '../../store/hooks/useAsync';

import { useStorageEngine } from '../../storage/storageEngineHooks';
import { StorageEngine } from '../../storage/engines/types';
import { useCurrentComponent, useCurrentStep } from '../../routes/utils';
import { encryptIndex } from '../../utils/encryptDecryptIndex';
import {
  useStoreActions, useStoreDispatch, useStoreSelector,
} from '../../store/store';
import { AudioProvenanceVis } from '../audioAnalysis/AudioProvenanceVis';

function getAllParticipantsNames(storageEngine: StorageEngine | undefined) {
  if (storageEngine) {
    return storageEngine.getAllParticipantIds();
  }
  return null;
}

export function AnalysisFooter() {
  const [searchParams] = useSearchParams();

  const participantId = useMemo(() => searchParams.get('participantId') || undefined, [searchParams]);

  const currentComponent = useCurrentComponent();
  const currentStep = useCurrentStep();
  const { funcIndex } = useParams();
  const navigate = useNavigate();

  const { setAnalysisIsPlaying } = useStoreActions();
  const storeDispatch = useStoreDispatch();

  const analysisIsPlaying = useStoreSelector((state) => state.analysisIsPlaying);

  const { storageEngine } = useStorageEngine();

  const { value: allParticipants } = useAsync(getAllParticipantsNames, [storageEngine]);

  const [nextParticipantNameAndIndex, prevParticipantNameAndIndex]: [[string, number], [string, number]] = useMemo(() => {
    if (allParticipants && participantId && currentComponent) {
      const index = allParticipants.findIndex((part) => part === participantId);
      const nextPart = index < allParticipants.length - 1 ? allParticipants[index + 1] : allParticipants[0];
      const prevPart = index > 0 ? allParticipants[index - 1] : allParticipants[allParticipants.length - 1];

      return [[nextPart, currentStep as number], [prevPart, currentStep as number]];
    }
    return [['', 0], ['', 0]];
  }, [allParticipants, currentComponent, currentStep, participantId]);

  const [timeString, setTimeString] = useState<string>('');

  return (
    <AppShell.Footer zIndex={101} withBorder={false}>
      <Box style={{ backgroundColor: 'var(--mantine-color-blue-1)', height: '150px' }}>

        <AudioProvenanceVis setTimeString={setTimeString} />
        <Center>
          <Group gap="xs" style={{ height: '50px' }}>
            <Text size="sm" ff="monospace">
              {timeString}
            </Text>
            <ActionIcon variant="filled" size={30} onClick={() => storeDispatch(setAnalysisIsPlaying(!analysisIsPlaying))}>
              {analysisIsPlaying ? <IconPlayerPauseFilled /> : <IconPlayerPlayFilled />}
            </ActionIcon>

            <Text mx="0">
              Participant:
            </Text>
            <Select
              style={{ width: '300px' }}
              value={participantId || ''}
              onChange={(e) => {
                navigate(`./../${encryptIndex(0)}?participantId=${e}`);
              }}
              data={allParticipants || []}
            />
            <Button onClick={() => navigate(`../${funcIndex ? '..' : ''}${encryptIndex(+currentStep - 1)}?participantId=${participantId}`, { relative: 'path' })}>
              <IconArrowLeft />
            </Button>
            <Button onClick={() => navigate(`../${funcIndex ? '..' : ''}${encryptIndex(+currentStep + 1)}?participantId=${participantId}`, { relative: 'path' })}>
              <IconArrowRight />
            </Button>
            <Button px="xs" disabled={prevParticipantNameAndIndex[0] === participantId} onClick={() => navigate(`./../${funcIndex ? '..' : ''}${encryptIndex(prevParticipantNameAndIndex[1])}?participantId=${prevParticipantNameAndIndex[0]}`)}>
              <IconArrowLeft />
              <IconUser />
            </Button>
            <Button px="xs" disabled={nextParticipantNameAndIndex[0] === participantId} onClick={() => navigate(`./../${funcIndex ? '..' : ''}${encryptIndex(nextParticipantNameAndIndex[1])}?participantId=${nextParticipantNameAndIndex[0]}`)}>
              <IconUser />
              <IconArrowRight />
            </Button>
          </Group>
        </Center>
      </Box>
    </AppShell.Footer>
  );
}
