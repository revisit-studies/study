import {
  ActionIcon,
  AppShell, Box, Button, Group, Select, Text, Modal, TextInput, Flex, Tooltip, Alert,
} from '@mantine/core';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useMemo, useState, useCallback } from 'react';
import {
  IconArrowLeft, IconArrowRight, IconPlayerPauseFilled, IconPlayerPlayFilled, IconUser, IconAlertTriangle,
} from '@tabler/icons-react';
import { useAsync } from '../../store/hooks/useAsync';

import { useStorageEngine } from '../../storage/storageEngineHooks';
import { StorageEngine } from '../../storage/engines/types';
import { useCurrentComponent, useCurrentStep } from '../../routes/utils';
import { encryptIndex, decryptIndex } from '../../utils/encryptDecryptIndex';
import {
  useStoreActions, useStoreDispatch, useStoreSelector,
} from '../../store/store';
import { AudioProvenanceVis } from '../audioAnalysis/AudioProvenanceVis';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { getSequenceFlatMap } from '../../utils/getSequenceFlatMap';
import { useAuth } from '../../store/hooks/useAuth';

function getAllParticipantsNames(storageEngine: StorageEngine | undefined) {
  if (storageEngine) {
    return storageEngine.getAllParticipantIds();
  }
  return null;
}

function getCurrentParticipantData(storageEngine: StorageEngine | undefined, participantId: string | undefined, studyId: string | undefined) {
  if (storageEngine && participantId && studyId) {
    return storageEngine.getAllParticipantsData(studyId).then((participants) => participants.find((p) => p.participantId === participantId));
  }
  return null;
}

export function AnalysisFooter() {
  const [searchParams] = useSearchParams();

  const participantId = useMemo(() => searchParams.get('participantId') || undefined, [searchParams]);

  const currentComponent = useCurrentComponent();
  const currentStep = useCurrentStep();
  const { funcIndex, studyId } = useParams();
  const navigate = useNavigate();
  const studyConfig = useStudyConfig();

  const { setAnalysisIsPlaying } = useStoreActions();
  const storeDispatch = useStoreDispatch();

  const analysisIsPlaying = useStoreSelector((state) => state.analysisIsPlaying);
  const answers = useStoreSelector((state) => state.answers);

  const { storageEngine } = useStorageEngine();
  const { user } = useAuth();

  const { value: allParticipants } = useAsync(getAllParticipantsNames, [storageEngine]);
  const { value: currentParticipantData, execute: refreshCurrentParticipantData } = useAsync(getCurrentParticipantData, [storageEngine, participantId, studyId]);

  const rejectParticipant = useCallback(async (rejectParticipantId: string, reason: string) => {
    if (storageEngine && studyId) {
      const finalReason = reason === '' ? 'Rejected by admin' : reason;
      await storageEngine.rejectParticipant(rejectParticipantId, finalReason, studyId);
    }
  }, [storageEngine, studyId]);

  const undoRejectParticipant = useCallback(async (rejectParticipantId: string) => {
    if (storageEngine && studyId) {
      await storageEngine.undoRejectParticipant(rejectParticipantId, studyId);
    }
  }, [storageEngine, studyId]);

  const [modalRejectParticipantsOpened, setModalRejectParticipantsOpened] = useState<boolean>(false);
  const [modalUndoRejectParticipantsOpened, setModalUndoRejectParticipantsOpened] = useState<boolean>(false);
  const [rejectParticipantsMessage, setRejectParticipantsMessage] = useState<string>('');

  const handleRejectParticipant = useCallback(async () => {
    setModalRejectParticipantsOpened(false);
    await rejectParticipant(participantId || '', rejectParticipantsMessage);
    setRejectParticipantsMessage('');
    refreshCurrentParticipantData(storageEngine, participantId, studyId);
  }, [rejectParticipant, rejectParticipantsMessage, participantId, refreshCurrentParticipantData, storageEngine, studyId]);

  const handleUndoRejectParticipant = useCallback(async () => {
    setModalUndoRejectParticipantsOpened(false);
    await undoRejectParticipant(participantId || '');
    refreshCurrentParticipantData(storageEngine, participantId, studyId);
  }, [undoRejectParticipant, participantId, refreshCurrentParticipantData, storageEngine, studyId]);

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

  return (
    <AppShell.Footer zIndex={101} withBorder={false}>
      <Box style={{ backgroundColor: 'var(--mantine-color-blue-1)', height: '150px', position: 'relative' }}>

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
            <Tooltip label={currentParticipantData?.rejected ? 'Admin can undo rejection' : 'Admin can reject participants'} disabled={user.isAdmin}>
              <Button
                color={currentParticipantData?.rejected ? 'blue' : 'red'}
                disabled={!user.isAdmin || !participantId}
                onClick={() => {
                  if (currentParticipantData?.rejected) {
                    setModalUndoRejectParticipantsOpened(true);
                  } else {
                    setModalRejectParticipantsOpened(true);
                  }
                }}
              >
                {currentParticipantData?.rejected ? 'Un-reject Participant' : 'Reject Participant'}
              </Button>
            </Tooltip>
          </Group>
        </Flex>

      </Box>

      <Modal
        opened={modalRejectParticipantsOpened}
        onClose={() => setModalRejectParticipantsOpened(false)}
        title={(
          <Text>
            Reject Participant
          </Text>
        )}
      >
        <Alert
          icon={<IconAlertTriangle size={16} />}
          title="Warning"
          color="orange"
          mb="md"
        >
          When participants are rejected, their sequences will be reassigned to other participants.
        </Alert>
        <TextInput
          label="Please enter the reason for rejection."
          onChange={(event) => setRejectParticipantsMessage(event.target.value)}
        />
        <Flex mt="sm" justify="right">
          <Button mr={5} variant="subtle" color="dark" onClick={() => { setModalRejectParticipantsOpened(false); setRejectParticipantsMessage(''); }}>
            Cancel
          </Button>
          <Button color="red" onClick={() => { setModalRejectParticipantsOpened(false); handleRejectParticipant(); }}>
            Reject Participant
          </Button>
        </Flex>
      </Modal>

      <Modal
        opened={modalUndoRejectParticipantsOpened}
        onClose={() => setModalUndoRejectParticipantsOpened(false)}
        title={(
          <Text>
            Participant Rejected
          </Text>
        )}
      >
        <Alert
          icon={<IconAlertTriangle size={16} />}
          title="Warning"
          color="orange"
          mb="md"
        >
          When you undo participant rejections, their sequence assignments will be marked as available again.
        </Alert>
        <Text>
          The participant has been rejected.
        </Text>
        <Text>
          Reason:
          {' '}
          {currentParticipantData?.rejected ? currentParticipantData.rejected.reason : 'No reason provided'}
        </Text>
        <Flex mt="sm" justify="right">
          <Button mr={5} variant="subtle" color="dark" onClick={() => { setModalUndoRejectParticipantsOpened(false); setRejectParticipantsMessage(''); }}>
            Cancel
          </Button>
          <Button color="blue" onClick={() => { setModalUndoRejectParticipantsOpened(false); handleUndoRejectParticipant(); }}>
            Undo Reject Participant
          </Button>
        </Flex>
      </Modal>
    </AppShell.Footer>
  );
}
