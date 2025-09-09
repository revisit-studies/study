import {
  Modal, Text, TextInput, Flex, Button, Alert, Tooltip,
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import {
  useState, useCallback, useMemo, useEffect,
} from 'react';
import { useSearchParams, useParams } from 'react-router';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { ParticipantData } from '../../storage/types';
import { useAuth } from '../../store/hooks/useAuth';

export function ParticipantRejectModal({
  selectedParticipants = [],
  refresh,
}: {
  selectedParticipants: ParticipantData[];
  refresh?: () => Promise<void>;
}) {
  const { storageEngine } = useStorageEngine();
  const { user } = useAuth();
  const { studyId } = useParams();
  const [searchParams] = useSearchParams();
  const participantId = useMemo(() => searchParams.get('participantId') || undefined, [searchParams]);
  const [currentParticipantData, setCurrentParticipantData] = useState<ParticipantData | null>(null);

  useEffect(() => {
    async function loadParticipantData() {
      if (storageEngine && participantId && studyId) {
        const participantData = await storageEngine.getParticipantData(participantId);
        setCurrentParticipantData(participantData);
      } else {
        setCurrentParticipantData(null);
      }
    }
    loadParticipantData();
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

  const currentAndSelectedParticipants = useMemo(() => [...selectedParticipants, currentParticipantData].filter((p) => p !== null) as ParticipantData[], [selectedParticipants, currentParticipantData]);
  const rejectedParticipantsCount = useMemo(() => currentAndSelectedParticipants.filter((p) => p.rejected).length, [currentAndSelectedParticipants]);
  const nonRejectedParticipantsCount = useMemo(() => currentAndSelectedParticipants.filter((p) => !p.rejected).length, [currentAndSelectedParticipants]);

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

    if (currentAndSelectedParticipants.length > 0) {
      const participantsToReject = currentAndSelectedParticipants.filter((p) => !p.rejected);
      const promises = participantsToReject.map(async (p) => await rejectParticipant(p.participantId, rejectMessage));
      await Promise.all(promises);
    } else {
      await rejectParticipant(participantId || '', rejectMessage);
    }
    if (refresh) {
      await refresh();
    }
    if (currentParticipantData) {
      await refreshCurrentParticipantData();
    }

    setRejectMessage('');
  }, [currentAndSelectedParticipants, refresh, currentParticipantData, rejectParticipant, rejectMessage, participantId, refreshCurrentParticipantData]);

  const handleUndoRejectParticipant = useCallback(async () => {
    setModalUndoRejectOpened(false);

    if (currentAndSelectedParticipants.length > 0) {
      const promises = currentAndSelectedParticipants.map(async (p) => await undoRejectParticipant(p.participantId));
      await Promise.all(promises);
    } else {
      await undoRejectParticipant(participantId || '');
      await refreshCurrentParticipantData();
    }
    if (refresh) {
      await refresh();
    }
    if (currentParticipantData) {
      await refreshCurrentParticipantData();
    }
  }, [currentAndSelectedParticipants, refresh, currentParticipantData, undoRejectParticipant, participantId, refreshCurrentParticipantData]);

  return (
    <>
      {rejectedParticipantsCount > 0 && (
      <Tooltip label="Only admins can undo rejection" disabled={user.isAdmin}>
        <Button disabled={!user.isAdmin} onClick={() => setModalUndoRejectOpened(true)} color="blue">
          Undo Reject Participants (
          {rejectedParticipantsCount}
          )
        </Button>
      </Tooltip>
      )}
      {nonRejectedParticipantsCount > 0 && (
      <Tooltip label="Only admins can reject participants" disabled={user.isAdmin}>
        <Button disabled={!user.isAdmin} onClick={() => setModalRejectOpened(true)} color="red">
          Reject Participants (
          {nonRejectedParticipantsCount}
          )
        </Button>
      </Tooltip>
      )}
      <Modal
        opened={modalRejectOpened}
        onClose={() => setModalRejectOpened(false)}
        title={nonRejectedParticipantsCount > 0 ? `Reject Participants (${nonRejectedParticipantsCount})` : 'Reject Participant'}
      >
        <Alert
          icon={<IconAlertTriangle size={16} />}
          title="Warning"
          color="orange"
          mb="md"
        >
          {currentAndSelectedParticipants.length > 0 && rejectedParticipantsCount > 0 && (
          <>
            {rejectedParticipantsCount}
            {' '}
            of your
            {' '}
            {currentAndSelectedParticipants.length}
            {' '}
            selected participant
            {currentAndSelectedParticipants.length === 1 ? '' : 's'}
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
            {currentAndSelectedParticipants.length > 0 ? 'Reject Participants' : 'Reject Participant'}
          </Button>
        </Flex>
      </Modal>

      <Modal
        opened={modalUndoRejectOpened}
        onClose={() => setModalUndoRejectOpened(false)}
        title={(
          <Text>
            {`Undo Reject Participants (${currentAndSelectedParticipants.length})`}
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
        {currentAndSelectedParticipants.length > 0 ? (
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
            {currentAndSelectedParticipants.length > 0 ? 'Undo Reject Participants' : 'Undo Reject Participant'}
          </Button>
        </Flex>
      </Modal>
    </>
  );
}
