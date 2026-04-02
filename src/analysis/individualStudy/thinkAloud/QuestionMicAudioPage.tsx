import {
  Box,
  Button,
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

const localSummaryEndpoint = '/api/mic-group-summary';
const configuredSummaryEndpoint = import.meta.env.VITE_MIC_GROUP_SUMMARY_API_URL?.trim();
const summaryEndpoint = configuredSummaryEndpoint
  || (import.meta.env.DEV ? localSummaryEndpoint : '');

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
  const [summaryByClip, setSummaryByClip] = useState<Record<string, string>>({});
  const [summaryStatusByClip, setSummaryStatusByClip] = useState<Record<string, { loading: boolean; error?: string }>>({});

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

  const summaryUnavailableReason = useMemo(() => {
    if (summaryEndpoint) return '';
    if (!import.meta.env.PROD) return 'Summarization endpoint is not configured.';
    return 'Summarization is not available in this deployment. GitHub Pages is a static host, so configure VITE_MIC_GROUP_SUMMARY_API_URL to point at a server endpoint that can call OpenAI.';
  }, []);

  const summarizeGroup = async (group: { clipName: string; entries: Array<{ participantId: string; url: string }> }) => {
    setSummaryStatusByClip((prev) => ({
      ...prev,
      [group.clipName]: { loading: true },
    }));

    try {
      if (!summaryEndpoint) {
        throw new Error(summaryUnavailableReason || 'Summarization endpoint is not configured.');
      }

      const response = await fetch(summaryEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: selectedQuestion,
          clipName: group.clipName,
          clips: group.entries,
        }),
      });

      const raw = await response.text();
      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const payload = raw && isJson ? JSON.parse(raw) : {};
      if (!isJson) {
        const compactBody = raw.replace(/\s+/g, ' ').slice(0, 120);
        throw new Error(
          response.ok
            ? `Summarization endpoint returned ${contentType || 'non-JSON content'} instead of JSON.`
            : `Summarization endpoint returned ${response.status} ${response.statusText}${compactBody ? `: ${compactBody}` : ''}`,
        );
      }
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to summarize');
      }

      setSummaryByClip((prev) => ({ ...prev, [group.clipName]: payload.summary || '' }));
      setSummaryStatusByClip((prev) => ({ ...prev, [group.clipName]: { loading: false } }));
    } catch (error) {
      setSummaryStatusByClip((prev) => ({
        ...prev,
        [group.clipName]: {
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }));
    }
  };

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
            {summaryUnavailableReason && (
              <Text size="sm" c="orange">
                {summaryUnavailableReason}
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
                <Group gap="sm" wrap="nowrap">
                  <Text size="sm" c="dimmed">
                    {group.entries.length}
                    {' '}
                    participant
                    {group.entries.length === 1 ? '' : 's'}
                  </Text>
                  <Button
                    size="xs"
                    variant="light"
                    loading={summaryStatusByClip[group.clipName]?.loading}
                    disabled={Boolean(summaryUnavailableReason)}
                    onClick={() => summarizeGroup(group)}
                  >
                    Summarize responses
                  </Button>
                </Group>
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

              {summaryStatusByClip[group.clipName]?.error && (
                <Text size="sm" c="red" mt="xs">
                  {summaryStatusByClip[group.clipName]?.error}
                </Text>
              )}

              {summaryByClip[group.clipName] && (
                <Box mt="xs" p="xs" style={{ background: 'var(--mantine-color-white)', borderRadius: 6, border: '1px solid var(--mantine-color-gray-3)' }}>
                  <Text size="sm" fw={600}>Summary</Text>
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                    {summaryByClip[group.clipName]}
                  </Text>
                </Box>
              )}
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
