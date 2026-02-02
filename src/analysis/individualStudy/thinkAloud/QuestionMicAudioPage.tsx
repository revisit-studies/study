import {
  Box,
  Group,
  LoadingOverlay,
  Select,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useStorageEngine } from '../../../storage/storageEngineHooks';
import { ParticipantData } from '../../../storage/types';

type ParticipantClips = {
  participantId: string;
  clips: Array<{ name: string; url: string }>;
};

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let i = 0;

  const runNextBatch = async (): Promise<void> => {
    const batch = items.slice(i, i + limit);
    if (batch.length === 0) return;

    const batchResults = await Promise.all(
      batch.map((item, batchIndex) => fn(item, i + batchIndex)),
    );
    results.push(...batchResults);
    i += limit;
    await runNextBatch();
  };

  await runNextBatch();
  return results;
}

export function QuestionMicAudioPage() {
  const { studyId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { storageEngine } = useStorageEngine();

  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  const selectedQuestion = useMemo(() => searchParams.get('question') || '', [searchParams]);

  const questionOptions = useMemo(() => {
    const allKeys = new Set<string>();
    participants.forEach((p) => {
      Object.keys(p.answers || {}).forEach((k) => allKeys.add(k));
    });
    return Array.from(allKeys)
      .sort((a, b) => a.localeCompare(b));
  }, [participants]);

  const [loadingClips, setLoadingClips] = useState(false);
  const [clipsByParticipant, setClipsByParticipant] = useState<ParticipantClips[]>([]);

  const groupedByClipName = useMemo(() => {
    const map = new Map<string, Array<{ participantId: string; url: string }>>();
    clipsByParticipant.forEach((row) => {
      row.clips.forEach((clip) => {
        const existing = map.get(clip.name) || [];
        existing.push({ participantId: row.participantId, url: clip.url });
        map.set(clip.name, existing);
      });
    });

    return Array.from(map.entries())
      .map(([clipName, entries]) => ({
        clipName,
        entries: entries.sort((a, b) => a.participantId.localeCompare(b.participantId)),
      }))
      .sort((a, b) => a.clipName.localeCompare(b.clipName));
  }, [clipsByParticipant]);

  // Load participants once
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!studyId || !storageEngine) return;
      setLoadingParticipants(true);
      try {
        await storageEngine.initializeStudyDb(studyId);
        const data = await storageEngine.getAllParticipantsData(studyId);
        if (!cancelled) setParticipants(data);
      } catch (e) {
        if (!cancelled) setParticipants([]);
        console.warn('Failed to load participants for mic audio page', e);
      } finally {
        if (!cancelled) setLoadingParticipants(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [studyId, storageEngine]);

  // Load clips for selected question
  useEffect(() => {
    let cancelled = false;
    async function loadClips() {
      if (!storageEngine || !selectedQuestion || participants.length === 0) {
        setClipsByParticipant([]);
        return;
      }
      setLoadingClips(true);
      try {
        const results = await mapLimit(
          participants,
          8,
          async (p) => {
            const clips = await storageEngine.getQuestionMicFiles(selectedQuestion, p.participantId);
            return { participantId: p.participantId, clips };
          },
        );
        if (!cancelled) {
          setClipsByParticipant(
            results.filter((r) => r.clips.length > 0),
          );
        }
      } catch (e) {
        if (!cancelled) setClipsByParticipant([]);
        console.warn('Failed to load mic clips', e);
      } finally {
        if (!cancelled) setLoadingClips(false);
      }
    }
    loadClips();
    return () => { cancelled = true; };
  }, [participants, selectedQuestion, storageEngine]);

  const isFirebase = storageEngine?.getEngine() === 'firebase';

  return (
    <Box style={{ position: 'relative' }}>
      <LoadingOverlay visible={loadingParticipants || loadingClips} />
      <Stack gap="md">
        <Group justify="space-between" align="flex-end">
          <Box>
            <Title order={4}>Question mic audio (all participants)</Title>
            <Text size="sm" c="dimmed">
              Select a question (trial key) to load all mic-user-study clips across participants.
            </Text>
            {!isFirebase && (
              <Text size="sm" c="red">
                This page currently requires Firebase storage.
              </Text>
            )}
          </Box>

          <Select
            label="Question"
            placeholder={loadingParticipants ? 'Loading…' : 'Select question'}
            searchable
            w={360}
            value={selectedQuestion || null}
            onChange={(v) => {
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                if (v) next.set('question', v);
                else next.delete('question');
                return next;
              });
            }}
            data={questionOptions.map((q) => ({ value: q, label: q }))}
          />
        </Group>

        {selectedQuestion && (
          <Text size="sm">
            Showing
            {' '}
            <Text span fw={600}>{groupedByClipName.length}</Text>
            {' '}
            clip groups across
            {' '}
            <Text span fw={600}>{clipsByParticipant.length}</Text>
            {' '}
            participants for
            {' '}
            <Text span fw={600} ff="monospace">{selectedQuestion}</Text>
            .
          </Text>
        )}

        <Stack gap="lg">
          {groupedByClipName.map((group) => (
            <Box key={group.clipName} p="sm" style={{ background: 'var(--mantine-color-gray-0)', borderRadius: 8 }}>
              <Group justify="space-between" wrap="nowrap">
                <Text fw={700} ff="monospace">{group.clipName}</Text>
                <Text size="sm" c="dimmed">
                  {group.entries.length}
                  {' '}
                  participant
                  {group.entries.length === 1 ? '' : 's'}
                </Text>
              </Group>

              <Stack gap="xs" mt="xs">
                {group.entries.map((entry) => (
                  <Group key={`${group.clipName}-${entry.participantId}`} justify="space-between" wrap="nowrap">
                    <Text size="sm" ff="monospace" style={{ width: 420, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {entry.participantId}
                    </Text>
                    <audio controls src={entry.url} style={{ width: 360 }} />
                  </Group>
                ))}
              </Stack>
            </Box>
          ))}

          {selectedQuestion && !loadingClips && clipsByParticipant.length === 0 && (
            <Text size="sm" c="dimmed">No mic clips found for that question.</Text>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
