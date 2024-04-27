import {
  Anchor, Card, Container, Image, Text, UnstyledButton, LoadingOverlay,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAuth, signInWithPopup, GoogleAuthProvider,
} from '@firebase/auth';
import { useAuth } from '../../store/hooks/useAuth';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { FirebaseStorageEngine } from '../../storage/engines/FirebaseStorageEngine';

export function GlobalSettings() {
  const { user, logout } = useAuth();
  const { storageEngine } = useStorageEngine();

  const [isAuthEnabled, setAuthEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string|null>(null);

  useEffect(() => {
    const determineAuthenticationEnabled = async () => {
      setLoading(true);
      if (storageEngine instanceof FirebaseStorageEngine) {
        const authInfo = await storageEngine?.getUserManagementData('authentication');
        setAuthEnabled(authInfo?.isEnabled);
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
      setAuthEnabled(!authInfo?.isEnabled);
    }
    setLoading(false);
  };

  return (
    <Container size="xs" px="xs" style={{ marginTop: 100, marginBottom: 100 }}>
      <Card>
        <UnstyledButton
          style={{
            color: isAuthEnabled ? 'green' : 'red',
          }}
          onClick={() => {
            handleChangeAuth();
          }}
        >
          { isAuthEnabled ? 'YES' : 'NO'}
        </UnstyledButton>
      </Card>
      <LoadingOverlay visible={loading} zIndex={1000} overlayBlur={2} />
    </Container>
  );
}
