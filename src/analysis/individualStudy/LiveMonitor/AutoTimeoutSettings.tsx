import {
  Alert, Button, Card, Group, Modal, NumberInput, Stack, Switch, Text, Title,
} from '@mantine/core';
import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { StorageEngine } from '../../../storage/engines/types';
import { useAuth } from '../../../store/hooks/useAuth';

const DEFAULT_MINUTES = 60;

export function AutoTimeoutSettings({
  storageEngine,
  studyId,
}: {
  storageEngine?: StorageEngine;
  studyId?: string;
}) {
  const { user } = useAuth();
  const [minutes, setMinutes] = useState<number | undefined>();
  const [draftMinutes, setDraftMinutes] = useState(DEFAULT_MINUTES);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  // Until the stored value has been read, the controls have nothing truthful to
  // show, so they stay disabled rather than offering a made-up default.
  const [loaded, setLoaded] = useState(false);
  const minutesRef = useRef<number | undefined>(undefined);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const contextVersionRef = useRef(0);

  useEffect(() => {
    contextVersionRef.current += 1;
    let cancelled = false;
    setLoaded(false);
    setMinutes(undefined);
    minutesRef.current = undefined;
    setDraftMinutes(DEFAULT_MINUTES);
    setConfirmationOpen(false);
    setSaving(false);
    saveChainRef.current = Promise.resolve();
    if (!storageEngine || !studyId) {
      setLoading(false);
      return () => { cancelled = true; };
    }
    setLoading(true);
    setError(null);
    storageEngine.getModes(studyId)
      .then((modes) => {
        if (cancelled) return;
        setMinutes(modes.autoTimeoutMinutes);
        minutesRef.current = modes.autoTimeoutMinutes;
        setDraftMinutes(modes.autoTimeoutMinutes ?? DEFAULT_MINUTES);
        setLoaded(true);
        setLoading(false);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error('Failed to load auto-timeout setting:', loadError);
        setError('The auto-timeout setting could not be loaded.');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [storageEngine, studyId, loadAttempt]);

  const save = useCallback(async (updatedMinutes: number | undefined) => {
    if (!storageEngine || !studyId || !user.isAdmin) return;
    const contextVersion = contextVersionRef.current;
    setSaving(true);
    const queuedSave = saveChainRef.current.catch(() => undefined).then(async () => {
      const previousMinutes = minutesRef.current;
      if (contextVersion === contextVersionRef.current) {
        setError(null);
      }
      try {
        await storageEngine.setAutoTimeoutMinutes(studyId, updatedMinutes);
        if (contextVersion !== contextVersionRef.current) return;
        minutesRef.current = updatedMinutes;
        setMinutes(updatedMinutes);
        if (updatedMinutes !== undefined) {
          setDraftMinutes(updatedMinutes);
        }
      } catch (saveError) {
        console.error('Failed to save auto-timeout setting:', saveError);
        if (contextVersion === contextVersionRef.current) {
          // Roll back to the last write that actually reached the backend.
          setMinutes(previousMinutes);
          setDraftMinutes(previousMinutes ?? DEFAULT_MINUTES);
          setError('The auto-timeout setting could not be saved.');
        }
        throw saveError;
      }
    });
    saveChainRef.current = queuedSave;
    try {
      await queuedSave;
    } finally {
      if (contextVersion === contextVersionRef.current && saveChainRef.current === queuedSave) {
        setSaving(false);
      }
    }
  }, [storageEngine, studyId, user.isAdmin]);

  const editable = user.isAdmin && loaded && !loading;

  return (
    <>
      <Modal
        centered
        opened={confirmationOpen}
        onClose={() => setConfirmationOpen(false)}
        title="Enable auto-timeout?"
      >
        <Stack gap="md">
          <Text size="sm">
            On the next new participant assignment, participants who started more than
            {' '}
            {draftMinutes}
            {' '}
            minutes ago will no longer count toward participant limits. They can still finish the study normally.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmationOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                setConfirmationOpen(false);
                save(draftMinutes).catch(() => undefined);
              }}
            >
              Enable auto-timeout
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Card shadow="sm" padding="sm" radius="md" withBorder>
        <Group justify="space-between" align="flex-start">
          <Stack gap={2}>
            <Title order={5} size="h5">Auto-timeout</Title>
            <Text size="sm" c="dimmed">
              When a new participant starts, people who began more than this long ago no longer count toward participant limits. Timed-out participants can still finish normally.
            </Text>
          </Stack>
          <Group align="center" wrap="nowrap">
            <NumberInput
              aria-label="Auto-timeout minutes"
              value={draftMinutes}
              min={1}
              allowDecimal={false}
              hideControls
              suffix=" minutes"
              disabled={!editable || saving}
              w={125}
              onChange={(value) => setDraftMinutes(
                typeof value === 'number' ? Math.max(1, Math.floor(value)) : DEFAULT_MINUTES,
              )}
              onBlur={() => {
                // Only persist a value that actually changed. Saving on every
                // blur would disable the switch just as a click on it lands,
                // swallowing the first attempt to turn auto-timeout off.
                if (minutes !== undefined && draftMinutes !== minutes) {
                  save(draftMinutes).catch(() => undefined);
                }
              }}
            />
            <Switch
              aria-label="Enable auto-timeout"
              checked={minutes !== undefined}
              // Deliberately stays interactive while a save is pending, so a
              // click arriving right after the minutes input blurs is not lost.
              disabled={!editable}
              onChange={(event) => {
                if (event.currentTarget.checked) {
                  setConfirmationOpen(true);
                } else {
                  save(undefined).catch(() => undefined);
                }
              }}
            />
          </Group>
        </Group>
        {error && (
          <Alert color="red" mt="xs" title="Auto-timeout unavailable">
            <Group justify="space-between" wrap="nowrap">
              <Text size="sm">{error}</Text>
              <Button
                size="xs"
                variant="light"
                loading={loading}
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
              >
                Retry
              </Button>
            </Group>
          </Alert>
        )}
        {!user.isAdmin && <Text size="xs" c="dimmed" mt="xs">Only study administrators can change auto-timeout.</Text>}
      </Card>
    </>
  );
}
