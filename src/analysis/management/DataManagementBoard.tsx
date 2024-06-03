import {
  Card, Container, Text, LoadingOverlay, Box, Title, Flex, Modal, TextInput, Button, Tooltip, ActionIcon,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { IconTrashX, IconRefresh } from '@tabler/icons-react';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { FirebaseStorageEngine } from '../../storage/engines/FirebaseStorageEngine';

export function DataManagementBoard({ studyId }:{ studyId:string}) {
  const [modalArchiveOpened, setModalArchiveOpened] = useState<boolean>(false);
  const [modalCreateSnapshotOpened, setModalCreateSnapshotOpened] = useState<boolean>(false);
  const [modalRestoreOpened, setModalRestoreOpened] = useState<boolean>(false);
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
        const currArchivedCollections = await storageEngine.getSnapshots(studyId);
        setSnapshots(currArchivedCollections);
      }
      setSnapshotListLoading(false);
    }
    fetchData();
  }, [snapshotActionFlag]);

  const handleCreateSnapshot = async () => {
    setLoading(true);
    if (storageEngine instanceof FirebaseStorageEngine) {
      await storageEngine.createSnapshot(studyId, false);
      setModalCreateSnapshotOpened(false);
    }
    setSnapshotActionFlag((prev) => !prev);
    setLoading(false);
  };

  const handleArchiveData = async () => {
    setLoading(true);
    setDeleteValue('');
    if (storageEngine instanceof FirebaseStorageEngine) {
      await storageEngine.createSnapshot(studyId, true);
      setModalArchiveOpened(false);
    }
    setSnapshotActionFlag((prev) => !prev);
    setLoading(false);
  };

  const handleDeleteSnapshot = async () => {
    setLoading(true);
    setDeleteValue('');
    if (storageEngine instanceof FirebaseStorageEngine) {
      await storageEngine.removeSnapshot(currentSnapshot);
      setModalDeleteSnapshotOpened(false);
    }
    setSnapshotActionFlag((prev) => !prev);
    setLoading(false);
  };

  const handleRestoreSnapshot = async () => {
    setLoading(true);
    if (storageEngine instanceof FirebaseStorageEngine) {
      await storageEngine.restoreSnapshot(studyId, currentSnapshot);
      setModalRestoreOpened(false);
    }
    setSnapshotActionFlag((prev) => !prev);
    setLoading(false);
  };

  return (
    <>
      <LoadingOverlay visible={loading} />
      <Container>
        <Card withBorder style={{ backgroundColor: '#FAFAFA', justifySelf: 'left' }}>
          <Title mb={30} order={2}>Data Management</Title>
          <Flex mb={50} justify="space-between" align="center">
            <Box style={{ width: '70%' }}>
              <Title order={4}>Archive and study data</Title>
              <Text>
                This wil create an archived dataset of the
                <span style={{ fontWeight: 'bold' }}>{studyId}</span>
                {' '}
                data. It will
                <span style={{ fontStyle: 'italic', fontWeight: 'bold' }}>not</span>
                {' '}
                remove this data from the current dataset.
              </Text>
            </Box>
            <Tooltip label="Archive and Delete study data">
              <Button
                color="red"
                sx={{ '&[data-disabled]': { pointerEvents: 'all' } }}
                onClick={() => setModalCreateSnapshotOpened(true)}
              >
                Snapshot Data
              </Button>
            </Tooltip>
          </Flex>
          <Flex justify="space-between" align="center">
            <Box style={{ width: '70%' }}>
              <Title order={4}>Take a snapshot and delete data</Title>
              <Text>
                This wil create a snapshot of the current
                <span style={{ fontWeight: 'bold' }}>{studyId}</span>
                {' '}
                data. It will then remove this data from the current dataset. The current data can be restored to a snapshot at any time.
              </Text>
            </Box>
            <Tooltip label="Snapshot and Delete Data">
              <Button
                color="red"
                sx={{ '&[data-disabled]': { pointerEvents: 'all' } }}
                onClick={() => setModalArchiveOpened(true)}
              >
                Snapshot and Delete
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
                      <Tooltip label="Restore Archive">
                        <ActionIcon variant="subtle" onClick={() => { setModalRestoreOpened(true); setCurrentSnapshot(datasetName); }}><IconRefresh color="green" /></ActionIcon>
                      </Tooltip>
                      <Tooltip label="Delete Archive">
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
        title="Archive and Delete. This will create a separate archive of the dataset and then delete the existing data from this collection."
      >
        <Box>
          <Text mb={30}>This will create and archive and then delete all of the current study data.</Text>
          <TextInput
            label="To delete this data, please enter the name of the study."
            placeholder={studyId}
            onChange={(event) => setDeleteValue(event.target.value)}
          />
          <Flex mt={30} justify="right">
            <Button mr={5} variant="subtle" color="red" onClick={() => { setModalArchiveOpened(false); setDeleteValue(''); }}>
              Cancel
            </Button>
            <Button onClick={() => handleArchiveData()} disabled={deleteValue !== studyId}>
              Archive Data
            </Button>
          </Flex>
        </Box>
      </Modal>

      <Modal
        opened={modalCreateSnapshotOpened}
        onClose={() => setModalCreateSnapshotOpened(false)}
        title={<Title order={4}>Archive Current Data</Title>}
      >
        <Box>
          <Text mb={30}>This will create an archive of the current study data and remove the current study data. An archive can be restored at any time.</Text>
          <Flex mt={30} justify="right">
            <Button mr={5} variant="subtle" color="red" onClick={() => setModalCreateSnapshotOpened(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleCreateSnapshot()}>
              Take a Snapshot
            </Button>
          </Flex>
        </Box>
      </Modal>

      <Modal
        opened={modalRestoreOpened}
        onClose={() => setModalRestoreOpened(false)}
        title={<Title order={4}>Restore Archive</Title>}
      >
        <Box>
          <Text mb={30}>This will archive the current study data into a new archive and then copy the this archive back into the current study data. This archive will then be removed.</Text>
          <Flex mt={30} justify="right">
            <Button mr={5} variant="subtle" color="red" onClick={() => setModalRestoreOpened(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleRestoreSnapshot()}>
              Restore
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
          <Text mb={30}>This will permanently remove this archive.</Text>
          <TextInput
            label="To delete this archive, please 'delete' in the box below."
            placeholder="delete"
            onChange={(event) => setDeleteValue(event.target.value)}
          />
          <Flex mt={30} justify="right">
            <Button mr={5} variant="subtle" color="red" onClick={() => { setModalDeleteSnapshotOpened(false); setDeleteValue(''); }}>
              Cancel
            </Button>
            <Button onClick={() => handleDeleteSnapshot()} disabled={deleteValue !== 'delete'}>
              Delete Archive
            </Button>
          </Flex>
        </Box>
      </Modal>

    </>
  );
}
