import {
  Anchor, Card, Container, Image, Text, UnstyledButton, LoadingOverlay,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/hooks/useAuth';
import { useStorageEngine } from '../store/storageEngineHooks';
import { FirebaseStorageEngine } from '../storage/engines/FirebaseStorageEngine';

export function AdminDashboard() {
  const { user, logout } = useAuth();
  const { storageEngine } = useStorageEngine();

  const [isAuthEnabled, setAuthEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

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

  const handleChangeAuth = async () => {
    setLoading(true);
    if (storageEngine instanceof FirebaseStorageEngine) {
      const currentAuthEnabledValue = await storageEngine?.enableDisableAuth();
      setAuthEnabled(currentAuthEnabledValue);
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
