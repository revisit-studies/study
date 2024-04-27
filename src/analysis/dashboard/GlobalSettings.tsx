import {
  Anchor, Card, Container, Image, Text, UnstyledButton, LoadingOverlay, Box, Title, Switch, Flex, Modal, TextInput, Button,
} from '@mantine/core';

import { useForm, isEmail } from '@mantine/form';
import { useEffect, useState } from 'react';
import {
  getAuth, signInWithPopup, GoogleAuthProvider,
} from '@firebase/auth';
import { IconUserPlus, IconAt, IconTrashX } from '@tabler/icons-react';
import { useAuth } from '../../store/hooks/useAuth';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { FirebaseStorageEngine } from '../../storage/engines/FirebaseStorageEngine';
import { StoredUser } from '../../storage/engines/StorageEngine';

export function GlobalSettings() {
  const { user, triggerAuth } = useAuth();
  const { storageEngine } = useStorageEngine();

  const [isAuthEnabled, setAuthEnabled] = useState<boolean>(false);
  const [authenticatedUsers, setAuthenticatedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modalAddOpened, setModalAddOpened] = useState<boolean>(false);
  const [modalRemoveOpened, setModalRemoveOpened] = useState<boolean>(false);
  const [modalEnableAuthOpened, setModalEnableAuthOpened] = useState<boolean>(false);
  const [userToRemove, setUserToRemove] = useState<string>('');
  const [enableAuthUser, setEnableAuthUser] = useState<StoredUser|null>(null);

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
        if (adminUsers && adminUsers.adminUsersList) {
          setAuthenticatedUsers(adminUsers?.adminUsersList.map((storedUser:StoredUser) => storedUser.email));
        }
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
        console.warn(error.message);
      }
      return auth.currentUser;
    }
    return null;
  };

  const handleEnableAuth = async () => {
    setLoading(true);
    if (storageEngine instanceof FirebaseStorageEngine) {
      const newUser = await signInWithGoogle();
      if (newUser && newUser.email) {
        setEnableAuthUser({
          email: newUser.email,
          uid: newUser.uid,
        });
      }
      setModalEnableAuthOpened(true);
    }
    setLoading(false);
  };

  const confirmEnableAuth = async (rootUser: StoredUser| null) => {
    setLoading(true);
    if (storageEngine instanceof FirebaseStorageEngine) {
      if (rootUser) {
        await storageEngine.changeAuth(true);
        await storageEngine.addAdminUser(rootUser);
        setAuthenticatedUsers([rootUser.email]);
        setAuthEnabled(true);
        triggerAuth();
      }
    }
    setModalEnableAuthOpened(false);
    setLoading(false);
  };

  const handleAddUser = async () => {
    setLoading(true);
    if (storageEngine instanceof FirebaseStorageEngine) {
      await storageEngine.addAdminUser({ email: form.values.email, uid: null });
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
          {isAuthEnabled
            ? <Flex><Text>Authentication is enabled.</Text></Flex>
            : (
              <Flex justify="space-between">
                <Box>
                  <Text>Authentication is currently disabled.</Text>
                </Box>
                <Button
                  onClick={() => handleEnableAuth()}
                  color="green"
                >
                  Enable Authentication
                </Button>
              </Flex>
            )}
          { isAuthEnabled
            ? (
              <Flex mt={40} direction="column">
                <Flex style={{ borderBottom: '1px solid #dedede' }} direction="row" justify="space-between" mb={15} pb={15}>
                  <Title order={6}>Enabled Users</Title>
                  <IconUserPlus style={{ cursor: 'pointer' }} onClick={() => setModalAddOpened(true)} />
                </Flex>
                { authenticatedUsers.length > 0 ? authenticatedUsers.map(
                  (storedUser:string) => (
                    <Flex key={storedUser} justify="space-between" mb={10}>
                      <Text>{storedUser}</Text>
                      {storedUser === user.user?.email ? <Text color="blue" size="xs">You</Text>
                        : <IconTrashX style={{ cursor: 'pointer', color: 'red', width: '20px' }} onClick={() => handleRemoveUser(storedUser)} />}
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
      <Modal
        opened={modalEnableAuthOpened}
        size="md"
        onClose={() => setModalRemoveOpened(false)}
        title={(
          <Text fw={700}>
            Enable Authentication?
          </Text>
)}
      >
        <Text mt={40}>
          User
          {' '}
          <b>{enableAuthUser?.email}</b>
          {' '}
          will be added as an administrator to this application. After enabling authentication, you&apos;ll be able to add additional users below. This action cannot be undone.
        </Text>
        <Flex mt={40} justify="right">
          <Button mr={5} variant="subtle" color="red" onClick={() => setModalEnableAuthOpened(false)}>
            Cancel
          </Button>
          <Button onClick={() => confirmEnableAuth(enableAuthUser)}>
            Yes, I&apos;m sure.
          </Button>

        </Flex>
      </Modal>
      <LoadingOverlay visible={loading} />
    </>

  );
}
