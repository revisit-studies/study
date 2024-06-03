import {
  Card, Container, Text, LoadingOverlay, Box, Title, Flex, Modal, TextInput, Button, Tooltip, ActionIcon,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { IconTrashX, IconRefresh } from '@tabler/icons-react';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { FirebaseStorageEngine } from '../../storage/engines/FirebaseStorageEngine';

export function DataManagementBoard({ studyId }:{ studyId:string}) {
  const [modalDeleteOpened, setModalDeleteOpened] = useState<boolean>(false);
  const [modalArchiveOpened, setModalArchiveOpened] = useState<boolean>(false);
  const [modalRestoreOpened, setModalRestoreOpened] = useState<boolean>(false);
  const [modalDeleteArchiveOpened, setModalDeleteArchiveOpened] = useState<boolean>(false);

  const [currentArchive, setCurrentArchive] = useState<string>('');

  const [archivedDatasets, setArchivedDatasets] = useState<string[]>([]);

  const [deleteValue, setDeleteValue] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [archiveListLoading, setArchiveListLoading] = useState<boolean>(false);

  const [archiveActionFlag, setArchiveActionFlag] = useState<boolean>(false);

  const { storageEngine } = useStorageEngine();

  // Used to fetch archived datasets
  useEffect(() => {
    async function fetchData() {
      setArchiveListLoading(true);
      if (storageEngine instanceof FirebaseStorageEngine) {
        const currArchivedCollections = await storageEngine.getArchives(studyId);
        setArchivedDatasets(currArchivedCollections);
      }
      setArchiveListLoading(false);
    }
    fetchData();
  }, [archiveActionFlag]);

  const handleArchiveData = async () => {
    setLoading(true);
    if (storageEngine instanceof FirebaseStorageEngine) {
      await storageEngine.archiveStudyData(studyId, false);
      setModalArchiveOpened(false);
    }
    setArchiveActionFlag((prev) => !prev);
    setLoading(false);
  };

  const handleArchiveAndDeleteData = async () => {
    setLoading(true);
    setDeleteValue('');
    if (storageEngine instanceof FirebaseStorageEngine) {
      await storageEngine.archiveStudyData(studyId, true);
      setModalDeleteOpened(false);
    }
    setArchiveActionFlag((prev) => !prev);
    setLoading(false);
  };

  const handleDeleteArchive = async () => {
    setLoading(true);
    setDeleteValue('');
    if (storageEngine instanceof FirebaseStorageEngine) {
      await storageEngine.removeArchive(currentArchive);
      setModalDeleteArchiveOpened(false);
    }
    setArchiveActionFlag((prev) => !prev);
    setLoading(false);
  };

  const handleRestoreArchive = async () => {
    setLoading(true);
    if (storageEngine instanceof FirebaseStorageEngine) {
      await storageEngine.restoreArchive(studyId, currentArchive);
      setModalRestoreOpened(false);
    }
    setArchiveActionFlag((prev) => !prev);
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
                onClick={() => setModalArchiveOpened(true)}
              >
                Archive Only
              </Button>
            </Tooltip>
          </Flex>
          <Flex justify="space-between" align="center">
            <Box style={{ width: '70%' }}>
              <Title order={4}>Archive and delete study data</Title>
              <Text>
                This wil create an archived dataset of the
                <span style={{ fontWeight: 'bold' }}>{studyId}</span>
                {' '}
                data. It will then remove this data from the current dataset. Archived datasets can be restored at any time.
              </Text>
            </Box>
            <Tooltip label="Archive and Delete study data">
              <Button
                color="red"
                sx={{ '&[data-disabled]': { pointerEvents: 'all' } }}
                onClick={() => setModalDeleteOpened(true)}
              >
                Archive and Delete
              </Button>
            </Tooltip>
          </Flex>
          <Flex mt={40} direction="column">
            <Flex style={{ borderBottom: '1px solid #dedede' }} direction="row" justify="space-between" mb={15} pb={15}>
              <Title order={4}>Archived Datasets</Title>
            </Flex>
            <div style={{ position: 'relative' }}>
              <LoadingOverlay visible={archiveListLoading} />
              { archivedDatasets.length > 0 ? archivedDatasets.map(
                (datasetName:string) => (
                  <Flex key={datasetName} justify="space-between" mb={10}>
                    <Text>{datasetName}</Text>
                    <Flex direction="row" gap={10}>
                      <Tooltip label="Restore Archive">
                        <ActionIcon variant="subtle" onClick={() => { setModalRestoreOpened(true); setCurrentArchive(datasetName); }}><IconRefresh color="green" /></ActionIcon>
                      </Tooltip>
                      <Tooltip label="Delete Archive">
                        <ActionIcon variant="subtle" onClick={() => { setModalDeleteArchiveOpened(true); setCurrentArchive(datasetName); }}><IconTrashX color="red" /></ActionIcon>
                      </Tooltip>
                    </Flex>
                  </Flex>
                ),
              ) : <Text>No archived datasets.</Text>}
            </div>
          </Flex>

        </Card>
      </Container>

      <Modal
        opened={modalDeleteOpened}
        onClose={() => { setModalDeleteOpened(false); setDeleteValue(''); }}
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
            <Button mr={5} variant="subtle" color="red" onClick={() => { setModalDeleteOpened(false); setDeleteValue(''); }}>
              Cancel
            </Button>
            <Button onClick={() => handleArchiveAndDeleteData()} disabled={deleteValue !== studyId}>
              Archive and Delete
            </Button>
          </Flex>
        </Box>
      </Modal>

      <Modal
        opened={modalArchiveOpened}
        onClose={() => setModalArchiveOpened(false)}
        title={<Title order={4}>Archive Current Data</Title>}
      >
        <Box>
          <Text mb={30}>This will create an archive of the current study data and remove the current study data. An archive can be restored at any time.</Text>
          <Flex mt={30} justify="right">
            <Button mr={5} variant="subtle" color="red" onClick={() => setModalArchiveOpened(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleArchiveData()}>
              Archive
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
            <Button onClick={() => handleRestoreArchive()}>
              Restore
            </Button>
          </Flex>
        </Box>
      </Modal>

      <Modal
        opened={modalDeleteArchiveOpened}
        onClose={() => { setModalDeleteArchiveOpened(false); setDeleteValue(''); }}
        title={<Title order={4}>Delete Archive</Title>}
      >
        <Box>
          <Text mb={30}>This will permanently remove this archive.</Text>
          <TextInput
            label="To delete this archive, please 'delete' in the box below."
            placeholder="delete"
            onChange={(event) => setDeleteValue(event.target.value)}
          />
          <Flex mt={30} justify="right">
            <Button mr={5} variant="subtle" color="red" onClick={() => { setModalDeleteArchiveOpened(false); setDeleteValue(''); }}>
              Cancel
            </Button>
            <Button onClick={() => handleDeleteArchive()} disabled={deleteValue !== 'delete'}>
              Delete Archive
            </Button>
          </Flex>
        </Box>
      </Modal>

    </>
  );
}
