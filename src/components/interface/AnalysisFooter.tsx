import {
  ActionIcon, AppShell, Box, Button, Flex, Group, Select, Text, Tooltip,
} from '@mantine/core';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  useMemo, useState, useEffect, useCallback,
} from 'react';
import {
  IconArrowLeft, IconArrowRight, IconPlayerPauseFilled, IconPlayerPlayFilled, IconUser, IconMusicDown,
} from '@tabler/icons-react';
import { useAsync } from '../../store/hooks/useAsync';

import { useStorageEngine } from '../../storage/storageEngineHooks';
import { StorageEngine } from '../../storage/engines/types';
import { useCurrentComponent, useCurrentStep, useCurrentIdentifier } from '../../routes/utils';
import { encryptIndex, decryptIndex } from '../../utils/encryptDecryptIndex';
import {
  useStoreActions, useStoreDispatch, useStoreSelector,
} from '../../store/store';
import { AudioProvenanceVis } from '../audioAnalysis/AudioProvenanceVis';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { getSequenceFlatMap } from '../../utils/getSequenceFlatMap';
import { handleTaskAudio } from '../../utils/handleDownloadAudio';
import { ParticipantRejectModal } from '../../analysis/individualStudy/ParticipantRejectModal';

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
  const studyConfig = useStudyConfig();

  const { setAnalysisIsPlaying } = useStoreActions();
  const storeDispatch = useStoreDispatch();

  const analysisIsPlaying = useStoreSelector((state) => state.analysisIsPlaying);
  const answers = useStoreSelector((state) => state.answers);

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

  const flatSequence = useMemo(() => getSequenceFlatMap(studyConfig.sequence), [studyConfig.sequence]);

  const isStart = useMemo(() => currentStep === 0, [currentStep]);
  const isEnd = useMemo(() => currentStep === flatSequence.length, [currentStep, flatSequence.length]);
  const identifier = useCurrentIdentifier();
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAudioUrl() {
      if (!storageEngine || !participantId || !identifier) {
        setAudioUrl(null);
        return;
      }

      try {
        const url = await storageEngine.getAudioUrl(identifier, participantId);
        setAudioUrl(url);
      } catch {
        setAudioUrl(null);
      }
    }

    fetchAudioUrl();
  }, [storageEngine, participantId, identifier]);

  const handleDownloadAudio = useCallback(async () => {
    if (!storageEngine || !participantId || !identifier) {
      return;
    }

    await handleTaskAudio({
      storageEngine,
      participantId,
      identifier,
      audioUrl,
    });
  }, [storageEngine, participantId, identifier, audioUrl]);

  return (
    <AppShell.Footer zIndex={101} withBorder={false}>
      <Box style={{ backgroundColor: 'var(--mantine-color-blue-1)', height: '150px' }}>

        <AudioProvenanceVis setTimeString={setTimeString} />
        <Flex justify="space-between" align="center" px="md">
          {/* Placeholder box for Show Legend button */}
          <Box />
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
            <Button
              disabled={isStart}
              onClick={() => {
                if (funcIndex) {
                  if (decryptIndex(funcIndex) > 0) {
                    navigate(`../${encryptIndex(decryptIndex(funcIndex) - 1)}?participantId=${participantId}`, { relative: 'path' });
                  } else {
                    navigate(`../../${encryptIndex(+currentStep - 1)}?participantId=${participantId}`, { relative: 'path' });
                  }
                } else {
                  navigate(`../${encryptIndex(+currentStep - 1)}?participantId=${participantId}`, { relative: 'path' });
                }
              }}
            >
              <IconArrowLeft />
            </Button>
            <Button
              disabled={isEnd}
              onClick={() => {
                if (funcIndex) {
                  const currentComponentId = flatSequence[currentStep as number];
                  const dynamicBlockAnswers = Object.keys(answers).filter((key) => key.startsWith(`${currentComponentId}_${currentStep}_`));
                  if (decryptIndex(funcIndex) >= dynamicBlockAnswers.length) {
                    navigate(`../../${encryptIndex(+currentStep + 1)}?participantId=${participantId}`, { relative: 'path' });
                  } else {
                    navigate(`../${encryptIndex(decryptIndex(funcIndex) + 1)}?participantId=${participantId}`, { relative: 'path' });
                  }
                } else {
                  navigate(`../${encryptIndex(+currentStep + 1)}?participantId=${participantId}`, { relative: 'path' });
                }
              }}
            >
              <IconArrowRight />
            </Button>
            <Button px="xs" disabled={prevParticipantNameAndIndex[0] === participantId} onClick={() => navigate(`./../${encryptIndex(funcIndex ? 0 : prevParticipantNameAndIndex[1])}?participantId=${prevParticipantNameAndIndex[0]}`)}>
              <IconArrowLeft />
              <IconUser />
            </Button>
            <Button px="xs" disabled={nextParticipantNameAndIndex[0] === participantId} onClick={() => navigate(`./../${encryptIndex(funcIndex ? 0 : nextParticipantNameAndIndex[1])}?participantId=${nextParticipantNameAndIndex[0]}`)}>
              <IconUser />
              <IconArrowRight />
            </Button>
          </Group>
          <Group>
            {audioUrl && (
            <Tooltip label="Download audio">
              <ActionIcon variant="filled" size={30} onClick={handleDownloadAudio}>
                <IconMusicDown />
              </ActionIcon>
            </Tooltip>
            )}
            <ParticipantRejectModal selectedParticipants={[]} />
          </Group>
        </Flex>
      </Box>
    </AppShell.Footer>
  );
}
