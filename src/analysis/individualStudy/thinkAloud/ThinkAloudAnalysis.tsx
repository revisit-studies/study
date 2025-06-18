import {
  ActionIcon,
  Box, Center, Group, Loader, Select, Stack,
} from '@mantine/core';
import { useNavigate, useParams } from 'react-router';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useResizeObserver, useThrottledState } from '@mantine/hooks';
import { WaveForm, useWavesurfer } from 'wavesurfer-react';
import WaveSurferContext from 'wavesurfer-react/dist/contexts/WaveSurferContext';
import Crunker from 'crunker';
import * as d3 from 'd3';
import { Registry, Trrack, initializeTrrack } from '@trrack/core';
import WaveSurfer from 'wavesurfer.js';
import {
  IconArrowLeft, IconArrowRight, IconPlayerPauseFilled,
  IconPlayerPlayFilled,
} from '@tabler/icons-react';
import debounce from 'lodash.debounce';
import throttle from 'lodash.throttle';

import { useAsync } from '../../../store/hooks/useAsync';
import { StorageEngine } from '../../../storage/engines/StorageEngine';
import { useStudyConfig } from '../../../store/hooks/useStudyConfig';
import { useEvent } from '../../../store/hooks/useEvent';
import { useStoreActions, useStoreDispatch } from '../../../store/store';
import { useStorageEngine } from '../../../storage/storageEngineHooks';
import { getSequenceFlatMap } from '../../../utils/getSequenceFlatMap';
import { useCurrentComponent } from '../../../routes/utils';
import { useAuth } from '../../../store/hooks/useAuth';
import { ParticipantData } from '../../../storage/types';
import { StudyConfig } from '../../../parser/types';
import { EditedText, TranscriptLinesWithTimes } from './types';
import { AllTasksTimeline } from '../replay/AllTasksTimeline';
import { TextEditor } from './TextEditor';
import { AudioProvenanceVis } from '../../../components/audioAnalysis/AudioProvenanceVis';

const margin = {
  left: 5, top: 0, right: 5, bottom: 0,
};

function getParticipantData(trrackId: string | undefined, storageEngine: StorageEngine | undefined) {
  if (storageEngine) {
    return storageEngine.getParticipantData(trrackId);
  }

  return null;
}

async function getTranscript(storageEngine: StorageEngine | undefined, partId: string | undefined, trialName: string | undefined, authEmail: string | null | undefined) {
  if (storageEngine && partId && trialName && authEmail) {
    return await storageEngine.getEditedTranscript(partId, authEmail, trialName);
  }

  return null;
}

async function getParticipantTags(trrackId: string | undefined, storageEngine: StorageEngine | undefined) {
  if (storageEngine && trrackId) {
    return (await storageEngine.getAllParticipantAndTaskTags());
  }

  return null;
}

async function getTags(storageEngine: StorageEngine | undefined, type: 'participant' | 'task' | 'text') {
  if (storageEngine) {
    return await storageEngine.getTags(type);
  }

  return [];
}

