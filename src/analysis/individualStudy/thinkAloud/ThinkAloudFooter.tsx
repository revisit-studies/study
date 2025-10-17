import {
  ActionIcon,
  AppShell,
  Button,
  Group, Popover, SegmentedControl, Select, Stack, Text,
  Tooltip,
} from '@mantine/core';
import { useSearchParams } from 'react-router';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import * as d3 from 'd3';

import {
  IconArrowLeft, IconArrowRight, IconDeviceDesktopDown, IconInfoCircle, IconMusicDown, IconPlayerPauseFilled, IconPlayerPlayFilled,
} from '@tabler/icons-react';
import { useAsync } from '../../../store/hooks/useAsync';
import { useAuth } from '../../../store/hooks/useAuth';
import {
  EditedText, ParticipantTags, Tag, TranscribedAudio, TranscriptLinesWithTimes,
} from './types';
import { AudioProvenanceVis } from '../../../components/audioAnalysis/AudioProvenanceVis';
import { TranscriptSegmentsVis } from './TranscriptSegmentsVis';
import { TagSelector } from './tags/TagSelector';
import { getSequenceFlatMap } from '../../../utils/getSequenceFlatMap';
import { encryptIndex } from '../../../utils/encryptDecryptIndex';
import { PREFIX } from '../../../utils/Prefix';
import { handleTaskAudio, handleTaskScreenRecording } from '../../../utils/handleDownloadAudio';
import { ParticipantRejectModal } from '../ParticipantRejectModal';
import { StorageEngine } from '../../../storage/engines/types';

const margin = {
  left: 5, top: 0, right: 5, bottom: 0,
};

function getParticipantData(trrackId: string | undefined, storageEngine: StorageEngine | undefined) {
  if (storageEngine) {
    return storageEngine.getParticipantData(trrackId);
  }

  return null;
}

async function getParticipantTags(authEmail: string, trrackId: string | undefined, studyId: string, storageEngine: StorageEngine | undefined) {
  if (storageEngine && trrackId) {
    return (await storageEngine.getAllParticipantAndTaskTags(authEmail, trrackId));
  }

  return null;
}

async function getTags(storageEngine: StorageEngine | undefined, type: 'participant' | 'task' | 'text') {
  if (storageEngine) {
    const tags = await storageEngine.getTags(type);
    if (Array.isArray(tags)) {
      return tags;
    }
    return [];
  }

  return [];
}

