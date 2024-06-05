import {
  Card, Container, Text, LoadingOverlay, Box, Title, Flex, Modal, TextInput, Button, Tooltip, ActionIcon,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { IconTrashX, IconRefresh } from '@tabler/icons-react';
import { openConfirmModal } from '@mantine/modals';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { FirebaseStorageEngine } from '../../storage/engines/FirebaseStorageEngine';

export function DataManagementBoard({ studyId, refresh }: { studyId: string, refresh: () => Promise<void> }) {
  const [modalArchiveOpened, setModalArchiveOpened] = useState<boolean>(false);
  const [modalDeleteSnapshotOpened, setModalDeleteSnapshotOpened] = useState<boolean>(false);

  const [currentSnapshot, setCurrentSnapshot] = useState<string>('');

  const [snapshots, setSnapshots] = useState<string[]>([]);

  const [deleteValue, setDeleteValue] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [snapshotListLoading, setSnapshotListLoading] = useState<boolean>(false);

  const [snapshotActionFlag, setSnapshotActionFlag] = useState<boolean>(false);

  const { storageEngine } = useStorageEngine();

  // Used to fetch archived datasets
  useEffect(() => {
    async function fetchData() {
      setSnapshotListLoading(true);
      if (storageEngine instanceof FirebaseStorageEngine) {
        const currSnapshots = await storageEngine.getSnapshots(studyId);
        setSnapshots(currSnapshots);
      }
      setSnapshotListLoading(false);
    }
    fetchData();
  }, [snapshotActionFlag]);

  const handleCreateSnapshot = async () => {
    setLoading(true);
    if (storageEngine instanceof FirebaseStorageEngine) {
      await storageEngine.createSnapshot(studyId, false);
    }
    setSnapshotActionFlag((prev) => !prev);
    setLoading(false);
  };

  const handleArchiveData = async () => {
    setLoading(true);
    setDeleteValue('');
    if (storageEngine instanceof FirebaseStorageEngine) {
      setModalArchiveOpened(false);
      await storageEngine.createSnapshot(studyId, true);
    }
    setSnapshotActionFlag((prev) => !prev);
    setLoading(false);
  };

  const handleDeleteSnapshot = async () => {
    setLoading(true);
    setDeleteValue('');
    if (storageEngine instanceof FirebaseStorageEngine) {
      setModalDeleteSnapshotOpened(false);
      await storageEngine.removeSnapshot(currentSnapshot);
    }
    setSnapshotActionFlag((prev) => !prev);
    setLoading(false);
  };

  const handleRestoreSnapshot = async () => {
    setLoading(true);
    if (storageEngine instanceof FirebaseStorageEngine) {
      await storageEngine.restoreSnapshot(studyId, currentSnapshot);
    }
    await refresh();
    setSnapshotActionFlag((prev) => !prev);
    setLoading(false);
  };

  const openCreateSnapshotModal = () => openConfirmModal({
    title: 'Create a Snapshot',
    children: (
      <Text mb={30}>This will create a snapshot of the current dataset. The current study data can be restored to a snapshot at any time.</Text>
    ),
    labels: { confirm: 'Create', cancel: 'Cancel' },
    // confirmProps: { color: 'blue' },
    cancelProps: { variant: 'subtle', color: 'dark' },
    onCancel: () => {},
    onConfirm: () => handleCreateSnapshot(),
  });

  const openRestoreSnapshotModal = () => openConfirmModal({
    title: 'Restore Snapshot',
    children: (
      <Text mb={30}>This will create a snapshot of the current study data into a new snapshot and then copy the this snapshot back into the current study data. This snapshot will then be removed.</Text>
    ),
    labels: { confirm: 'Restore', cancel: 'Cancel' },
    confirmProps: { color: 'red' },
    cancelProps: { variant: 'subtle', color: 'dark' },
    onCancel: () => {},
    onConfirm: () => handleRestoreSnapshot(),
  });

  return (
    <>
      <LoadingOverlay visible={loading} />
      <Container>
        <Card withBorder style={{ backgroundColor: '#FAFAFA', justifySelf: 'left' }}>
          <Title mb={30} order={2}>Data Management</Title>
          <Flex mb={50} justify="space-between" align="center">
            <Box style={{ width: '70%' }}>
              <Title order={4}>Create a Snapshot</Title>
              <Text>
                This wil create a snapshot of the current
                <span style={{ fontWeight: 'bold' }}>
                  {' '}
                  {studyId}
                </span>
                {' '}
                data. It will
                <span style={{ fontStyle: 'italic', fontWeight: 'bold' }}> not</span>
                {' '}
                remove this data from the current dataset. The current study data can be restored to a snapshot at any time.
              </Text>
            </Box>
            <Tooltip label="Create a snapshot">
              <Button
                onClick={openCreateSnapshotModal}
              >
                Create a Snapshot
              </Button>
            </Tooltip>
          </Flex>
          <Flex justify="space-between" align="center">
            <Box style={{ width: '70%' }}>
              <Title order={4}>Archive Data</Title>
              <Text>
                This wil create a snapshot of the current
                <span style={{ fontWeight: 'bold' }}>
                  {' '}
                  {studyId}
                  {' '}
                </span>
                data. It will then remove this data from the current dataset. The current study data can be restored to a snapshot at any time.
              </Text>
            </Box>
            <Tooltip label="Snapshot and Delete Data">
              <Button
                color="red"
                sx={{ '&[data-disabled]': { pointerEvents: 'all' } }}
                onClick={() => setModalArchiveOpened(true)}
              >
                Archive Data
              </Button>
            </Tooltip>
          </Flex>
          <Flex mt={40} direction="column">
            <Flex style={{ borderBottom: '1px solid #dedede' }} direction="row" justify="space-between" mb={15} pb={15}>
              <Title order={4}>Snapshots</Title>
            </Flex>
            <div style={{ position: 'relative' }}>
              <LoadingOverlay visible={snapshotListLoading} />
              { snapshots.length > 0 ? snapshots.map(
                (datasetName:string) => (
                  <Flex key={datasetName} justify="space-between" mb={10}>
                    <Text>{datasetName}</Text>
                    <Flex direction="row" gap={10}>
                      <Tooltip label="Restore Snapshot">
                        <ActionIcon variant="subtle" onClick={() => { openRestoreSnapshotModal(); setCurrentSnapshot(datasetName); }}><IconRefresh color="green" /></ActionIcon>
                      </Tooltip>
                      <Tooltip label="Delete Snapshot">
                        <ActionIcon variant="subtle" onClick={() => { setModalDeleteSnapshotOpened(true); setCurrentSnapshot(datasetName); }}><IconTrashX color="red" /></ActionIcon>
                      </Tooltip>
                    </Flex>
                  </Flex>
                ),
              ) : <Text>No snapshots.</Text>}
            </div>
          </Flex>

        </Card>
      </Container>

      <Modal
        opened={modalArchiveOpened}
        onClose={() => { setModalArchiveOpened(false); setDeleteValue(''); }}
        title={<Title order={4}>Archive Data</Title>}
      >
        <Box>
          <Text mb={30}>This will create a snapshot of the current dataset and then delete the current dataset.</Text>
          <TextInput
            label="To delete this data, please enter the name of the study."
            placeholder={studyId}
            onChange={(event) => setDeleteValue(event.target.value)}
          />
          <Flex mt={30} justify="right">
            <Button mr={5} variant="subtle" color="dark" onClick={() => { setModalArchiveOpened(false); setDeleteValue(''); }}>
              Cancel
            </Button>
            <Button color="red" onClick={() => handleArchiveData()} disabled={deleteValue !== studyId}>
              Archive Data
            </Button>
          </Flex>
        </Box>
      </Modal>

      <Modal
        opened={modalDeleteSnapshotOpened}
        onClose={() => { setModalDeleteSnapshotOpened(false); setDeleteValue(''); }}
        title={<Title order={4}>Delete Snapshot</Title>}
      >
        <Box>
          <Text mb={30}>This will permanently remove this snapshot.</Text>
          <TextInput
            label="To delete this snapshot, please 'delete' in the box below."
            placeholder="delete"
            onChange={(event) => setDeleteValue(event.target.value)}
          />
          <Flex mt={30} justify="right">
            <Button mr={5} variant="subtle" color="dark" onClick={() => { setModalDeleteSnapshotOpened(false); setDeleteValue(''); }}>
              Cancel
            </Button>
            <Button color="red" onClick={() => handleDeleteSnapshot()} disabled={deleteValue !== 'delete'}>
              Delete Snapshot
            </Button>
          </Flex>
        </Box>
      </Modal>
    </>
  );
}
