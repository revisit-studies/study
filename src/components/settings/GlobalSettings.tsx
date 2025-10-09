import {
  Card, Container, Text, LoadingOverlay, Box, Title, Flex, Modal, TextInput, Button, Tooltip, ActionIcon,
} from '@mantine/core';
import { useForm, isEmail } from '@mantine/form';
import { useEffect, useMemo, useState } from 'react';
import { IconUserPlus, IconAt, IconTrashX } from '@tabler/icons-react';
import { useAuth } from '../../store/hooks/useAuth';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { StoredUser } from '../../storage/engines/types';
import { signIn } from '../../Login';
import { isCloudStorageEngine } from '../../storage/engines/utils';
import { SupabaseStorageEngine } from '../../storage/engines/SupabaseStorageEngine';

export function GlobalSettings() {
  const { user, triggerAuth, logout } = useAuth();
  const { storageEngine } = useStorageEngine();

  const [isAuthEnabled, setAuthEnabled] = useState<boolean>(false);
  const [authenticatedUsers, setAuthenticatedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modalAddOpened, setModalAddOpened] = useState<boolean>(false);
  const [modalRemoveOpened, setModalRemoveOpened] = useState<boolean>(false);
  const [modalEnableAuthOpened, setModalEnableAuthOpened] = useState<boolean>(false);
  const [modalEnableAuthErrorOpened, setModalEnableAuthErrorOpened] = useState<boolean>(false);
  const [userToRemove, setUserToRemove] = useState<string>('');
  const [enableAuthUser, setEnableAuthUser] = useState<StoredUser | null>(null);

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
      if (storageEngine && isCloudStorageEngine(storageEngine)) {
        const authInfo = await storageEngine?.getUserManagementData('authentication');
        setAuthEnabled(authInfo?.isEnabled || false);
        const adminUsers = await storageEngine?.getUserManagementData('adminUsers');
        if (adminUsers && adminUsers.adminUsersList) {
          setAuthenticatedUsers(adminUsers?.adminUsersList.map((storedUser: StoredUser) => storedUser.email).filter((x) => x !== null));
        }
      } else {
        setAuthEnabled(false);
      }
      setLoading(false);
    };
    determineAuthenticationEnabled();
  }, [storageEngine]);

  const handleEnableAuth = async () => {
    setLoading(true);
    if (storageEngine && isCloudStorageEngine(storageEngine)) {
      // Check if we're in supabase and have a session already
      if (storageEngine.getEngine() === 'supabase') {
        const { data } = await (storageEngine as unknown as SupabaseStorageEngine).getSession();
        if (data.session && data.session.user && data.session.user.email) {
          setEnableAuthUser({
            email: data.session.user.email,
            uid: data.session.user.id,
          });
          setModalEnableAuthOpened(true);
          setLoading(false);
          return;
        }
      }

      const newUser = await signIn(storageEngine, setLoading);
      if (newUser && newUser.email) {
        setEnableAuthUser({
          email: newUser.email,
          uid: newUser.uid,
        });
        setModalEnableAuthOpened(true);
      } else {
        setModalEnableAuthErrorOpened(true);
      }
    }
    setLoading(false);
  };

  const confirmEnableAuth = async (rootUser: StoredUser | null) => {
    setLoading(true);
    if (storageEngine && isCloudStorageEngine(storageEngine)) {
      if (rootUser) {
        await storageEngine.changeAuth(true);
        await storageEngine.addAdminUser(rootUser);
        setAuthenticatedUsers([rootUser.email!]);
        setAuthEnabled(true);
        triggerAuth();
      }
    }
    setModalEnableAuthOpened(false);
    setLoading(false);
  };

  const handleAddUser = async () => {
    setLoading(true);
    if (storageEngine && isCloudStorageEngine(storageEngine)) {
      await storageEngine.addAdminUser({ email: form.values.email, uid: null });
      const adminUsers = await storageEngine.getUserManagementData('adminUsers');
      setAuthenticatedUsers(adminUsers?.adminUsersList.map((storedUser: StoredUser) => storedUser.email).filter((x) => x !== null) || []);
    }
    setLoading(false);
    setModalAddOpened(false);
    form.setValues({
      email: '',
    });
  };

  const handleRemoveUser = (inputUser: string) => {
    setModalRemoveOpened(true);
    setUserToRemove(inputUser);
  };

  const confirmRemoveUser = async () => {
    setLoading(true);
    if (storageEngine && isCloudStorageEngine(storageEngine)) {
      await storageEngine.removeAdminUser(userToRemove);
      const adminUsers = await storageEngine.getUserManagementData('adminUsers');
      setAuthenticatedUsers(adminUsers?.adminUsersList.map((storedUser: StoredUser) => storedUser.email).filter((x) => x !== null) || []);
    }
    setModalRemoveOpened(false);
    setLoading(false);
  };

  const storageEngineIsCloud = useMemo(() => storageEngine && isCloudStorageEngine(storageEngine), [storageEngine]);

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
                <Tooltip label="You can only enable auth when using a cloud storage engine (Firebase/Supabase)" disabled={storageEngineIsCloud}>
                  <Button
                    onClick={(event) => (!storageEngineIsCloud ? event.preventDefault() : handleEnableAuth())}
                    color="green"
                    data-disabled={!storageEngineIsCloud ? true : undefined}
                    style={{ '&[dataDisabled]': { pointerEvents: 'all' } }}
                  >
                    Enable Authentication
                  </Button>
                </Tooltip>
              </Flex>
            )}
          {isAuthEnabled
            ? (
              <Flex mt={40} direction="column">
                <Flex style={{ borderBottom: '1px solid #dedede' }} direction="row" justify="space-between" mb={15} pb={15}>
                  <Title order={6}>Enabled Users</Title>
                  <IconUserPlus style={{ cursor: 'pointer' }} onClick={() => setModalAddOpened(true)} />
                </Flex>
                {authenticatedUsers.length > 0 ? authenticatedUsers.map(
                  (storedUser: string) => (
                    <Flex key={storedUser} justify="space-between" mb={10}>
                      <Text>{storedUser}</Text>
                      {storedUser === user.user?.email ? <Text color="blue" size="xs">You</Text>
                        : <ActionIcon variant="subtle" onClick={() => handleRemoveUser(storedUser)}><IconTrashX color="red" /></ActionIcon>}
                    </Flex>
                  ),
                ) : null}
                <Flex direction="row" justify="left">
                  <Button
                    onClick={() => logout()}
                    mt={20}
                  >
                    Log out
                  </Button>
                </Flex>
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
            leftSection={<IconAt />}
            placeholder="User Email Address"
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
        onClose={() => setModalEnableAuthOpened(false)}
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

      <Modal
        opened={modalEnableAuthErrorOpened}
        size="md"
        onClose={() => setModalEnableAuthErrorOpened(false)}
        title={(
          <Text fw={700}>
            An Error Occurred.
          </Text>
        )}
      >
        <Text mt={40}>
          An error has occurred when trying to enable authentication. Please consult the
          {' '}
          <a href="https://revisit.dev/docs/data-and-deployment/authentication-authorization/adding-removing-ui/" target="_blank" rel="noreferrer">documentation</a>
          {' '}
          for more information.
        </Text>
        <Flex mt={40} justify="right">
          <Button mr={5} onClick={() => setModalEnableAuthErrorOpened(false)}>
            Okay
          </Button>
        </Flex>
      </Modal>
      <LoadingOverlay visible={loading} />
    </>

  );
}
