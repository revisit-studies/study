import {
  Modal, Text, TextInput, Flex, Button, Alert,
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useState, useCallback, useMemo } from 'react';
import { useSearchParams, useParams } from 'react-router';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { useAsync } from '../../store/hooks/useAsync';
import { StorageEngine } from '../../storage/engines/types';
import { ParticipantData } from '../../storage/types';

function getCurrentParticipantData(storageEngine: StorageEngine | undefined, participantId: string | undefined, studyId: string | undefined): Promise<ParticipantData | null> | null {
  if (storageEngine && participantId && studyId) {
    return storageEngine.getParticipantData(participantId);
  }
  return null;
}

interface UseParticipantRejectModalOptions {
  selectedParticipants?: ParticipantData[];
  onRefresh?: () => Promise<void>;
  onSelectionChange?: (selection: Record<string, boolean>) => void;
}

export function useParticipantRejectModal(options: UseParticipantRejectModalOptions = {}) {
  const [searchParams] = useSearchParams();
  const { studyId } = useParams();
  const { storageEngine } = useStorageEngine();

  const participantId = useMemo(() => searchParams.get('participantId') || undefined, [searchParams]);
  const { value: currentParticipantData, execute: refreshCurrentParticipantData } = useAsync(getCurrentParticipantData, [storageEngine, participantId, studyId]);

  const [modalRejectOpened, setModalRejectOpened] = useState<boolean>(false);
  const [modalUndoRejectOpened, setModalUndoRejectOpened] = useState<boolean>(false);
  const [rejectMessage, setRejectMessage] = useState<string>('');

  const isBulkMode = Boolean(options.selectedParticipants && options.selectedParticipants.length > 0);
  const selectedParticipants = useMemo(
    () => options.selectedParticipants || (currentParticipantData ? [currentParticipantData] : []),
    [options.selectedParticipants, currentParticipantData],
  );
  const rejectedParticipantsCount = useMemo(() => selectedParticipants.filter((p) => p.rejected).length, [selectedParticipants]);
  const nonRejectedParticipantsCount = useMemo(() => selectedParticipants.filter((p) => !p.rejected).length, [selectedParticipants]);

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

  const handleRejectParticipant = useCallback(async () => {
    setModalRejectOpened(false);

    if (isBulkMode) {
      const participantsToReject = selectedParticipants.filter((p) => !p.rejected);
      const promises = participantsToReject.map(async (p) => await rejectParticipant(p.participantId, rejectMessage));
      await Promise.all(promises);
      if (options.onSelectionChange) options.onSelectionChange({});
      if (options.onRefresh) await options.onRefresh();
    } else {
      await rejectParticipant(participantId || '', rejectMessage);
      refreshCurrentParticipantData(storageEngine, participantId, studyId);
    }

    setRejectMessage('');
  }, [isBulkMode, selectedParticipants, rejectParticipant, rejectMessage, options, participantId, refreshCurrentParticipantData, storageEngine, studyId]);

  const handleUndoRejectParticipant = useCallback(async () => {
    setModalUndoRejectOpened(false);

    if (isBulkMode) {
      const promises = selectedParticipants.map(async (p) => await undoRejectParticipant(p.participantId));
      await Promise.all(promises);
      if (options.onSelectionChange) options.onSelectionChange({});
      if (options.onRefresh) await options.onRefresh();
    } else {
      await undoRejectParticipant(participantId || '');
      refreshCurrentParticipantData(storageEngine, participantId, studyId);
    }
  }, [isBulkMode, selectedParticipants, undoRejectParticipant, options, participantId, refreshCurrentParticipantData, storageEngine, studyId]);

  return {
    modalRejectOpened,
    modalUndoRejectOpened,
    setModalRejectOpened,
    setModalUndoRejectOpened,
    currentParticipantData,
    modals: (
      <>
        <Modal
          opened={modalRejectOpened}
          onClose={() => setModalRejectOpened(false)}
          title={(
            <Text>
              {isBulkMode ? `Reject Participants (${nonRejectedParticipantsCount})` : 'Reject Participant'}
            </Text>
          )}
        >
          <Alert
            icon={<IconAlertTriangle size={16} />}
            title="Warning"
            color="orange"
            mb="md"
          >
            {isBulkMode && rejectedParticipantsCount > 0 && (
              <>
                {rejectedParticipantsCount}
                {' '}
                of your
                {' '}
                {selectedParticipants.length}
                {' '}
                selected participant
                {selectedParticipants.length === 1 ? '' : 's'}
                {' '}
                {rejectedParticipantsCount === 1 ? 'has' : 'have'}
                {' '}
                already been rejected. Clicking reject participants will now reject the other
                {' '}
                {nonRejectedParticipantsCount}
                .
                <br />
                <br />
              </>
            )}
            When participants are rejected, their sequences will be reassigned to other participants.
          </Alert>
          <TextInput
            label="Please enter the reason for rejection."
            onChange={(event) => setRejectMessage(event.target.value)}
          />
          <Flex mt="sm" justify="right">
            <Button mr={5} variant="subtle" color="dark" onClick={() => { setModalRejectOpened(false); setRejectMessage(''); }}>
              Cancel
            </Button>
            <Button color="red" onClick={handleRejectParticipant}>
              {isBulkMode ? 'Reject Participants' : 'Reject Participant'}
            </Button>
          </Flex>
        </Modal>

        <Modal
          opened={modalUndoRejectOpened}
          onClose={() => setModalUndoRejectOpened(false)}
          title={(
            <Text>
              {isBulkMode ? `Undo Reject Participants (${selectedParticipants.length})` : 'Participant Rejected'}
            </Text>
          )}
        >
          <Alert
            icon={<IconAlertTriangle size={16} />}
            title="Warning"
            color="orange"
            mb="md"
          >
            {isBulkMode
              ? 'When you undo participant rejections, you may end up with unbalanced latin squares. This is because the rejected sequence may have been reassigned.'
              : 'When you undo participant rejections, their sequence assignments will be marked as available again.'}
          </Alert>
          {isBulkMode ? (
            <Text>Are you sure you want to undo the rejection of these participants?</Text>
          ) : (
            <>
              <Text>
                The participant has been rejected.
              </Text>
              <Text>
                Reason:
                {' '}
                {currentParticipantData?.rejected && typeof currentParticipantData.rejected === 'object' ? currentParticipantData.rejected.reason : 'No reason provided'}
              </Text>
            </>
          )}
          <Flex mt="sm" justify="right">
            <Button mr={5} variant="subtle" color="dark" onClick={() => setModalUndoRejectOpened(false)}>
              Cancel
            </Button>
            <Button color="blue" onClick={handleUndoRejectParticipant}>
              {isBulkMode ? 'Undo Reject Participants' : 'Undo Reject Participant'}
            </Button>
          </Flex>
        </Modal>
      </>
    ),
  };
}
