import {
  Text, LoadingOverlay, Box, Title, Flex, Modal, TextInput, Button, Tooltip, Space, Table,
} from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import { IconTrashX, IconRefresh, IconPencil } from '@tabler/icons-react';
import { openConfirmModal } from '@mantine/modals';
import { useStorageEngine } from '../../../storage/storageEngineHooks';
import { showNotification, RevisitNotification } from '../../../utils/notifications';
import { DownloadButtons } from '../../../components/downloader/DownloadButtons';
import { ActionResponse, SnapshotDocContent } from '../../../storage/engines/types';
import { ParticipantData } from '../../../storage/types';

type SnapshotAction =
  | { type: 'create', archive: boolean }
  | { type: 'rename', snapshot: string, newName: string }
  | { type: 'restore', snapshot: string }
  | { type: 'deleteSnapshot', snapshot: string }
  | { type: 'deleteLive' };

export function DataManagementAccordionItem({ studyId, refresh }: { studyId: string, refresh: () => Promise<Record<number, ParticipantData>> }) {
  const [modalArchiveOpened, setModalArchiveOpened] = useState<boolean>(false);
  const [modalDeleteSnapshotOpened, setModalDeleteSnapshotOpened] = useState<boolean>(false);
  const [modalRenameSnapshotOpened, setModalRenameSnapshotOpened] = useState<boolean>(false);
  const [modalDeleteLiveOpened, setModalDeleteLiveOpened] = useState<boolean>(false);

  const [currentSnapshot, setCurrentSnapshot] = useState<string>('');

  const [snapshots, setSnapshots] = useState<SnapshotDocContent>({});

  const [deleteValue, setDeleteValue] = useState<string>('');
  const [renameValue, setRenameValue] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [snapshotListLoading, setSnapshotListLoading] = useState<boolean>(false);

  const { storageEngine } = useStorageEngine();

  // Used to fetch archived datasets
  const refreshSnapshots = useCallback(async () => {
    if (!storageEngine) {
      return;
    }
    setSnapshotListLoading(true);
    const currSnapshots = await storageEngine.getSnapshots(studyId);
    setSnapshots(currSnapshots);
    setSnapshotListLoading(false);
  }, [storageEngine, studyId]);

  useEffect(() => {
    refreshSnapshots();
  }, [refreshSnapshots]);

  if (!storageEngine) {
    return null;
  }

  // Strongly-typed action dispatcher
  const snapshotAction = async (action: SnapshotAction) => {
    setLoading(true);
    let response: ActionResponse;

    switch (action.type) {
      case 'create':
        response = await storageEngine.createSnapshot(studyId, action.archive);
        break;
      case 'rename':
        response = await storageEngine.renameSnapshot(action.snapshot, action.newName, studyId);
        break;
      case 'restore':
        response = await storageEngine.restoreSnapshot(studyId, action.snapshot);
        break;
      case 'deleteSnapshot':
        response = await storageEngine.removeSnapshotOrLive(action.snapshot, studyId);
        break;
      case 'deleteLive':
        response = await storageEngine.removeSnapshotOrLive(studyId, studyId);
        break;
      default:
        setLoading(false);
        throw new Error('Unknown action');
    }

    if (response.status === 'SUCCESS') {
      await refreshSnapshots();
      setLoading(false);
      await refresh();
      response.notifications?.forEach((notification: RevisitNotification) => showNotification(notification));
    } else {
      setLoading(false);
      showNotification({ title: response.error.title, message: response.error.message, color: 'red' });
    }
  };

  // Handlers
  const handleCreateSnapshot = () => snapshotAction({ type: 'create', archive: false });
  const handleArchiveData = () => { setDeleteValue(''); setModalArchiveOpened(false); snapshotAction({ type: 'create', archive: true }); };
  const handleRenameSnapshot = () => { setModalRenameSnapshotOpened(false); snapshotAction({ type: 'rename', snapshot: currentSnapshot, newName: renameValue }); };
  const handleRestoreSnapshot = (snapshot: string) => snapshotAction({ type: 'restore', snapshot });
  const handleDeleteSnapshot = () => { setDeleteValue(''); setModalDeleteSnapshotOpened(false); snapshotAction({ type: 'deleteSnapshot', snapshot: currentSnapshot }); };
  const handleDeleteLive = () => { setDeleteValue(''); setModalDeleteLiveOpened(false); snapshotAction({ type: 'deleteLive' }); };

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

  const getDateFromSnapshotName = (snapshotName: string): string | null => {
    const regex = /-snapshot-(.+)$/;
    const match = snapshotName.match(regex);

    if (match && match[1]) {
      const dateStuff = match[1];
      return dateStuff.replace('T', ' ');
    }
    return null;
  };

  const fetchParticipants = async (snapshotName: string) => {
    const strippedFilename = snapshotName.slice(snapshotName.indexOf('-') + 1);
    return await storageEngine.getAllParticipantsData(strippedFilename);
  };

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
          {Object.keys(snapshots).length > 0
            ? (
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Snapshot Name</Table.Th>
                    <Table.Th>Date Created</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {Object.entries(snapshots).map(
                    ([key, snapshotItem]) => (
                      <Table.Tr key={key}>
                        <Table.Td>{snapshotItem.name}</Table.Td>
                        <Table.Td>{getDateFromSnapshotName(key)}</Table.Td>
                        <Table.Td>
                          <Flex>
                            <Tooltip label="Rename">
                              <Button
                                color="green"
                                variant="light"
                                px={4}
                                style={{ margin: '0px 5px' }}
                                onClick={() => { setModalRenameSnapshotOpened(true); setCurrentSnapshot(key); }}
                              >
                                <IconPencil />
                              </Button>
                            </Tooltip>
                            <Tooltip label="Restore Snapshot">
                              <Button
                                color="blue"
                                variant="light"
                                px={4}
                                style={{ margin: '0px 5px' }}
                                onClick={() => { openRestoreSnapshotModal(key); }}
                              >
                                <IconRefresh />
                              </Button>
                            </Tooltip>

                            <Tooltip label="Delete Snapshot">
                              <Button
                                color="red"
                                px={4}
                                variant="light"
                                style={{ margin: '0px 10px 0px 5px' }}
                                onClick={() => { setModalDeleteSnapshotOpened(true); setCurrentSnapshot(key); }}
                              >
                                <IconTrashX />
                              </Button>
                            </Tooltip>
                            <DownloadButtons visibleParticipants={() => fetchParticipants(key)} studyId={studyId} gap="10px" fileName={snapshotItem.name} />
                          </Flex>
                        </Table.Td>
                      </Table.Tr>
                    ),
                  )}
                </Table.Tbody>
              </Table>
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
    </>
  );
}
