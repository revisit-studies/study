import {
  Alert, Anchor, Code, Paper, Stack, Switch, Text, Title,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { useStorageEngine } from '../../../storage/storageEngineHooks';
import { isCloudStorageEngine } from '../../../storage/engines/utils/storageEngineHelpers';
import { parseFirebaseConfig } from '../../../utils/defaultStorageConfig';
import { useAuth } from '../../../store/hooks/useAuth';

export function StorageManagementView({ studyId }: { studyId: string }) {
  const { storageEngine, configuredStorageEngine } = useStorageEngine();
  const { user } = useAuth();
  const [disconnected, setDisconnected] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cloudEngine = isCloudStorageEngine(configuredStorageEngine) ? configuredStorageEngine : null;
  const firebaseConfig = cloudEngine?.getEngine() === 'firebase'
    ? parseFirebaseConfig(import.meta.env.VITE_FIREBASE_CONFIG) : null;
  const projectId = firebaseConfig && typeof firebaseConfig === 'object' && 'projectId' in firebaseConfig
    ? String(firebaseConfig.projectId) : null;
  const databaseUrl = cloudEngine?.getEngine() === 'firebase' && projectId
    ? `https://console.firebase.google.com/project/${encodeURIComponent(projectId)}/firestore/data`
    : cloudEngine?.getEngine() === 'supabase' ? import.meta.env.VITE_SUPABASE_URL : null;

  useEffect(() => {
    if (!cloudEngine || !user.isAdmin || !user.adminVerification || !user.user?.uid) return undefined;
    let cancelled = false;
    cloudEngine.getStorageDisconnected(studyId)
      .then((value) => { if (!cancelled) setDisconnected(value); })
      .catch((readError) => {
        if (!cancelled) setError(readError instanceof Error ? readError.message : String(readError));
      });
    return () => { cancelled = true; };
  }, [cloudEngine, studyId, user.adminVerification, user.isAdmin, user.user?.uid]);

  if (!cloudEngine || !user.isAdmin || !user.adminVerification || !user.user?.uid) return null;

  const changeStorage = async (value: boolean) => {
    setSaving(true);
    setError(null);
    try {
      await cloudEngine.setStorageDisconnected(studyId, value);
      window.location.reload();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
      setSaving(false);
    }
  };

  return (
    <Paper shadow="sm" p="lg" radius="md" withBorder w="60%" mx="auto">
      <Stack gap="sm">
        <Title order={3}>Database / Datastore Management</Title>
        <Text>
          Study:
          {' '}
          {studyId}
        </Text>
        <Text>
          Configured storage:
          {' '}
          {cloudEngine.getEngine()}
        </Text>
        <Text>
          Currently used for analytics:
          {' '}
          {storageEngine?.getEngine() ?? 'loading'}
        </Text>
        {databaseUrl && <Anchor href={databaseUrl} target="_blank" rel="noopener noreferrer">Open database</Anchor>}
        <Text fw={600}>VITE_STORAGE_ENGINE</Text>
        <Code block>{import.meta.env.VITE_STORAGE_ENGINE}</Code>
        {cloudEngine.getEngine() === 'firebase' ? (
          <>
            <Text fw={600}>VITE_FIREBASE_CONFIG</Text>
            <Code block>{firebaseConfig ? JSON.stringify(firebaseConfig, null, 2) : import.meta.env.VITE_FIREBASE_CONFIG}</Code>
          </>
        ) : (
          <>
            <Text fw={600}>VITE_SUPABASE_URL</Text>
            <Code block>{import.meta.env.VITE_SUPABASE_URL}</Code>
            <Text fw={600}>VITE_SUPABASE_ANON_KEY</Text>
            <Code block>{import.meta.env.VITE_SUPABASE_ANON_KEY}</Code>
          </>
        )}
        {error && <Alert color="red" title="Storage setting unavailable">{error}</Alert>}
        <Switch
          label="Use local storage for new sessions"
          checked={disconnected ?? false}
          disabled={disconnected === null || saving}
          onChange={(event) => changeStorage(event.currentTarget.checked)}
        />
        <Text size="sm">
          Changing this setting refreshes this page. Participants already in progress continue with their original storage.
          Local data stays in each participant&apos;s browser and is not uploaded when cloud storage is re-enabled.
        </Text>
      </Stack>
    </Paper>
  );
}