export function ThinkAloudAnalysis({ visibleParticipants, studyConfig } : {visibleParticipants: ParticipantData[]; studyConfig: StudyConfig}) {
  // const trialFilter = useCurrentComponent();

  const { storageEngine } = useStorageEngine();

  const auth = useAuth();

  const allPartIds = useMemo(() => {
    if (visibleParticipants && visibleParticipants.length > 0) {
      return visibleParticipants.map((part) => part.participantId);
    }
    return [];
  }, [visibleParticipants]);

  const [currentShownTranscription, setCurrentShownTranscription] = useState(0);

  const [ref, { width }] = useResizeObserver();

  const [participantId, setParticipantId] = useState<string>(visibleParticipants.length > 0 ? visibleParticipants[0].participantId : '');
  const [currentTrial, setCurrentTrial] = useState<string | undefined>();

  const [currentNode, setCurrentNode] = useState<string | null>(null);

  const { value: participant, status } = useAsync(getParticipantData, [participantId, storageEngine]);

  const { value: partTags, execute: pullPartTags } = useAsync(getParticipantTags, [participantId, storageEngine]);

  // const { saveAnalysisState } = useStoreActions();
  // const storeDispatch = useStoreDispatch();

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playTime, setPlayTime] = useThrottledState<number>(0, 200);

  const waveSurferDiv = useRef(null);

  const navigate = useNavigate();

  //   const { analysisTrialName: trialName, analysisWaveformTime } = useStoreSelector((state) => state);

  //   const { setAnalysisTrialName, setAnalysisParticipantName, setAnalysisWaveformTime } = useStoreActions();

  const { value: taskTags, execute: pullTaskTags } = useAsync(getTags, [storageEngine, 'task']);

  const [waveSurferLoading, setWaveSurferLoading] = useState<boolean>(true);

  const trrackForTrial = useRef<Trrack<object, string> | null>(null);

  const [transcriptLines, setTranscriptLines] = useState<TranscriptLinesWithTimes[]>([]);

  const [transcriptList, _setTranscriptList] = useState<EditedText[] | null>(null);

  const debouncedSave = useMemo(() => {
    if (storageEngine && participantId && currentTrial) {
      return debounce((editedText: EditedText[]) => storageEngine.saveEditedTranscript(participantId, auth.user.user?.email || 'temp', currentTrial, editedText), 1000, { maxWait: 5000 });
    }

    return (_editedText: EditedText[]) => null;
  }, [currentTrial, auth.user.user?.email, storageEngine, participantId]);

  const setTranscriptList = useCallback((editedText: EditedText[]) => {
    _setTranscriptList(editedText);
    debouncedSave(editedText);
  }, [debouncedSave]);

  const { value: onlineTranscriptList, status: transcriptStatus } = useAsync(getTranscript, [storageEngine, participant?.participantId, currentTrial, auth.user.user?.email]);

  useEffect(() => {
    if (onlineTranscriptList && transcriptStatus === 'success') {
      _setTranscriptList(onlineTranscriptList);
    } else {
      _setTranscriptList(null);
    }
  }, [onlineTranscriptList, transcriptStatus]);

  const trialFilterAnswersName = useMemo(() => {
    if (!currentTrial || !participant) {
      return null;
    }

    return Object.keys(participant.answers).find((key) => key.startsWith(currentTrial)) || null;
  }, [participant, currentTrial]);
    // Create an instance of trrack to ensure getState works, incase the saved state is not a full state node.

  //   const setSelectedTask = useCallback((s: string) => {
  //     storeDispatch(setAnalysisTrialName(s));
  //     storeDispatch(saveAnalysisState(null));
  //     setCurrentShownTranscription(0);

  //     const sFullName = participant ? Object.keys(participant.answers).find((key) => key.startsWith(s)) : '';

  //     if (participant && sFullName && participant.answers[sFullName].provenanceGraph) {
  //       const reg = Registry.create();
  //     }
  //   }, [_setCurrentNode, mini, participant, saveAnalysisState, setAnalysisTrialName, storeDispatch]);

  //   useEffect(() => {
  //     if (trialFilter) {
  //       setSelectedTask(trialFilter);
  //     }
  //   }, [setSelectedTask, trialFilter]);

  //   const _setPlayTime = useCallback((n: number, percent: number) => {
  //     setPlayTime(n);

  //     if (wavesurfer && percent) {
  //       setTimeout(() => {
  //         wavesurfer.seekTo(percent);
  //       });
  //     }
  //   }, [setPlayTime, wavesurfer]);

  //   const _setIsPlaying = useCallback((b: boolean) => {
  //     setIsPlaying(b);

  //     if (wavesurfer) {
  //       if (b) {
  //         wavesurfer.play();
  //       } else {
  //         wavesurfer.pause();
  //       }
  //     }
  //   }, [wavesurfer]);

  //   useEffect(() => {
  //     timeUpdate(analysisWaveformTime, false);

  //     if (wavesurfer && Math.abs(wavesurfer.getCurrentTime() - analysisWaveformTime) > 0.8) {
  //       setTimeout(() => {
  //         wavesurfer.setTime(analysisWaveformTime);
  //       });
  //     }
  //   }, [analysisWaveformTime, timeUpdate, wavesurfer]);

  const xScale = useMemo(() => {
    if (!participant) {
      return null;
    }

    const allStartTimes = Object.values(participant.answers || {}).map((answer) => [answer.startTime, answer.endTime]).flat();

    const extent = d3.extent(allStartTimes) as [number, number];

    const scale = d3.scaleLinear([margin.left, width + margin.left + margin.right]).domain(trialFilterAnswersName ? [participant.answers[trialFilterAnswersName].startTime, participant.answers[trialFilterAnswersName].endTime] : extent).clamp(true);

    return scale;
  }, [participant, trialFilterAnswersName, width]);

  //   const clickNextNode = useCallback((node: string | undefined) => {
  //     if (!node) {
  //       return;
  //     }

  //     if (trialFilterAnswersName && participant && trrackForTrial.current && xScale) {
  //       const fullNode = participant.answers[trialFilterAnswersName].provenanceGraph!.nodes[node];
  //       storeDispatch(saveAnalysisState(trrackForTrial.current.getState(participant.answers[trialFilterAnswersName].provenanceGraph?.nodes[node])));

  //       trrackForTrial.current.to(node);

  //       const totalLength = xScale.domain()[1] - xScale.domain()[0];

  //       _setPlayTime(fullNode.createdOn + 1, (fullNode.createdOn - xScale.domain()[0]) / totalLength);
  //     }
  //   }, [_setPlayTime, participant, saveAnalysisState, storeDispatch, trialFilterAnswersName, xScale]);

  //   const nextParticipantCallback = useCallback((positive: boolean) => {
  //     if (!participant) {
  //       return;
  //     }

  //     const _index = allPartIds.indexOf(participant.participantId);

  //     if (positive) {
  //       navigate(`../../${trialFilter ? '../' : ''}${allPartIds[_index + 1]}/ui/reviewer-${trialFilter || ''}`, { relative: 'path' });
  //     } else {
  //       navigate(`../../${trialFilter ? '../' : ''}${allPartIds[_index - 1]}/ui/reviewer-${trialFilter || ''}`, { relative: 'path' });
  //     }
  //   }, [allPartIds, navigate, participant, trialFilter]);

  return (
    <Group wrap="nowrap" gap={25}>
      <Stack ref={ref} style={{ width: '100%' }} gap={25}>
        {/* <Center>
          <Group>
            <ActionIcon>
              <IconArrowLeft onClick={() => nextParticipantCallback(false)} />
            </ActionIcon>
            <Select
              style={{ width: '300px' }}
              value={participant?.participantId}
              onChange={(e) => {
                storeDispatch(setAnalysisParticipantName(e));
                navigate(`../../${trialFilter ? '../' : ''}${e}/ui/reviewer-${trialFilter || ''}`, { relative: 'path' });
              }}
              data={allPartIds}
            />
            <Select
              style={{ width: '300px' }}
              clearable
              value={trialFilter}
              data={participant ? [...getSequenceFlatMap(participant.sequence)] : []}
              onChange={(val) => navigate(`${trialFilter ? '../' : ''}reviewer-${val || ''}`, { relative: 'path' })}
            />
            <ActionIcon>
              <IconArrowRight onClick={() => nextParticipantCallback(true)} />
            </ActionIcon>
          </Group>
        </Center> */}
        <AudioProvenanceVis setTimeString={(t) => console.log(t)} />
        <Group align="center" justify="center">
          {/* <ActionIcon variant="subtle"><IconArrowLeft onClick={() => clickNextNode((trrackForTrial.current?.current as any).parent)} /></ActionIcon> */}
          {/* <ActionIcon variant="light" size={50} onClick={() => _setIsPlaying(!isPlaying)}>{isPlaying ? <IconPlayerPauseFilled /> : <IconPlayerPlayFilled />}</ActionIcon> */}
          {/* {taskTags && partTags && trialFilter && trrackId ? (
            <TagSelector
              tags={taskTags || []}
              onSelectTags={(tempTag) => {
                if (storageEngine && partTags) {
                  const copy = deepCopy(partTags);
                  if (copy[trrackId as string]) {
                    copy[trrackId].taskTags[trialFilter] = tempTag;
                  } else {
                    copy[trrackId] = { partTags: [], taskTags: {} };

                    copy[trrackId].taskTags[trialFilter] = tempTag;
                  }

                  storageEngine.saveAllParticipantAndTaskTags(copy).then(() => {
                    pullPartTags(trrackId, storageEngine);
                  });
                }
              }}
              selectedTags={partTags && (partTags as Record<string, ParticipantTags>)[trrackId] ? (partTags as Record<string, ParticipantTags>)[trrackId].taskTags[trialFilter] || [] : []}
            />
          ) : null} */}
          {/* <Button onClick={() => _setIsPlaying(true)}>Play</Button>
            <Button onClick={() => _setIsPlaying(false)}>Pause</Button> */}
          {/* <ActionIcon variant="subtle"><IconArrowRight onClick={() => clickNextNode(trrackForTrial.current?.current.children[0])} /></ActionIcon> */}
        </Group>

        {/* { trialFilter ? (
          <Stack>
            {participant && onlineTranscriptList && transcriptStatus === 'success' && transcriptList ? <TextEditor transcriptList={transcriptList} setTranscriptList={setTranscriptList} setCurrentShownTranscription={setCurrentShownTranscription} currentShownTranscription={currentShownTranscription} participant={participant} playTime={playTime} setTranscriptLines={setTranscriptLines as any} /> : <Loader /> }
          </Stack>
        ) : null} */}
      </Stack>
    </Group>
  );
}
