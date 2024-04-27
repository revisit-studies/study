import {
  Anchor, Card, Container, Image, Text, UnstyledButton, LoadingOverlay, Box, Title, Switch, Flex, Modal, TextInput, Button,
} from '@mantine/core';

import { useForm, isEmail } from '@mantine/form';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAuth, signInWithPopup, GoogleAuthProvider,
} from '@firebase/auth';
import { IconUserPlus, IconAt, IconTrashX } from '@tabler/icons-react';
import { useAuth } from '../../store/hooks/useAuth';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { FirebaseStorageEngine } from '../../storage/engines/FirebaseStorageEngine';
import { StoredUser } from '../../storage/engines/StorageEngine';

export function GlobalSettings() {
  const { user, logout } = useAuth();
  const { storageEngine } = useStorageEngine();

  const [isAuthEnabled, setAuthEnabled] = useState<boolean>(false);
  const [authenticatedUsers, setAuthenticatedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string|null>(null);
  const [modalAddOpened, setModalAddOpened] = useState<boolean>(false);
  const [modalRemoveOpened, setModalRemoveOpened] = useState<boolean>(false);
  const [userToRemove, setUserToRemove] = useState<string>('');

  const form = useForm({
    initialValues: {
      email: '',
    },
    validate: {
      email: isEmail('Invalid email'),
    },
  });

  useEffect(() => {
    const determineAuthenticationEnabled = async () => {
      setLoading(true);
      if (storageEngine instanceof FirebaseStorageEngine) {
        const authInfo = await storageEngine?.getUserManagementData('authentication');
        setAuthEnabled(authInfo?.isEnabled);
        const adminUsers = await storageEngine?.getUserManagementData('adminUsers');
        setAuthenticatedUsers(adminUsers?.adminUsersList.map((storedUser:StoredUser) => storedUser.email));
      } else {
        setAuthEnabled(false);
      }
      setLoading(false);
    };
    determineAuthenticationEnabled();
  }, []);

  const signInWithGoogle = async () => {
    if (storageEngine instanceof FirebaseStorageEngine) {
      const provider = new GoogleAuthProvider();
      const auth = getAuth();
      try {
        await signInWithPopup(auth, provider);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        setErrorMessage(error.message);
      }
    }
  };

  const handleChangeAuth = async () => {
    setLoading(true);
    if (storageEngine instanceof FirebaseStorageEngine) {
      const authInfo = await storageEngine.getUserManagementData('authentication');
      if (!authInfo?.isEnabled) {
        await signInWithGoogle();
      }
      await storageEngine.changeAuth(!authInfo?.isEnabled);
      const adminUsers = await storageEngine?.getUserManagementData('adminUsers');
      setAuthenticatedUsers(adminUsers?.adminUsersList.map((storedUser:StoredUser) => storedUser.email));
      setAuthEnabled(!isAuthEnabled);
    }
    setLoading(false);
  };

  const handleAddUser = async () => {
    setLoading(true);
    if (storageEngine instanceof FirebaseStorageEngine) {
      await storageEngine.addAdminUser(form.values.email);
      const adminUsers = await storageEngine.getUserManagementData('adminUsers');
      setAuthenticatedUsers(adminUsers?.adminUsersList.map((storedUser:StoredUser) => storedUser.email));
    }
    setLoading(false);
    setModalAddOpened(false);
    form.setValues({
      email: '',
    });
  };

  const handleRemoveUser = (inputUser:string) => {
    setModalRemoveOpened(true);
    setUserToRemove(inputUser);
  };

  const confirmRemoveUser = async () => {
    setLoading(true);
    if (storageEngine instanceof FirebaseStorageEngine) {
      await storageEngine.removeAdminUser(userToRemove);
      const adminUsers = await storageEngine.getUserManagementData('adminUsers');
      setAuthenticatedUsers(adminUsers?.adminUsersList.map((storedUser:StoredUser) => storedUser.email));
    }
    setModalRemoveOpened(false);
    setLoading(false);
  };

  return (
    <>
      <Container>
        <Card withBorder style={{ backgroundColor: '#FAFAFA' }}>
          <Title mb={20} order={3}>Authentication</Title>
          <Flex justify="space-between">
            <Text>Enable / Disable authentication</Text>
            <Switch
              checked={isAuthEnabled}
              onLabel={<Text fz="xs">ON</Text>}
              offLabel={<Text size="xs">OFF</Text>}
              onChange={(event) => handleChangeAuth()}
              color="green"
            />
          </Flex>
          { isAuthEnabled
            ? (
              <Flex mt={40} direction="column">
                <Flex direction="row" justify="space-between" mb={20}>
                  <Title order={6}>Enabled Users</Title>
                  <IconUserPlus style={{ marginTop: '2px', cursor: 'pointer' }} onClick={() => setModalAddOpened(true)} />
                </Flex>
                { authenticatedUsers.length > 0 ? authenticatedUsers.map(
                  (storedUser:string) => (
                    <Flex key={storedUser} justify="space-between" mb={10}>
                      <Text>{storedUser}</Text>
                      <IconTrashX style={{ cursor: 'pointer', color: 'red', width: '20px' }} onClick={() => handleRemoveUser(storedUser)} />
                    </Flex>
                  ),
                ) : null}
              </Flex>
            )
            : null}
        </Card>
      </Container>
      <Modal
        opened={modalAddOpened}
        onClose={() => setModalAddOpened(false)}
        title="Add Admin User"
      >
        <Box component="form" onSubmit={(form.onSubmit(() => handleAddUser()))}>
          <TextInput
            icon={<IconAt />}
            placeholder="User Gmail Account"
            {...form.getInputProps('email')}
          />
          <Flex mt={30} justify="right">
            <Button mr={5} variant="subtle" color="red" onClick={() => setModalAddOpened(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Save
            </Button>
          </Flex>
        </Box>
      </Modal>
      <Modal
        opened={modalRemoveOpened}
        size="large"
        onClose={() => setModalRemoveOpened(false)}
        title={(
          <Text fw={700}>
            Remove
            {userToRemove}
            ?
          </Text>
)}
      >
        <Text mt={40}>
          Are you sure you want to remove
          <b>{userToRemove}</b>
          {' '}
          as an administrator?
        </Text>
        <Flex mt={40} justify="right">
          <Button mr={5} variant="subtle" color="red" onClick={() => setModalRemoveOpened(false)}>
            Cancel
          </Button>
          <Button onClick={() => confirmRemoveUser()}>
            Yes, I&apos;m sure.
          </Button>

        </Flex>
      </Modal>
      <LoadingOverlay visible={loading} />
    </>

  );
}
