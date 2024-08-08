import {
  Text, LoadingOverlay, Box, Title, Flex, Modal, TextInput, Button, Tooltip, ActionIcon, Space,
} from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import { IconTrashX, IconRefresh, IconPencil } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { openConfirmModal } from '@mantine/modals';
import { useStorageEngine } from '../../../storage/storageEngineHooks';
import {
  FirebaseStorageEngine, FirebaseError, FirebaseActionResponse, SnapshotNameItem,
} from '../../../storage/engines/FirebaseStorageEngine';

export function DataManagementAccordionItem({ studyId, refresh }: { studyId: string, refresh: () => Promise<void> }) {
  const [modalArchiveOpened, setModalArchiveOpened] = useState<boolean>(false);
  const [modalDeleteSnapshotOpened, setModalDeleteSnapshotOpened] = useState<boolean>(false);
  const [modalRenameSnapshotOpened, setModalRenameSnapshotOpened] = useState<boolean>(false);
  const [modalDeleteLiveOpened, setModalDeleteLiveOpened] = useState<boolean>(false);
  const [modalErrorOpened, setModalErrorOpened] = useState<boolean>(false);
  const [error, setError] = useState<FirebaseError | null>(null);

  const [currentSnapshot, setCurrentSnapshot] = useState<string>('');

  const [snapshots, setSnapshots] = useState<SnapshotNameItem[]>([]);

  const [deleteValue, setDeleteValue] = useState<string>('');
  const [renameValue, setRenameValue] = useState<string>('');

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type FirebaseAction = (...args: any[]) => Promise<FirebaseActionResponse>;

  // Generalized snapshot action handler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snapshotAction = async (action: FirebaseAction, ...args: any[]) => {
    setLoading(true);
    const response: FirebaseActionResponse = await action(...args);
    if (response.status === 'SUCCESS') {
      refreshSnapshots();
      setLoading(false);
      await refresh();
      if (response.notification) {
        notifications.show({
          title: response.notification.title,
          color: response.notification.color ? response.notification.color : undefined,
          message: response.notification.message,
        });
      }
    } else {
      setLoading(false);
      setError(response.error);
      setModalErrorOpened(true);
    }
  };

  const handleCreateSnapshot = async () => {
    await snapshotAction(storageEngine.createSnapshot.bind(storageEngine), studyId, false);
  };

  const handleArchiveData = async () => {
    setDeleteValue('');
    setModalArchiveOpened(false);
    await snapshotAction(storageEngine.createSnapshot.bind(storageEngine), studyId, true);
  };

  const handleRenameSnapshot = async () => {
    setModalRenameSnapshotOpened(false);
    await snapshotAction(storageEngine.createSnapshot.bind(storageEngine), currentSnapshot, renameValue);
  };

  const handleRestoreSnapshot = async (snapshot: string) => {
    await snapshotAction(storageEngine.restoreSnapshot.bind(storageEngine), studyId, snapshot);
  };

  const handleDeleteSnapshot = async () => {
    setDeleteValue('');
    setModalDeleteSnapshotOpened(false);
    await snapshotAction(storageEngine.removeSnapshotOrLive.bind(storageEngine), currentSnapshot, true);
  };

  const handleDeleteLive = async () => {
    setDeleteValue('');
    setModalDeleteLiveOpened(false);
    await snapshotAction(storageEngine.removeSnapshotOrLive.bind(storageEngine), studyId, true);
  };

  const openCreateSnapshotModal = () => openConfirmModal({
    title: 'Create a Snapshot',
    children: (
      <Text mb={30}>This will create a snapshot of the live database without impacting the live data.</Text>
    ),
    labels: { confirm: 'Create', cancel: 'Cancel' },
    // confirmProps: { color: 'blue' },
    cancelProps: { variant: 'subtle', color: 'dark' },
    onCancel: () => { },
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
    onCancel: () => { },
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
          {snapshots.length > 0
            ? snapshots.map(
              (snapshotItem: SnapshotNameItem) => (
                <Flex key={snapshotItem.originalName} justify="space-between" mb="xs">
                  <Text>{snapshotItem.alternateName}</Text>
                  <Flex direction="row" gap="xs">
                    <Tooltip label="Rename">
                      <ActionIcon
                        color="green"
                        variant="subtle"
                        onClick={() => { setModalRenameSnapshotOpened(true); setCurrentSnapshot(snapshotItem.originalName); }}
                      >
                        <IconPencil />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Restore Snapshot">
                      <ActionIcon
                        color="blue"
                        variant="subtle"
                        onClick={() => { openRestoreSnapshotModal(snapshotItem.originalName); }}
                      >
                        <IconRefresh />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Delete Snapshot">
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={() => { setModalDeleteSnapshotOpened(true); setCurrentSnapshot(snapshotItem.originalName); }}
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
        opened={modalRenameSnapshotOpened}
        onClose={() => { setModalRenameSnapshotOpened(false); setRenameValue(''); }}
        title={<Text>Rename Snapshot</Text>}
      >
        <TextInput
          label="Enter the new name of the snapshot."
          placeholder={currentSnapshot}
          onChange={(event) => setRenameValue(event.target.value)}
        />

        <Flex mt="sm" justify="right">
          <Button mr={5} variant="subtle" color="dark" onClick={() => { setModalRenameSnapshotOpened(false); setRenameValue(''); }}>
            Cancel
          </Button>
          <Button color="green" onClick={handleRenameSnapshot} disabled={!renameValue || renameValue.length === 0}>
            Rename
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

      <Modal
        opened={modalErrorOpened}
        onClose={() => setModalErrorOpened(false)}
        title={<Text>{error?.title}</Text>}
      >
        <Text mb="sm">{error?.message}</Text>
        <Flex mt="sm" justify="right">
          <Button mr={5} onClick={() => setModalErrorOpened(false)}>
            Okay
          </Button>
        </Flex>
      </Modal>
    </>
  );
}
