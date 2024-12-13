/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ActionIcon,
  Box, Center, Group, Loader, Select, Stack,
} from '@mantine/core';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useResizeObserver, useThrottledState } from '@mantine/hooks';
import { WaveForm, useWavesurfer } from 'wavesurfer-react';
import WaveSurferContext from 'wavesurfer-react/dist/contexts/WaveSurferContext';
import Crunker from 'crunker';
import * as d3 from 'd3';
import {
  Registry, Trrack, initializeTrrack, isRootNode,
} from '@trrack/core';
import WaveSurfer from 'wavesurfer.js';
import { IconPlayerPauseFilled, IconPlayerPlayFilled } from '@tabler/icons-react';
import { PluginDictionary } from 'wavesurfer-react/dist/hooks/useWavesurfer';
import { GenericPlugin } from 'wavesurfer.js/dist/base-plugin';
import { StorageEngine } from '../../storage/engines/StorageEngine';
import { useCurrentComponent, useCurrentStep } from '../../routes/utils';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { useAsync } from '../../store/hooks/useAsync';
import { useStoreActions, useStoreDispatch } from '../../store/store';
import { deepCopy } from '../../utils/deepCopy';
import { useEvent } from '../../store/hooks/useEvent';
import { SingleTaskTimeline } from './SingleTaskTimeline';

const margin = {
  left: 0, top: 0, right: 5, bottom: 0,
};

function getParticipantData(trrackId: string | undefined, storageEngine: StorageEngine | undefined) {
  if (storageEngine) {
    return storageEngine.getParticipantData(trrackId);
  }

  return null;
}

