import {
  ActionIcon,
  AppShell,
  Group, Popover, SegmentedControl, Select, Stack, Text,
  Tooltip,
} from '@mantine/core';
import { useSearchParams } from 'react-router';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import * as d3 from 'd3';

import {
  IconArrowLeft, IconArrowRight, IconPlayerPauseFilled, IconPlayerPlayFilled,
} from '@tabler/icons-react';
import { useAsync } from '../../../store/hooks/useAsync';
import { useStorageEngine } from '../../../storage/storageEngineHooks';
import { useAuth } from '../../../store/hooks/useAuth';
import {
  EditedText, Tag, TranscribedAudio, TranscriptLinesWithTimes,
} from './types';
import { AudioProvenanceVis } from '../../../components/audioAnalysis/AudioProvenanceVis';
import { StorageEngine } from '../../../storage/engines/types';
import { TranscriptLines } from './TextEditorComponents/TranscriptLines';
import { TagSelector } from './TextEditorComponents/TagSelector';
import { getSequenceFlatMap } from '../../../utils/getSequenceFlatMap';

const margin = {
  left: 5, top: 0, right: 5, bottom: 0,
};

function getParticipantData(trrackId: string | undefined, storageEngine: StorageEngine | undefined) {
  if (storageEngine) {
    return storageEngine.getParticipantData(trrackId);
  }

  return null;
}

