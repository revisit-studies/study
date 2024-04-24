import {
  Badge, Button, Card, Text, Container, Flex, Image, LoadingOverlay,
} from '@mantine/core';
import { useState, useEffect } from 'react';
import {
  getAuth, signInWithPopup, GoogleAuthProvider,
} from '@firebase/auth';
import { IconBrandGoogle } from '@tabler/icons-react';
import { Navigate } from 'react-router-dom';
import { PREFIX } from './utils/Prefix';
import { useAuth } from './store/hooks/useAuth';
import { useStorageEngine } from './store/storageEngineHooks';
import { FirebaseStorageEngine } from './storage/engines/FirebaseStorageEngine';

export function Login() {
  const { user } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string|null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const { storageEngine } = useStorageEngine();

  // Sign in with Google. Any errors are sent to the error message badge.
  const signInWithGoogle = async () => {
    if (storageEngine instanceof FirebaseStorageEngine) {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      const auth = getAuth();
      try {
        await signInWithPopup(auth, provider);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        setErrorMessage(error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!user.determiningStatus && !user.isAdmin && user.adminVerification) {
      setErrorMessage('You are not authorized to use this application.');
    }
  }, [user.adminVerification]);

  if (!user.determiningStatus && user.isAdmin) {
    return <Navigate to="/" />;
  }

  return (
    <Container>
      <Card p="lg">
        <Flex align="center" direction="column" justify="center">
          <Image maw={200} mt={50} mb={100} src={`${PREFIX}revisitAssets/revisitLogoSquare.svg`} alt="Revisit Logo" />
          <>
            <Text mb={20}>To access admin settings, please sign in using your Google account.</Text>
            <Button onClick={signInWithGoogle} leftIcon={<IconBrandGoogle />} variant="filled">Sign In With Google</Button>
          </>
          {errorMessage ? <Badge size="lg" color="red" mt={30}>{errorMessage}</Badge> : null}
          <LoadingOverlay visible={loading} zIndex={1000} overlayBlur={2} />
        </Flex>
      </Card>
    </Container>
  );
}
