import {
  Button, Card, Text, Container, Flex, Image, LoadingOverlay,
} from '@mantine/core';
import { useState, useEffect } from 'react';
import {
  getAuth, signInWithPopup, GoogleAuthProvider, browserPopupRedirectResolver,
} from '@firebase/auth';
import { IconBrandGoogleFilled } from '@tabler/icons-react';
import { Navigate } from 'react-router';
import { PREFIX } from './utils/Prefix';
import { useAuth } from './store/hooks/useAuth';
import { useStorageEngine } from './storage/storageEngineHooks';
import { StorageEngine } from './storage/engines/types';
import { showNotification } from './utils/notifications';
import { isCloudStorageEngine } from './storage/engines/utils';

export async function signInWithGoogle(storageEngine: StorageEngine | undefined, setLoading: (val: boolean) => void) {
  if (storageEngine && isCloudStorageEngine(storageEngine)) {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    const auth = getAuth();
    try {
      await signInWithPopup(auth, provider, browserPopupRedirectResolver);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      showNotification({ title: 'Error', message: error.message, color: 'red' });
    } finally {
      setLoading(false);
    }
    return auth.currentUser;
  }
  return null;
}

export function Login() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const { storageEngine } = useStorageEngine();

  useEffect(() => {
    if (!user.determiningStatus && !user.isAdmin && user.adminVerification) {
      showNotification({ title: 'Unauthorized', message: 'You are not authorized to use this application.', color: 'red' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.adminVerification]);

  if (!user.determiningStatus && user.isAdmin) {
    return <Navigate to="/" />;
  }

  return (
    <Container>
      <Card padding="lg">
        <Flex align="center" direction="column" justify="center">
          <Image maw={200} mt={50} mb={100} src={`${PREFIX}revisitAssets/revisitLogoSquare.svg`} alt="Revisit Logo" />
          <>
            <Text mb={20}>To access admin settings, please sign in using your Google account.</Text>
            <Button onClick={() => signInWithGoogle(storageEngine, setLoading)} leftSection={<IconBrandGoogleFilled />} variant="filled">Sign In With Google</Button>
          </>
          <LoadingOverlay visible={loading} />
        </Flex>
      </Card>
    </Container>
  );
}