async function getParticipantTags(authEmail: string, trrackId: string | undefined, task: string, storageEngine: StorageEngine | undefined) {
  if (storageEngine && trrackId) {
    return (await storageEngine.getAllParticipantAndTaskTags(authEmail, trrackId, task));
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
  visibleParticipants, rawTranscript, currentShownTranscription, width, onTimeUpdate, isReplay, editedTranscript, currentTrial, saveProvenance, jumpedToLine = 0,
} : {visibleParticipants: string[], rawTranscript: TranscribedAudio | null, currentShownTranscription: number | null, width: number, onTimeUpdate: (n: number) => void, isReplay: boolean, editedTranscript?: EditedText[], currentTrial: string, saveProvenance?: (prov: unknown) => void, jumpedToLine?: number}) {
  const { storageEngine } = useStorageEngine();

  const auth = useAuth();

  const [speed, setSpeed] = useState<number>(1);

  const [searchParams, setSearchParams] = useSearchParams();

  const participantId = useMemo(() => searchParams.get('participantId') || '', [searchParams]);

  const { value: participant } = useAsync(getParticipantData, [participantId, storageEngine]);

  const { value: taskTags, execute: pullTags } = useAsync(getTags, [storageEngine, 'task']);

  const { value: allPartTags, execute: pullAllPartTags } = useAsync(getTags, [storageEngine, 'participant']);
  const [analysisIsPlaying, _setAnalysisIsPlaying] = useState(false);

  const setAnalysisIsPlaying = useCallback((playing: boolean) => {
    localStorage.setItem('analysisIsPlaying', playing ? 'true' : 'false');
    _setAnalysisIsPlaying(playing);
  }, []);

  const [transcriptLines, setTranscriptLines] = useState<TranscriptLinesWithTimes[] | null>(null);

  const { value: partTags, execute: pullPartTags } = useAsync(getParticipantTags, [auth.user.user?.email || 'temp', participantId, currentTrial, storageEngine]);

  // shouldnt this not work? I thought we needed to do something smarter because of dynamic stuff
  const currentTrialClean = useMemo(() => {
    const split = currentTrial.split('_');
    const joinExceptLast = split.slice(0, split.length - 1).join('_');

    return joinExceptLast;
  }, [currentTrial]);

  const trialFilterAnswersName = useMemo(() => {
    if (!currentTrial || !participant) {
      return null;
    }

    return Object.keys(participant.answers).find((key) => key.startsWith(currentTrial)) || null;
  }, [participant, currentTrial]);

  const xScale = useMemo(() => {
    if (!participant) {
      return null;
    }

    const allStartTimes = Object.values(participant.answers || {}).map((answer) => [answer.startTime, answer.endTime]).flat();

    const extent = d3.extent(allStartTimes) as [number, number];

    const scale = d3.scaleLinear([margin.left, width + margin.left + margin.right]).domain(trialFilterAnswersName ? [participant.answers[trialFilterAnswersName].startTime, participant.answers[trialFilterAnswersName].endTime] : extent).clamp(true);

    return scale;
  }, [participant, trialFilterAnswersName, width]);

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
          end: rawTranscript.results[l.transcriptMappingEnd].resultEndTime as number,
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
    setSearchParams({ currentTrial, participantId: visibleParticipants[index] || '' });
  }, [currentTrial, participantId, setSearchParams, visibleParticipants]);

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
      storageEngine.saveTags(_tags, type).then(() => { type === 'task' ? pullTags(storageEngine, type) : pullAllPartTags(storageEngine, type); });
    }
  }, [pullAllPartTags, pullTags, storageEngine]);

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
    if (!allPartTags) {
      return;
    }

    const tagIndex = allPartTags.findIndex((t) => t.id === oldTag.id);
    const tagsCopy = Array.from(allPartTags);
    tagsCopy[tagIndex] = newTag;

    setTags(tagsCopy, 'participant');
  }, [setTags, allPartTags]);

  const createTaskTagCallback = useCallback((t: Tag) => { setTags([...(taskTags || []), t], 'task'); }, [setTags, taskTags]);

  const createParticipantTagCallback = useCallback((t: Tag) => { setTags([...(taskTags || []), t], 'participant'); }, [setTags, taskTags]);

  const jumpedToTime = useMemo(() => (transcriptLines ? transcriptLines[jumpedToLine].start : 0), [jumpedToLine, transcriptLines]);

  return (
    <AppShell.Footer zIndex={101} withBorder={false}>
      <Stack style={{ backgroundColor: 'var(--mantine-color-blue-1)', height: '200px' }} gap={5} justify="center">

        <AudioProvenanceVis jumpedToAudioTime={jumpedToTime} speed={speed} saveProvenance={saveProvenance} analysisIsPlaying={analysisIsPlaying} setAnalysisIsPlaying={setAnalysisIsPlaying} setTime={onTimeUpdate} setTimeString={(_t) => null} answers={participant ? participant.answers : {}} taskName={currentTrial} context={isReplay ? 'provenanceVis' : 'audioAnalysis'} />
        {xScale && transcriptLines ? <TranscriptLines startTime={xScale.domain()[0]} xScale={xScale} transcriptLines={transcriptLines} currentShownTranscription={currentShownTranscription || 0} /> : null }

        <Group style={{ width: '100%' }} justify="center" align="center" wrap="nowrap" mx={20}>
          <Group>
            <Tooltip label="Play">
              <ActionIcon mt={25} variant="light" onClick={() => setAnalysisIsPlaying(!analysisIsPlaying)}>
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
                  onChange={(s) => setSpeed(+s)}
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
                  <ActionIcon size="sm" variant="light" onClick={() => nextParticipantCallback(1)}>
                    <IconArrowRight />
                  </ActionIcon>
                </Tooltip>
                  )}
              label="Participant Id"
              style={{ width: '300px' }}
              styles={{ dropdown: { zIndex: 10001 } }}
              value={participantId}
              onChange={(e: string | null) => {
                setSearchParams({ currentTrial, participantId: e || '' });
                localStorage.setItem('participantId', e || '');
              }}
              data={visibleParticipants.map((part) => part)}
            />

            <Stack gap="4">
              <Text size="sm" fw={500}>Participant Tags</Text>
              <TagSelector
                tags={allPartTags || []}
                editTagCallback={editParticipantTagCallback}
                createTagCallback={createParticipantTagCallback}
                tagsEmptyText="Add Participant Tags"
                onSelectTags={(tempTags) => {
                  if (storageEngine && partTags) {
                    let copy = structuredClone(partTags);
                    if (copy) {
                      copy.partTags = tempTags;
                    } else {
                      copy = { partTags: [], taskTags: {} };
                      copy.partTags = tempTags;
                    }
                    storageEngine.saveAllParticipantAndTaskTags(auth.user.user?.email || 'temp', participantId, currentTrial, copy).then(() => {
                      pullPartTags(auth.user.user?.email || 'temp', participantId, currentTrial, storageEngine);
                    });
                  }
                }}
                selectedTags={partTags ? partTags.partTags : []}
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
                  <ActionIcon size="sm" variant="light" onClick={() => nextTaskCallback(1)}>
                    <IconArrowRight />
                  </ActionIcon>
                </Tooltip>
                  )}
              label="Task"
              style={{ width: '300px' }}
              styles={{ dropdown: { zIndex: 10001 } }}
              value={currentTrialClean}
            // this needs to be in a helper or two which we dont currently have
              onChange={(e: string | null) => {
                if (participant && e) {
                  const trial = Object.entries(participant.answers).find(([_key, ans]) => +ans.trialOrder.split('_')[0] === getSequenceFlatMap(participant?.sequence).indexOf(e))?.[0] || '';
                  setSearchParams({ participantId, currentTrial: trial });
                  localStorage.setItem('currentTrial', trial);
                }
              }}
              data={participant ? getSequenceFlatMap(participant?.sequence) : []}
            />
            <Stack gap="4">
              <Text size="sm" fw={500}>Task Tags</Text>
              <TagSelector
                tags={taskTags || []}
                editTagCallback={editTaskTagCallback}
                createTagCallback={createTaskTagCallback}
                tagsEmptyText="Add Task Tags"
                onSelectTags={(tempTag) => {
                  if (storageEngine && partTags) {
                    let copy = structuredClone(partTags);
                    if (copy) {
                      copy.taskTags[currentTrial] = tempTag;
                    } else {
                      copy = { partTags: [], taskTags: {} };
                      copy.taskTags[currentTrial] = tempTag;
                    }
                    storageEngine.saveAllParticipantAndTaskTags(auth.user.user?.email || 'temp', participantId, currentTrial, copy).then(() => {
                      pullPartTags(auth.user.user?.email || 'temp', participantId, currentTrial, storageEngine);
                    });
                  }
                }}
                selectedTags={partTags ? partTags.taskTags[currentTrial] || [] : []}
              />
            </Stack>
          </Group>
        </Group>
      </Stack>
    </AppShell.Footer>
  );
}
