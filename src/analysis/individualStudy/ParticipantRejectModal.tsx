import {
  Modal, Text, TextInput, Flex, Button, Alert,
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import {
  useState, useCallback, useMemo, useEffect,
} from 'react';
import { useSearchParams, useParams } from 'react-router';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { ParticipantData } from '../../storage/types';

export function useParticipantRejectModal({
  selectedParticipants = [],
}: {
  selectedParticipants: ParticipantData[];
}) {
  const { storageEngine } = useStorageEngine();
  const { studyId } = useParams();
  const [searchParams] = useSearchParams();
  const participantId = useMemo(() => searchParams.get('participantId') || undefined, [searchParams]);
  const [currentParticipantData, setCurrentParticipantData] = useState<ParticipantData | null>(null);

  useEffect(() => {
    if (storageEngine && participantId && studyId) {
      storageEngine.getParticipantData(participantId).then(setCurrentParticipantData);
    } else {
      setCurrentParticipantData(null);
    }
  }, [storageEngine, participantId, studyId]);

  const refreshCurrentParticipantData = useCallback(async () => {
    if (storageEngine && participantId && studyId) {
      const data = await storageEngine.getParticipantData(participantId);
      setCurrentParticipantData(data);
    }
  }, [storageEngine, participantId, studyId]);

  const [modalRejectOpened, setModalRejectOpened] = useState(false);
  const [modalUndoRejectOpened, setModalUndoRejectOpened] = useState(false);
  const [rejectMessage, setRejectMessage] = useState<string>('');

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

    if (selectedParticipants.length > 0) {
      const participantsToReject = selectedParticipants.filter((p) => !p.rejected);
      const promises = participantsToReject.map(async (p) => await rejectParticipant(p.participantId, rejectMessage));
      await Promise.all(promises);
    } else {
      await rejectParticipant(participantId || '', rejectMessage);
      await refreshCurrentParticipantData();
    }

    setRejectMessage('');
  }, [selectedParticipants, rejectParticipant, rejectMessage, participantId, refreshCurrentParticipantData]);

  const handleUndoRejectParticipant = useCallback(async () => {
    setModalUndoRejectOpened(false);

    if (selectedParticipants.length > 0) {
      const promises = selectedParticipants.map(async (p) => await undoRejectParticipant(p.participantId));
      await Promise.all(promises);
    } else {
      await undoRejectParticipant(participantId || '');
      await refreshCurrentParticipantData();
    }
  }, [selectedParticipants, undoRejectParticipant, participantId, refreshCurrentParticipantData]);

  return {
    modalRejectOpened,
    modalUndoRejectOpened,
    setModalRejectOpened,
    setModalUndoRejectOpened,
    currentParticipantData,
    ParticipantRejectModal: (
      <>
        <Modal
          opened={modalRejectOpened}
          onClose={() => setModalRejectOpened(false)}
          title={(
            <Text>
              {selectedParticipants.length > 0 ? `Reject Participants (${nonRejectedParticipantsCount})` : 'Reject Participant'}
            </Text>
          )}
        >
          <Alert
            icon={<IconAlertTriangle size={16} />}
            title="Warning"
            color="orange"
            mb="md"
          >
            {selectedParticipants.length > 0 && rejectedParticipantsCount > 0 && (
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
              {selectedParticipants.length > 0 ? 'Reject Participants' : 'Reject Participant'}
            </Button>
          </Flex>
        </Modal>

        <Modal
          opened={modalUndoRejectOpened}
          onClose={() => setModalUndoRejectOpened(false)}
          title={(
            <Text>
              {`Undo Reject Participants (${selectedParticipants.length})`}
            </Text>
          )}
        >
          <Alert
            icon={<IconAlertTriangle size={16} />}
            title="Warning"
            color="orange"
            mb="md"
          >
            When you undo participant rejections, you may end up with unbalanced latin squares. This is because the rejected sequence may have been reassigned.
          </Alert>
          {selectedParticipants.length > 0 ? (
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
              {selectedParticipants.length > 0 ? 'Undo Reject Participants' : 'Undo Reject Participant'}
            </Button>
          </Flex>
        </Modal>
      </>
    ),
  };
}