export function ThinkAloudFooter({
  visibleParticipants, rawTranscript, currentShownTranscription, width, onTimeUpdate, isReplay, editedTranscript, currentTrial, saveProvenance, jumpedToLine = 0, studyId, setHasAudio, storageEngine,
} : {
  visibleParticipants: string[], rawTranscript: TranscribedAudio | null, currentShownTranscription: number | null, width: number, onTimeUpdate: (n: number) => void, isReplay: boolean, editedTranscript?: EditedText[], currentTrial: string, saveProvenance: (prov: unknown) => void, jumpedToLine?: number, studyId: string, setHasAudio: (b: boolean) => void, storageEngine: StorageEngine | undefined,
}) {
  const auth = useAuth();

  const [speed, setSpeed] = useState<number>(1);

  const [searchParams, setSearchParams] = useSearchParams();

  const participantId = useMemo(() => searchParams.get('participantId') || '', [searchParams]);

  const { value: participant } = useAsync(getParticipantData, [participantId, storageEngine]);

  const { value: taskTags, execute: pullTags } = useAsync(getTags, [storageEngine, 'task']);

  const { value: allParticipantTags, execute: pullAllParticipantTags } = useAsync(getTags, [storageEngine, 'participant']);
  const [analysisIsPlaying, _setAnalysisIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [screenRecordingUrl, setScreenRecordingUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAssetsUrl() {
      if (!storageEngine || !participantId || !currentTrial) {
        setAudioUrl(null);
        return;
      }

      try {
        const url = await storageEngine.getAudioUrl(currentTrial, participantId);
        setAudioUrl(url);
      } catch {
        setAudioUrl(null);
      }

      try {
        const url = await storageEngine.getScreenRecording(currentTrial, participantId);
        setScreenRecordingUrl(url);
      } catch {
        setScreenRecordingUrl(null);
      }
    }

    fetchAssetsUrl();
  }, [storageEngine, participantId, currentTrial]);

  const handleDownloadAudio = useCallback(async () => {
    if (!storageEngine || !participantId || !currentTrial) {
      return;
    }

    await handleTaskAudio({
      storageEngine,
      participantId,
      identifier: currentTrial,
      audioUrl,
    });
  }, [storageEngine, participantId, currentTrial, audioUrl]);

  const handleDownloadScreenRecording = useCallback(async () => {
    if (!storageEngine || !participantId || !currentTrial) {
      return;
    }

    await handleTaskScreenRecording({
      storageEngine,
      participantId,
      identifier: currentTrial,
      screenRecordingUrl,
    });
  }, [storageEngine, participantId, currentTrial, screenRecordingUrl]);

  const setAnalysisIsPlaying = useCallback((playing: boolean) => {
    localStorage.setItem('analysisIsPlaying', playing ? 'true' : 'false');
    if (!playing) {
      setIsMuted(true);
    }
    _setAnalysisIsPlaying(playing);
  }, []);

  const [transcriptLines, setTranscriptLines] = useState<TranscriptLinesWithTimes[] | null>(null);

  const { value: participantTags, execute: pullParticipantTags } = useAsync(getParticipantTags, [auth.user.user?.email || 'temp', participantId, studyId, storageEngine]);

  const [localParticipantTags, setLocalParticipantTags] = useState<ParticipantTags>();

  useEffect(() => {
    if (participantTags) {
      setLocalParticipantTags(participantTags);
    }
  }, [participantTags]);

  const currentTrialClean = useMemo(() => {
    // if we find ourselves with a wrong current trial, erase it
    if (participant && !participant.answers[currentTrial]) {
      setSearchParams({ participantId, currentTrial: Object.entries(participant.answers).find(([_, ans]) => +ans.trialOrder.split('_')[0] === 0)?.[0] || '' });
    }

    return participant ? participant.answers[currentTrial].componentName : '';
  }, [currentTrial, participant, participantId, setSearchParams]);

  const xScale = useMemo(() => {
    if (!participant || !participant.answers[currentTrial]) {
      return null;
    }

    const allStartTimes = Object.values(participant.answers || {}).map((answer) => [answer.startTime, answer.endTime]).flat();

    const extent = d3.extent(allStartTimes) as [number, number];

    const scale = d3.scaleLinear([margin.left, width + margin.left + margin.right]).domain(currentTrial ? [participant.answers[currentTrial].startTime, participant.answers[currentTrial].endTime] : extent).clamp(true);

    return scale;
  }, [participant, currentTrial, width]);

  useEffect(() => {
    const lines:TranscriptLinesWithTimes[] = [];

    if (!editedTranscript || editedTranscript.length === 0) {
      setTranscriptLines(null);

      return;
    }

    editedTranscript.forEach((l, i) => {
      if (rawTranscript && (i === 0 || l.transcriptMappingStart !== editedTranscript[i - 1].transcriptMappingStart)) {
        lines.push({
          start: i === 0 ? 0 : rawTranscript.results[l.transcriptMappingStart - 1].resultEndTime as number,
          end: i === editedTranscript.length - 1 ? rawTranscript.results[l.transcriptMappingEnd].resultEndTime as number + 500 : rawTranscript.results[l.transcriptMappingEnd].resultEndTime as number,
          lineStart: l.transcriptMappingStart,
          lineEnd: l.transcriptMappingEnd,
          tags: editedTranscript.filter((t) => t.transcriptMappingStart === l.transcriptMappingStart && t.transcriptMappingEnd === l.transcriptMappingEnd).map((t) => t.selectedTags),
        });
      }
    });

    setTranscriptLines(lines);
  }, [editedTranscript, setTranscriptLines, rawTranscript]);

  const nextParticipantCallback = useCallback((indexChange: number) => {
    let index = visibleParticipants.findIndex((part) => part === participantId) + indexChange;

    if (index >= visibleParticipants.length) {
      index = 0;
    } else if (index < 0) {
      index = visibleParticipants.length - 1;
    }

    localStorage.setItem('participantId', visibleParticipants[index]);
    setSearchParams({ participantId: visibleParticipants[index] || '' });
  }, [participantId, setSearchParams, visibleParticipants]);

  const nextTaskCallback = useCallback((indexChange: number) => {
    if (!participant || !currentTrial) {
      return;
    }
    let index = +participant.answers[currentTrial].trialOrder.split('_')[0] + indexChange;

    if (index >= Object.values(participant.answers).length) {
      index = 0;
    } else if (index < 0) {
      index = Object.values(participant.answers).length - 1;
    }

    const newTrial = Object.values(participant.answers).find((ans) => +ans.trialOrder.split('_')[0] === index);

    const newTrialName = newTrial ? `${newTrial.componentName}_${newTrial.trialOrder.split('_')[0]}` : '';

    localStorage.setItem('currentTrial', newTrialName);
    setSearchParams({ participantId, currentTrial: newTrialName });
  }, [currentTrial, participant, participantId, setSearchParams]);

  const setTags = useCallback((_tags: Tag[], type: 'task' | 'participant') => {
    if (storageEngine) {
      storageEngine.saveTags(_tags, type).then(() => { type === 'task' ? pullTags(storageEngine, type) : pullAllParticipantTags(storageEngine, type); });
    }
  }, [pullAllParticipantTags, pullTags, storageEngine]);

  const editTaskTagCallback = useCallback((oldTag: Tag, newTag: Tag) => {
    if (!taskTags) {
      return;
    }

    const tagIndex = taskTags.findIndex((t) => t.id === oldTag.id);
    const tagsCopy = Array.from(taskTags);
    tagsCopy[tagIndex] = newTag;

    setTags(tagsCopy, 'task');
  }, [setTags, taskTags]);

  const editParticipantTagCallback = useCallback((oldTag: Tag, newTag: Tag) => {
    if (!allParticipantTags) {
      return;
    }

    const tagIndex = allParticipantTags.findIndex((t) => t.id === oldTag.id);
    const tagsCopy = Array.from(allParticipantTags);
    tagsCopy[tagIndex] = newTag;

    setTags(tagsCopy, 'participant');
  }, [setTags, allParticipantTags]);

  const createTaskTagCallback = useCallback((t: Tag) => { setTags([...(taskTags || []), t], 'task'); }, [setTags, taskTags]);

  const createParticipantTagCallback = useCallback((t: Tag) => { setTags([...(taskTags || []), t], 'participant'); }, [setTags, taskTags]);

  const jumpedToTime = useMemo(() => (transcriptLines ? transcriptLines[jumpedToLine]?.start || 0 : 0), [jumpedToLine, transcriptLines]);

  const [timeString, setTimeString] = useState<string>('');

  return (
    <AppShell.Footer zIndex={101} withBorder={false}>
      <Stack style={{ backgroundColor: 'var(--mantine-color-blue-1)', height: '100%' }} gap={5} justify="center">

        <AudioProvenanceVis isMuted={isMuted} setHasAudio={setHasAudio} jumpedToAudioTime={jumpedToTime} speed={speed} setSpeed={setSpeed} saveProvenance={saveProvenance} analysisIsPlaying={analysisIsPlaying} setAnalysisIsPlaying={setAnalysisIsPlaying} setTime={onTimeUpdate} setTimeString={(_t) => setTimeString(_t)} answers={participant ? participant.answers : {}} taskName={currentTrial} context={isReplay ? 'provenanceVis' : 'audioAnalysis'} />
        {xScale && transcriptLines ? <TranscriptSegmentsVis startTime={xScale.domain()[0]} xScale={xScale} transcriptLines={transcriptLines} currentShownTranscription={currentShownTranscription || 0} /> : null }

        <Group gap="xs" style={{ width: '100%' }} justify="center" wrap="nowrap">
          <Group wrap="nowrap">
            <Text ff="monospace" style={{ textAlign: 'right' }} mt="lg" c="dimmed">{timeString}</Text>

            <Tooltip label="Play">
              <ActionIcon mt={25} size="xl" variant="light" onClick={() => { setAnalysisIsPlaying(!analysisIsPlaying); setIsMuted(!isMuted); }}>
                {analysisIsPlaying ? <IconPlayerPauseFilled /> : <IconPlayerPlayFilled /> }
              </ActionIcon>
            </Tooltip>

            <Popover styles={{ dropdown: { padding: 0 } }} position="bottom" withArrow shadow="md">
              <Popover.Target>
                <Tooltip label="Speed">
                  <ActionIcon style={{ width: '50px' }} mt={25} variant="light">
                    {`${speed}x`}
                  </ActionIcon>
                </Tooltip>
              </Popover.Target>
              <Popover.Dropdown>
                <SegmentedControl
                  value={speed.toString()}
                  onChange={(s) => {
                    setSpeed(+s);
                    localStorage.setItem('currentSpeed', s);
                  }}
                  orientation="vertical"
                  data={[
                    { label: '0.5x', value: '0.5' },
                    { label: '1x', value: '1' },
                    { label: '1.5x', value: '1.5' },
                    { label: '2x', value: '2' },
                    { label: '4x', value: '4' },
                    { label: '8x', value: '8' },
                  ]}
                />
                <Stack gap="xs" />
              </Popover.Dropdown>
            </Popover>

          </Group>

          <Group wrap="nowrap" gap="lg">

            <Select
              leftSection={(
                <Tooltip label="Previous Participant">
                  <ActionIcon size="sm" variant="light" onClick={() => nextParticipantCallback(-1)}>
                    <IconArrowLeft />
                  </ActionIcon>
                </Tooltip>
                  )}
              rightSection={(
                <Tooltip label="Next Participant">
                  <ActionIcon size="sm" variant="light" onClick={() => nextParticipantCallback(1)} style={{ pointerEvents: 'all' }}>
                    <IconArrowRight />
                  </ActionIcon>
                </Tooltip>
                  )}
              label="Participant Id"
              style={{ width: '200px' }}
              value={participantId}
              onChange={(e: string | null) => {
                setSearchParams({ currentTrial, participantId: e || '' });
                localStorage.setItem('participantId', e || '');
              }}
              data={visibleParticipants.map((part) => part).sort()}
              searchable
            />

            <Stack gap="4">
              <Group gap="xs" align="center">
                <Text size="sm" fw={500}>Participant Tags</Text>
                <Tooltip w={300} multiline label="Participant tags allow you to categorize or label the participant. Click in the box to add, create, or edit tags.">
                  <IconInfoCircle size={16} />
                </Tooltip>
              </Group>
              <TagSelector
                width={200}
                tags={allParticipantTags || []}
                editTagCallback={editParticipantTagCallback}
                createTagCallback={createParticipantTagCallback}
                tagsEmptyText="Add Participant Tags"
                onSelectTags={(tempTags) => {
                  if (storageEngine && participantTags) {
                    let copy = structuredClone(participantTags);
                    if (copy) {
                      copy.participantTags = tempTags;
                    } else {
                      copy = { participantTags: [], taskTags: {} };
                      copy.participantTags = tempTags;
                    }
                    setLocalParticipantTags(copy);
                    storageEngine.saveAllParticipantAndTaskTags(auth.user.user?.email || 'temp', participantId, copy).then(() => {
                      pullParticipantTags(auth.user.user?.email || 'temp', participantId, studyId, storageEngine);
                    });
                  }
                }}
                selectedTags={localParticipantTags ? localParticipantTags.participantTags : []}
              />
            </Stack>

            <Select
              leftSection={(
                <Tooltip label="Previous Task">
                  <ActionIcon size="sm" variant="light" onClick={() => nextTaskCallback(-1)}>
                    <IconArrowLeft />
                  </ActionIcon>
                </Tooltip>
                  )}
              rightSection={(
                <Tooltip label="Next Task">
                  <ActionIcon size="sm" variant="light" onClick={() => nextTaskCallback(1)} style={{ pointerEvents: 'all' }}>
                    <IconArrowRight />
                  </ActionIcon>
                </Tooltip>
                  )}
              label="Task"
              style={{ width: '200px' }}
              value={currentTrialClean}
            // this needs to be in a helper or two which we dont currently have
              onChange={(e: string | null) => {
                if (participant && e) {
                  const trial = Object.entries(participant.answers).find(([_key, ans]) => +ans.trialOrder.split('_')[0] === getSequenceFlatMap(participant?.sequence).indexOf(e))?.[0] || '';
                  localStorage.setItem('currentTrial', trial);

                  setSearchParams({ participantId, currentTrial: trial });
                }
              }}
              data={participant ? getSequenceFlatMap(participant?.sequence) : []}
              searchable
            />
            <Stack gap="4">
              <Group gap="xs" align="center">
                <Text size="sm" fw={500}>Task Tags</Text>
                <Tooltip w={300} multiline label="Task tags allow you to categorize or label the current task. Click in the box to add, create, or edit tags.">
                  <IconInfoCircle size={16} />
                </Tooltip>
              </Group>
              <TagSelector
                width={200}
                tags={taskTags || []}
                editTagCallback={editTaskTagCallback}
                createTagCallback={createTaskTagCallback}
                tagsEmptyText="Add Task Tags"
                onSelectTags={(tempTag) => {
                  if (storageEngine && participantTags) {
                    let copy = structuredClone(participantTags);
                    if (copy) {
                      copy.taskTags[currentTrial] = tempTag;
                    } else {
                      copy = { participantTags: [], taskTags: {} };
                      copy.taskTags[currentTrial] = tempTag;
                    }
                    setLocalParticipantTags(copy);

                    storageEngine.saveAllParticipantAndTaskTags(auth.user.user?.email || 'temp', participantId, copy).then(() => {
                      pullParticipantTags(auth.user.user?.email || 'temp', participantId, studyId, storageEngine);
                    });
                  }
                }}
                selectedTags={localParticipantTags ? localParticipantTags.taskTags[currentTrial] || [] : []}
              />
            </Stack>

          </Group>
          <Button mt="lg" variant="light" component="a" href={isReplay ? `${PREFIX}analysis/stats/${studyId}/tagging?participantId=${participantId}&currentTrial=${currentTrial}` : `${PREFIX}${studyId}/${encryptIndex(participant ? +(participant.answers[currentTrial]?.trialOrder.split('_')[0] || 0) : 0)}?participantId=${participantId}&currentTrial=${currentTrial}`} target="_blank">
            {isReplay ? 'Transcript' : 'Replay'}
          </Button>
          <Group mt="lg">
            {audioUrl && (
            <Tooltip label="Download audio">
              <ActionIcon variant="light" size={30} onClick={handleDownloadAudio}>
                <IconMusicDown />
              </ActionIcon>
            </Tooltip>
            )}
            {screenRecordingUrl && (
            <Tooltip label="Download screen recording">
              <ActionIcon variant="filled" size={30} onClick={handleDownloadScreenRecording}>
                <IconDeviceDesktopDown />
              </ActionIcon>
            </Tooltip>
            )}
            <ParticipantRejectModal selectedParticipants={[]} footer />
          </Group>
        </Group>
      </Stack>
    </AppShell.Footer>
  );
}