function getAllParticipantIds(storageEngine: StorageEngine | undefined) {
  if (storageEngine) {
    return storageEngine.getAllParticipantsData();
  }

  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function AnalysisPopout({ setPercent } : {setPercent: (n: number) => void}) {
  const { participantId } = useParams();
  const { storageEngine } = useStorageEngine();

  const { saveAnalysisState } = useStoreActions();
  const storeDispatch = useStoreDispatch();

  const currentComponent = useCurrentComponent();
  const currentStep = useCurrentStep();
  useEffect(() => { storeDispatch(saveAnalysisState(null)); }, [currentStep, saveAnalysisState, storeDispatch]);

  const [ref, { width }] = useResizeObserver();
  const [waveSurferWidth, setWaveSurferWidth] = useState<number>(0);

  const [currentNode, setCurrentNode] = useState<string | null>(null);
  const totalAudioLength = useRef<number>(0);

  const { value: participant, status } = useAsync(getParticipantData, [participantId, storageEngine]);

  const { value: allParticipants } = useAsync(getAllParticipantIds, [storageEngine]);

  const [hasAudio, setHasAudio] = useState<boolean>(false);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playTime, setPlayTime] = useThrottledState<number>(0, 200);

  const waveSurferDiv = useRef(null);

  const [waveSurferLoading, setWaveSurferLoading] = useState<boolean>(true);

  const trrackForTrial = useRef<Trrack<object, string> | null>(null);

  const componentAndIndex = useMemo(() => `${currentComponent}_${currentStep}`, [currentComponent, currentStep]);

  // Create an instance of trrack to ensure getState works, incase the saved state is not a full state node.
  useEffect(() => {
    if (componentAndIndex && participant && participant.answers[componentAndIndex]?.provenanceGraph) {
      const reg = Registry.create();

      const trrack = initializeTrrack({ registry: reg, initialState: {} });

      if (participant.answers[componentAndIndex].provenanceGraph) {
        trrack.importObject(deepCopy(participant.answers[componentAndIndex].provenanceGraph!));

        trrackForTrial.current = trrack;
      }
    }
  }, [participant, componentAndIndex]);

  const _setCurrentNode = useCallback((node: string | undefined) => {
    if (!node) {
      return;
    }

    if (componentAndIndex && participant && trrackForTrial.current) {
      storeDispatch(saveAnalysisState(trrackForTrial.current.getState(participant.answers[componentAndIndex].provenanceGraph?.nodes[node])));

      trrackForTrial.current.to(node);
    }

    setCurrentNode(node);
  }, [participant, saveAnalysisState, storeDispatch, componentAndIndex]);

  const timeUpdate = useEvent((t: number) => {
    if (participant && currentComponent && componentAndIndex) {
      const { startTime } = participant.answers[componentAndIndex];
      setPlayTime(t * 1000 + startTime);

      setPercent((t / totalAudioLength.current) * 100);
    }
  });

  // use effect to control the current provenance node based on the changing playtime.
  useEffect(() => {
    if (!componentAndIndex || !participant || !trrackForTrial.current || !participant.answers[componentAndIndex]?.provenanceGraph) {
      return;
    }
    const provGraph = participant.answers[componentAndIndex].provenanceGraph;

    if (!provGraph) {
      return;
    }

    if (!currentNode || !provGraph.nodes[currentNode]) {
      _setCurrentNode(provGraph.root as string);
      return;
    }

    let tempNode = provGraph.nodes[currentNode];

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (playTime < tempNode.createdOn) {
        if (!isRootNode(tempNode)) {
          const parentNode = tempNode.parent;

          tempNode = provGraph.nodes[parentNode];
        } else break;
      } else if (tempNode.children.length > 0) {
        const child = tempNode.children[0];

        if (playTime > provGraph.nodes[child].createdOn) {
          tempNode = provGraph.nodes[child];
        } else break;
      } else break;
    }

    if (tempNode.id !== currentNode) {
      _setCurrentNode(tempNode.id);
    }
  }, [_setCurrentNode, currentNode, participant, participantId, playTime, componentAndIndex]);

  const handleWSMount = useCallback(
    (waveSurfer: WaveSurfer | null) => {
      if (waveSurfer && participant && participantId && componentAndIndex) {
        const crunker = new Crunker();

        storageEngine?.getAudio([componentAndIndex], participantId).then((urls) => {
          if (waveSurfer) {
            crunker
              .fetchAudio(...urls)
              .then((buffers) => crunker.concatAudio(buffers))
              .then((merged) => crunker.export(merged, 'audio/mp3'))
              .then((output) => waveSurfer.loadBlob(output.blob).then(() => { setWaveSurferLoading(false); setHasAudio(true); }));
          }

          totalAudioLength.current = waveSurfer.getDuration();
          setWaveSurferWidth(waveSurfer.getWidth());
          waveSurfer.seekTo(0);
          waveSurfer.on('timeupdate', timeUpdate);
          waveSurfer.on('redrawcomplete', () => setWaveSurferWidth(waveSurfer.getWidth()));
        }).catch((error) => {
          setHasAudio(false);
          throw new Error(error);
        });
      }
    },
    [participant, participantId, componentAndIndex, storageEngine, timeUpdate],
  );

  const plugins = useMemo(() => [], []);

  const [wavesurfer] = useWavesurfer({
    container: waveSurferDiv.current!, plugins, onMount: handleWSMount, progressColor: 'cornflowerblue', waveColor: 'lightgray',
  } as any);

  const _setPlayTime = useCallback((n: number, percent: number) => {
    setPlayTime(n);

    setPercent(percent);

    if (wavesurfer && percent) {
      setTimeout(() => {
        wavesurfer.seekTo(percent);
      });
    }
  }, [setPercent, setPlayTime, wavesurfer]);

  const _setIsPlaying = useCallback((b: boolean) => {
    setIsPlaying(b);

    if (wavesurfer) {
      if (b) {
        wavesurfer.play();
      } else {
        wavesurfer.pause();
      }
    }
  }, [wavesurfer]);

  const xScale = useMemo(() => {
    if (!participant || !participant.answers[componentAndIndex]?.startTime || !participant.answers[componentAndIndex]?.endTime) {
      return null;
    }

    const allStartTimes = Object.values(participant.answers || {}).map((answer) => [answer.startTime, answer.endTime]).flat();

    const extent = d3.extent(allStartTimes) as [number, number];

    const scale = d3.scaleLinear([margin.left, width + margin.left + margin.right]).domain(componentAndIndex ? [participant.answers[componentAndIndex].startTime, participant.answers[componentAndIndex].endTime] : extent).clamp(true);

    return scale;
  }, [participant, componentAndIndex, width]);

  useEffect(() => {
    handleWSMount(wavesurfer);
  }, [handleWSMount, participant, participantId, wavesurfer]);

  const navigate = useNavigate();

  const fullWaveSurferObj: [WaveSurfer, PluginDictionary<GenericPlugin>, GenericPlugin[]] = useMemo(() => [wavesurfer, {}, []], [wavesurfer]);

  return (
    <Group wrap="nowrap" gap={25}>
      <Stack ref={ref} style={{ width: '100%' }} gap={0}>
        <Group wrap="nowrap">
          <Center />
          { xScale && participant !== null && (componentAndIndex ? participant.answers[componentAndIndex] !== undefined : true)
            ? (
              <Box
                ref={waveSurferDiv}
                style={{
                  overflow: 'visible', width: '100%',
                }}
                display={hasAudio ? 'block' : 'none'}
              >
                <WaveSurferContext.Provider value={fullWaveSurferObj}>
                  <WaveForm id="waveform" />
                </WaveSurferContext.Provider>
                {waveSurferLoading ? <Loader /> : null}
              </Box>
            ) : null }
        </Group>

        {status === 'success' && participant && xScale && componentAndIndex && participant.answers[componentAndIndex].provenanceGraph
          ? (
            <SingleTaskTimeline
              xScale={xScale}
              trialName={componentAndIndex}
              setPlayTime={_setPlayTime}
              currentNode={currentNode}
              setCurrentNode={_setCurrentNode}
              participantData={participant}
              width={waveSurferWidth || width}
              height={50}
            />
          ) : null}
        <Center>
          <Group>
            <ActionIcon variant="light" size={50} onClick={() => _setIsPlaying(!isPlaying)}>{isPlaying ? <IconPlayerPauseFilled /> : <IconPlayerPlayFilled />}</ActionIcon>
            <Select
              style={{ width: '300px' }}
              value={participant?.participantId || ''}
              onChange={(e) => {
                navigate(`../../${e}/0`, { relative: 'path' });
              }}
              data={allParticipants ? [...new Set(allParticipants.map((part) => part.participantId))] : []}
            />
          </Group>
        </Center>
      </Stack>
    </Group>
  );
}
