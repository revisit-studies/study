import {
  Text, LoadingOverlay, Box, Title, Flex, Modal, TextInput, Button, Tooltip, ActionIcon, Space,
} from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import { IconTrashX, IconRefresh } from '@tabler/icons-react';
import { openConfirmModal } from '@mantine/modals';
import { useStorageEngine } from '../../../storage/storageEngineHooks';
import { FirebaseStorageEngine } from '../../../storage/engines/FirebaseStorageEngine';

export function DataManagementAccordionItem({ studyId, refresh }: { studyId: string, refresh: () => Promise<void> }) {
  const [modalArchiveOpened, setModalArchiveOpened] = useState<boolean>(false);
  const [modalDeleteSnapshotOpened, setModalDeleteSnapshotOpened] = useState<boolean>(false);
  const [modalDeleteLiveOpened, setModalDeleteLiveOpened] = useState<boolean>(false);

  const [currentSnapshot, setCurrentSnapshot] = useState<string>('');

  const [snapshots, setSnapshots] = useState<string[]>([]);

  const [deleteValue, setDeleteValue] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [snapshotListLoading, setSnapshotListLoading] = useState<boolean>(false);

  const { storageEngine: storageEngineBadType } = useStorageEngine();
  const storageEngine = storageEngineBadType as FirebaseStorageEngine; // We're guaranteed to have a FirebaseStorageEngine here

  // Used to fetch archived datasets
  const refreshSnapshots = useCallback(async () => {
    setSnapshotListLoading(true);
    const currSnapshots = await storageEngine.getSnapshots(studyId);
    setSnapshots(currSnapshots);
    setSnapshotListLoading(false);
  }, [storageEngine, studyId]);

  useEffect(() => {
    refreshSnapshots();
  }, [refreshSnapshots]);

  const handleCreateSnapshot = async () => {
    setLoading(true);
    await storageEngine.createSnapshot(studyId, false);
    refreshSnapshots();
    setLoading(false);
    await refresh();
  };

  const handleArchiveData = async () => {
    setLoading(true);
    setDeleteValue('');
    setModalArchiveOpened(false);
    await storageEngine.createSnapshot(studyId, true);
    refreshSnapshots();
    setLoading(false);
    await refresh();
  };

  const handleRestoreSnapshot = async (snapshot: string) => {
    setLoading(true);
    await storageEngine.restoreSnapshot(studyId, snapshot);
    refreshSnapshots();
    setLoading(false);
    await refresh();
  };

  const handleDeleteSnapshot = async () => {
    setLoading(true);
    setDeleteValue('');
    setModalDeleteSnapshotOpened(false);
    await storageEngine.removeSnapshotOrLive(currentSnapshot, true);
    refreshSnapshots();
    setLoading(false);
    await refresh();
  };

  const handleDeleteLive = async () => {
    setLoading(true);
    setDeleteValue('');
    setModalDeleteLiveOpened(false);
    await storageEngine.removeSnapshotOrLive(studyId, true);
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
      <Flex justify="space-between" align="center">
        <Box style={{ width: '70%' }}>
          <Title order={5}>Create a Snapshot</Title>
          <Text>
            This will create a snapshot of the live
            {' '}
            <Text span fw={700}>{studyId}</Text>
            {' '}
            database. It will
            {' '}
            <Text span fw={700} fs="italic">not</Text>
            {' '}
            remove this data from the live database. The current study data can be restored from a snapshot at any time.
          </Text>
        </Box>

        <Tooltip label="Create a snapshot">
          <Button onClick={openCreateSnapshotModal}>
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
            {' '}
            <Text span fw={700}>{studyId}</Text>
            {' '}
            database. It will then remove this data from the live database. The current study data can be restored from a snapshot at any time.
          </Text>
        </Box>

        <Tooltip label="Snapshot and Delete Data">
          <Button color="red" onClick={() => setModalArchiveOpened(true)}>
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
            {' '}
            <Text span fw={700}>{studyId}</Text>
            {' '}
            database. Since this does not create a snapshot the data will be permanently deleted and cannot be restored.
          </Text>
        </Box>

        <Tooltip label="Delete Data">
          <Button color="red" onClick={() => setModalDeleteLiveOpened(true)}>
            Delete
          </Button>
        </Tooltip>
      </Flex>

      <Space h="xl" />

      <Flex direction="column">
        <Flex style={{ borderBottom: '1px solid #dedede' }} direction="row" justify="space-between" mb="xs" pb="sm">
          <Title order={5}>Snapshots</Title>
        </Flex>

        {/* Position relative keeps the loading overlay only on the list */}
        <Box style={{ position: 'relative' }}>
          <LoadingOverlay visible={snapshotListLoading} />
          { snapshots.length > 0
            ? snapshots.map(
              (datasetName: string) => (
                <Flex key={datasetName} justify="space-between" mb="xs">
                  <Text>{datasetName}</Text>
                  <Flex direction="row" gap="xs">
                    <Tooltip label="Restore Snapshot">
                      <ActionIcon
                        color="blue"
                        variant="subtle"
                        onClick={() => { openRestoreSnapshotModal(datasetName); }}
                      >
                        <IconRefresh />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Delete Snapshot">
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={() => { setModalDeleteSnapshotOpened(true); setCurrentSnapshot(datasetName); }}
                      >
                        <IconTrashX />
                      </ActionIcon>
                    </Tooltip>
                  </Flex>
                </Flex>
              ),
            )
            : <Text>No snapshots.</Text>}
        </Box>
      </Flex>

      <Modal
        opened={modalArchiveOpened}
        onClose={() => { setModalArchiveOpened(false); setDeleteValue(''); }}
        title={<Text>Archive Data</Text>}
      >
        <Text mb="sm">This will create a snapshot of the live database and remove the data from the live database.</Text>

        <TextInput
          label="To archive this data, please enter the name of the study."
          placeholder={studyId}
          onChange={(event) => setDeleteValue(event.target.value)}
        />

        <Flex mt="sm" justify="right">
          <Button mr={5} variant="subtle" color="dark" onClick={() => { setModalArchiveOpened(false); setDeleteValue(''); }}>
            Cancel
          </Button>
          <Button color="red" onClick={handleArchiveData} disabled={deleteValue !== studyId}>
            Archive
          </Button>
        </Flex>
      </Modal>

      <Modal
        opened={modalDeleteSnapshotOpened}
        onClose={() => { setModalDeleteSnapshotOpened(false); setDeleteValue(''); }}
        title={<Text>Delete Snapshot</Text>}
      >
        <Text mb="sm">
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

        <Flex mt="sm" justify="right">
          <Button mr={5} variant="subtle" color="dark" onClick={() => { setModalDeleteSnapshotOpened(false); setDeleteValue(''); }}>
            Cancel
          </Button>
          <Button color="red" onClick={handleDeleteSnapshot} disabled={deleteValue !== studyId}>
            Delete
          </Button>
        </Flex>
      </Modal>

      <Modal
        opened={modalDeleteLiveOpened}
        onClose={() => { setModalDeleteLiveOpened(false); setDeleteValue(''); }}
        title={<Text>Delete Live Data</Text>}
      >
        <Text mb="sm">
          This will permanently delete the live
          {' '}
          <Text span fw={700}>{studyId}</Text>
          {' '}
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

        <Flex mt="sm" justify="right">
          <Button mr={5} variant="subtle" color="dark" onClick={() => { setModalDeleteLiveOpened(false); setDeleteValue(''); }}>
            Cancel
          </Button>
          <Button color="red" onClick={handleDeleteLive} disabled={deleteValue !== studyId}>
            Delete
          </Button>
        </Flex>
      </Modal>
    </>
  );
}
