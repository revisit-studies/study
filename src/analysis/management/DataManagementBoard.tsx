import {
  Card, Container, Text, LoadingOverlay, Box, Title, Flex, Modal, TextInput, Button, Tooltip, ActionIcon, Space,
} from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import { IconTrashX, IconRefresh } from '@tabler/icons-react';
import { openConfirmModal } from '@mantine/modals';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { FirebaseStorageEngine } from '../../storage/engines/FirebaseStorageEngine';

export function DataManagementBoard({ studyId, refresh }: { studyId: string, refresh: () => Promise<void> }) {
  const [modalArchiveOpened, setModalArchiveOpened] = useState<boolean>(false);
  const [modalDeleteSnapshotOpened, setModalDeleteSnapshotOpened] = useState<boolean>(false);
  const [modalDeleteLiveOpened, setModalDeleteLiveOpened] = useState<boolean>(false);

  const [currentSnapshot, setCurrentSnapshot] = useState<string>('');

  const [snapshots, setSnapshots] = useState<string[]>([]);

  const [deleteValue, setDeleteValue] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [snapshotListLoading, setSnapshotListLoading] = useState<boolean>(false);

  const { storageEngine } = useStorageEngine();

  // Used to fetch archived datasets
  const refreshSnapshots = useCallback(async () => {
    setSnapshotListLoading(true);
    if (storageEngine instanceof FirebaseStorageEngine) {
      const currSnapshots = await storageEngine.getSnapshots(studyId);
      setSnapshots(currSnapshots);
    }
    setSnapshotListLoading(false);
  }, [storageEngine, studyId]);

  useEffect(() => {
    refreshSnapshots();
  }, [refreshSnapshots]);

  const handleCreateSnapshot = async () => {
    setLoading(true);
    if (storageEngine instanceof FirebaseStorageEngine) {
      await storageEngine.createSnapshot(studyId, false);
    }
    refreshSnapshots();
    setLoading(false);
    await refresh();
  };

  const handleArchiveData = async () => {
    setLoading(true);
    setDeleteValue('');
    if (storageEngine instanceof FirebaseStorageEngine) {
      setModalArchiveOpened(false);
      await storageEngine.createSnapshot(studyId, true);
    }
    refreshSnapshots();
    setLoading(false);
    await refresh();
  };

  const handleRestoreSnapshot = async (snapshot: string) => {
    setLoading(true);
    if (storageEngine instanceof FirebaseStorageEngine) {
      await storageEngine.restoreSnapshot(studyId, snapshot);
    }
    refreshSnapshots();
    setLoading(false);
    await refresh();
  };

  const handleDeleteSnapshot = async () => {
    setLoading(true);
    setDeleteValue('');
    if (storageEngine instanceof FirebaseStorageEngine) {
      setModalDeleteSnapshotOpened(false);
      await storageEngine.removeSnapshotOrLive(currentSnapshot, true);
    }
    refreshSnapshots();
    setLoading(false);
    await refresh();
  };

  const handleDeleteLive = async () => {
    setLoading(true);
    setDeleteValue('');
    if (storageEngine instanceof FirebaseStorageEngine) {
      setModalDeleteLiveOpened(false);
      await storageEngine.removeSnapshotOrLive(studyId, true);
    }
    refreshSnapshots();
    setLoading(false);
    await refresh();
  };

  const openCreateSnapshotModal = () => openConfirmModal({
    title: 'Create a Snapshot',
    children: (
      <Text mb={30}>This will create a snapshot of the live database without impacting the live data.</Text>
    ),
    labels: { confirm: 'Create', cancel: 'Cancel' },
    // confirmProps: { color: 'blue' },
    cancelProps: { variant: 'subtle', color: 'dark' },
    onCancel: () => {},
    onConfirm: () => handleCreateSnapshot(),
  });

  const openRestoreSnapshotModal = (snapshot: string) => openConfirmModal({
    title: 'Restore Snapshot',
    children: (
      <Text mb={30}>Restoring this snapshot will perform 2 actions. First, we will create a snapshot of the current live database, then we will restore the selected snapshot into the live database.</Text>
    ),
    labels: { confirm: 'Restore', cancel: 'Cancel' },
    confirmProps: { color: 'red' },
    cancelProps: { variant: 'subtle', color: 'dark' },
    onCancel: () => {},
    onConfirm: () => handleRestoreSnapshot(snapshot),
  });

  return (
    <>
      <LoadingOverlay visible={loading} />
      <Container>
        <Card withBorder style={{ backgroundColor: '#FAFAFA', justifySelf: 'left' }}>
          <Title mb="lg" order={3}>Data Management</Title>
          <Flex justify="space-between" align="center">
            <Box style={{ width: '70%' }}>
              <Title order={5}>Create a Snapshot</Title>
              <Text>
                This will create a snapshot of the live
                <span style={{ fontWeight: 'bold' }}>
                  {' '}
                  {studyId}
                </span>
                {' '}
                database. It will
                <span style={{ fontStyle: 'italic', fontWeight: 'bold' }}> not</span>
                {' '}
                remove this data from the live database. The current study data can be restored from a snapshot at any time.
              </Text>
            </Box>
            <Tooltip label="Create a snapshot">
              <Button
                onClick={openCreateSnapshotModal}
              >
                Snapshot
              </Button>
            </Tooltip>
          </Flex>

          <Space h="lg" />

          <Flex justify="space-between" align="center">
            <Box style={{ width: '70%' }}>
              <Title order={5}>Archive Data</Title>
              <Text>
                This will create a snapshot of the live
                <span style={{ fontWeight: 'bold' }}>
                  {' '}
                  {studyId}
                  {' '}
                </span>
                database. It will then remove this data from the live database. The current study data can be restored from a snapshot at any time.
              </Text>
            </Box>
            <Tooltip label="Snapshot and Delete Data">
              <Button
                color="red"
                sx={{ '&[data-disabled]': { pointerEvents: 'all' } }}
                onClick={() => setModalArchiveOpened(true)}
              >
                Archive
              </Button>
            </Tooltip>
          </Flex>

          <Space h="lg" />

          <Flex justify="space-between" align="center">
            <Box style={{ width: '70%' }}>
              <Title order={5}>Delete Data</Title>
              <Text>
                This will delete the live
                <span style={{ fontWeight: 'bold' }}>
                  {' '}
                  {studyId}
                  {' '}
                </span>
                database. Since this does not create a snapshot the data will be permanently deleted and cannot be restored.
              </Text>
            </Box>
            <Tooltip label="Delete Data">
              <Button
                color="red"
                sx={{ '&[data-disabled]': { pointerEvents: 'all' } }}
                onClick={() => setModalDeleteLiveOpened(true)}
              >
                Delete
              </Button>
            </Tooltip>
          </Flex>

          <Flex mt={40} direction="column">
            <Flex style={{ borderBottom: '1px solid #dedede' }} direction="row" justify="space-between" mb={15} pb={15}>
              <Title order={5}>Snapshots</Title>
            </Flex>
            <div style={{ position: 'relative' }}>
              <LoadingOverlay visible={snapshotListLoading} />
              { snapshots.length > 0 ? snapshots.map(
                (datasetName: string) => (
                  <Flex key={datasetName} justify="space-between" mb={10}>
                    <Text>{datasetName}</Text>
                    <Flex direction="row" gap={10}>
                      <Tooltip label="Restore Snapshot">
                        <ActionIcon color="blue" variant="subtle" onClick={() => { openRestoreSnapshotModal(datasetName); }}><IconRefresh /></ActionIcon>
                      </Tooltip>
                      <Tooltip label="Delete Snapshot">
                        <ActionIcon color="red" variant="subtle" onClick={() => { setModalDeleteSnapshotOpened(true); setCurrentSnapshot(datasetName); }}><IconTrashX /></ActionIcon>
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
        title={<Text>Archive Data</Text>}
      >
        <Box>
          <Text mb={30}>This will create a snapshot of the live database and remove the data from the live database.</Text>
          <TextInput
            label="To archive this data, please enter the name of the study."
            placeholder={studyId}
            onChange={(event) => setDeleteValue(event.target.value)}
          />
          <Flex mt={30} justify="right">
            <Button mr={5} variant="subtle" color="dark" onClick={() => { setModalArchiveOpened(false); setDeleteValue(''); }}>
              Cancel
            </Button>
            <Button color="red" onClick={() => handleArchiveData()} disabled={deleteValue !== studyId}>
              Archive
            </Button>
          </Flex>
        </Box>
      </Modal>

      <Modal
        opened={modalDeleteSnapshotOpened}
        onClose={() => { setModalDeleteSnapshotOpened(false); setDeleteValue(''); }}
        title={<Text>Delete Snapshot</Text>}
      >
        <Box>
          <Text mb={30}>
            This will permanently remove this snapshot. This action is
            {' '}
            <Text span fw={700}>irreversible</Text>
            .
          </Text>
          <TextInput
            label="To delete this snapshot, please enter the name of the study."
            placeholder={studyId}
            onChange={(event) => setDeleteValue(event.target.value)}
          />
          <Flex mt={30} justify="right">
            <Button mr={5} variant="subtle" color="dark" onClick={() => { setModalDeleteSnapshotOpened(false); setDeleteValue(''); }}>
              Cancel
            </Button>
            <Button color="red" onClick={() => handleDeleteSnapshot()} disabled={deleteValue !== studyId}>
              Delete
            </Button>
          </Flex>
        </Box>
      </Modal>

      <Modal
        opened={modalDeleteLiveOpened}
        onClose={() => { setModalDeleteLiveOpened(false); setDeleteValue(''); }}
        title={<Text>Delete Live Data</Text>}
      >
        <Box>
          <Text mb={30}>
            This will permanently delete the live
            <span style={{ fontWeight: 'bold' }}>
              {' '}
              {studyId}
              {' '}
            </span>
            data. This action is
            {' '}
            <Text span fw={700}>irreversible</Text>
            . Please consider using archive data to create a snapshot of the live data before deleting.
          </Text>
          <TextInput
            label="To delete this live data, please enter the name of the study."
            placeholder={studyId}
            onChange={(event) => setDeleteValue(event.target.value)}
          />
          <Flex mt={30} justify="right">
            <Button mr={5} variant="subtle" color="dark" onClick={() => { setModalDeleteLiveOpened(false); setDeleteValue(''); }}>
              Cancel
            </Button>
            <Button color="red" onClick={() => handleDeleteLive()} disabled={deleteValue !== studyId}>
              Delete
            </Button>
          </Flex>
        </Box>
      </Modal>
    </>
  );
}
