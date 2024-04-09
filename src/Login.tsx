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
  admins:string[];
}

export function Login({ admins }:LoginProps) {
  const { user, login } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string|null>(null);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const auth = getAuth();
    signInWithPopup(auth, provider)
      .then((result) => {
        // This gives you a Google Access Token. You can use it to access the Google API.
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential !== null) {
          // The signed-in user info.
          const googleUser = result.user;
          // Determines Admin status
          const admin = (googleUser.email?.includes && admins.includes(googleUser.email)) ?? false;

          // If not an admin, send and error message and do not log in the user.
          if (!admin) {
            setErrorMessage('You are not authorized as an admin on this application.');
          } else {
            // If an admin, login the user. Remove error message.
            login({
              name: googleUser.displayName,
              email: googleUser.email,
              admin,
            });
            setErrorMessage(null);
          }
        }
      }).catch((error) => {
        // Issues with connecting to Firebase or logging in will be displayed to user.
        setErrorMessage(error.message);
      });
  };

  const { storageEngine } = useStorageEngine();

  useEffect(() => {
    const engine = storageEngine?.getEngine();
    // When the engine is defined but is not firebase, we auto-log in the user as if they were an admin.
    if (engine && engine !== 'firebase' && !user) {
      // If not using firebase as storage engine, authenticate the user with a fake user with admin privileges.
      const currUser: User = {
        name: 'localName',
        admin: true,
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
