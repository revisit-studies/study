import {
  Badge, Button, Card, Text, Container, Flex, Image,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { getAuth, signInWithPopup, GoogleAuthProvider } from '@firebase/auth';
import { IconBrandGoogle } from '@tabler/icons-react';
import { PREFIX } from './utils/Prefix';
import { useAuth, User } from './store/hooks/useAuth';
import { useStorageEngine } from './store/storageEngineHooks';

interface LoginProps {
  globalConfigAdminUsers:string[];
}

export function Login({ globalConfigAdminUsers }:LoginProps) {
  const { user, login } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string|null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { storageEngine } = useStorageEngine();

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const auth = getAuth();
    signInWithPopup(auth, provider)
      .then((result) => {
        setIsLoading(true);
        // This gives you a Google Access Token. You can use it to access the Google API.
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential !== null) {
          // The signed-in user info.
          const googleUser = result.user;
          storageEngine?.getUserManagementData('adminUsers').then((adminUsers) => {
            if (adminUsers && adminUsers.adminUsersList) {
              const admins = adminUsers.adminUsersList;
              const isAdmin = (googleUser.email?.includes && admins.includes(googleUser.email)) ?? false;
              if (!isAdmin) {
                setErrorMessage('You are not authorized as an admin on this application.');
              } else {
                // If an admin, login the user. Remove error message.
                login({
                  name: googleUser.displayName,
                  email: googleUser.email,
                  isAdmin,
                });
                setErrorMessage(null);
                // If user is also in the global.json adminUsers list, update Firestore with new list of admins
                const isGlobalConfigAdmin = (googleUser.email?.includes && globalConfigAdminUsers.includes(googleUser.email)) ?? false;
                if (isGlobalConfigAdmin) {
                  storageEngine?.editUserManagementAdmins(globalConfigAdminUsers);
                }
              }
            } else {
              // Here we either don't have adminUsers, or don't have adminUsersList on the adminUsersList. Should use the admins property passed in

              const isAdmin = (googleUser.email?.includes && globalConfigAdminUsers.includes(googleUser.email)) ?? false;

              if (!isAdmin) {
                setErrorMessage('You are not authorized as an admin on this application.');
              } else {
                // If an admin, login the user. Remove error message.
                login({
                  name: googleUser.displayName,
                  email: googleUser.email,
                  isAdmin,
                });
                setErrorMessage(null);
                // Add globalAdminUsers to the Firestore database
                storageEngine?.editUserManagementAdmins(globalConfigAdminUsers);
              }
            }
            setIsLoading(false);
          });
        }
      }).catch((error) => {
        // Issues with connecting to Firebase or logging in will be displayed to user.
        setErrorMessage(error.message);
      });
  };

  useEffect(() => {
    const engine = storageEngine?.getEngine();
    // When the engine is defined but is not firebase, we auto-log in the user as if they were an admin.
    if (engine && engine !== 'firebase' && !user) {
      // If not using firebase as storage engine, authenticate the user with a fake user with admin privileges.
      const currUser: User = {
        name: 'localName',
        isAdmin: true,
        email: 'localEmail@example.com',
      };
      login(currUser);
      setErrorMessage(null);
    }
  }, []);

  return (
    <Container>
      <Card p="lg">
        <Flex align="center" direction="column" justify="center">
          <Image maw={200} mt={50} mb={100} src={`${PREFIX}revisitAssets/revisitLogoSquare.svg`} alt="Revisit Logo" />
          <Text mb={20}>To access admin settings, please sign in using your Google account.</Text>
          <Button onClick={signInWithGoogle} leftIcon={<IconBrandGoogle />} variant="filled">Sign In With Google</Button>
          {errorMessage ? <Badge size="lg" color="red" mt={30}>{errorMessage}</Badge> : null}
        </Flex>
      </Card>
    </Container>
  );
}
