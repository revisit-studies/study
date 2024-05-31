import {
  Card, Container, Text, LoadingOverlay, Box, Title, Flex, Modal, TextInput, Button, Tooltip,
} from '@mantine/core';
import { useForm, isEmail } from '@mantine/form';
import { useEffect, useMemo, useState } from 'react';
import { IconUserPlus, IconAt, IconTrashX } from '@tabler/icons-react';
import { useAuth } from '../../store/hooks/useAuth';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { FirebaseStorageEngine } from '../../storage/engines/FirebaseStorageEngine';
import { StoredUser } from '../../storage/engines/StorageEngine';
import { signInWithGoogle } from '../../Login';
import { StudyConfig } from '../../parser/types';

export function DataManagementBoard({ studyConfig, studyId }:{studyConfig:StudyConfig, studyId:string}) {
  const [modalDeleteOpened, setModalDeleteOpened] = useState<boolean>(false);
  const [deleteValue, setDeleteValue] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { storageEngine } = useStorageEngine();

  const handleCopyCollection = async () => {
    setLoading(true);
    if (storageEngine instanceof FirebaseStorageEngine) {
      await storageEngine.copyCollection(studyId);
      setLoading(false);
    }
  };

  return (
    <>
      <LoadingOverlay visible={loading} />
      <Container>
        <Card withBorder style={{ backgroundColor: '#FAFAFA', justifySelf: 'left' }}>
          <Title mb={20} order={3}>Data Management</Title>
          <Flex justify="space-between">
            <Box>
              <Text>Delete Study Data</Text>
            </Box>
            <Tooltip label="Archive all study data">
              <Button
                color="red"
                sx={{ '&[data-disabled]': { pointerEvents: 'all' } }}
                onClick={() => setModalDeleteOpened(true)}
              >
                Delete Study Data
              </Button>
            </Tooltip>
          </Flex>
        </Card>
      </Container>
      <Modal
        opened={modalDeleteOpened}
        onClose={() => setModalDeleteOpened(false)}
        title="Delete All User Data For This Study"
      >
        <Box component="form">
          <Text mb={30}>This will delete all user data for this individual study.</Text>
          <TextInput
            label="To delete this data, please enter the name of the study."
            placeholder={studyId}
            onChange={(event) => setDeleteValue(event.target.value)}
          />
          <Flex mt={30} justify="right">
            <Button mr={5} variant="subtle" color="red" onClick={() => setModalDeleteOpened(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleCopyCollection()} disabled={deleteValue !== studyId}>
              Delete
            </Button>
          </Flex>
        </Box>
      </Modal>
    </>
  );
}
