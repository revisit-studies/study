import {
  Badge, Button, Card, Text, Container, Flex, Image, LoadingOverlay,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { getAuth, signInWithPopup, GoogleAuthProvider } from '@firebase/auth';
import { IconBrandGoogle } from '@tabler/icons-react';
import { redirect } from 'react-router-dom';
import { PREFIX } from './utils/Prefix';
import { useAuth, User } from './store/hooks/useAuth';
import { useStorageEngine } from './store/storageEngineHooks';
import { FirebaseStorageEngine } from './storage/engines/FirebaseStorageEngine';

interface LoginProps {
  globalConfigAdminUsers:string[];
}

export function Login({ globalConfigAdminUsers }:LoginProps) {
  const { user, login } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string|null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const { storageEngine } = useStorageEngine();

  const signInWithGoogle = async () => {
    if (storageEngine instanceof FirebaseStorageEngine) {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      const auth = getAuth();
      signInWithPopup(auth, provider)
        .then((result) => {
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
              setLoading(false);
            });
          }
        }).catch((error) => {
          // Issues with connecting to Firebase or logging in will be displayed to user.
          setErrorMessage(error.message);
        });
    } else {
      const message = 'Signing in with Google is no prohibited when the StorageEngine is not Firebase.';
      console.error(message);
      setErrorMessage(message);
    }
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
          { storageEngine?.getEngine() === 'firebase' ? (
            <>
              <Text mb={20}>To access admin settings, please sign in using your Google account.</Text>
              <Button onClick={signInWithGoogle} leftIcon={<IconBrandGoogle />} variant="filled">Sign In With Google</Button>
            </>
          ) : (
            <>
              <Text mb={20}>Since this application is not using Firebase, there is no need to log in.</Text>
              <Button onClick={() => redirect('/')} variant="filled">Go to Studies</Button>
            </>
          )}
          {errorMessage ? <Badge size="lg" color="red" mt={30}>{errorMessage}</Badge> : null}
          <LoadingOverlay visible={loading} zIndex={1000} overlayBlur={2} />
        </Flex>
      </Card>
    </Container>
  );
}
