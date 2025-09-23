/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Box, Center, Group, Loader, Stack,
} from '@mantine/core';
import { useSearchParams, useNavigate } from 'react-router';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useResizeObserver, useThrottledCallback } from '@mantine/hooks';
import { WaveForm, WaveSurfer } from 'wavesurfer-react';
import * as d3 from 'd3';
import {
  Registry, Trrack, initializeTrrack, isRootNode,
} from '@trrack/core';
import WaveSurferType from 'wavesurfer.js';
import { useCurrentComponent, useCurrentIdentifier, useCurrentStep } from '../../routes/utils';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { useStoreActions, useStoreDispatch, useStoreSelector } from '../../store/store';
import { WithinTaskTimeline } from './WithinTaskTimeline';
import { useIsAnalysis } from '../../store/hooks/useIsAnalysis';
import { Timer } from './Timer';
import { humanReadableDuration } from '../../utils/humanReadableDuration';
import { ResponseBlockLocation } from '../../parser/types';
import { useUpdateProvenance } from './useUpdateProvenance';
import { useEvent } from '../../store/hooks/useEvent';

const margin = {
  left: 0, top: 0, right: 0, bottom: 0,
};

function safe<T>(p: Promise<T>): Promise<T | null> {
  return p.catch(() => null);
}

export function AudioProvenanceVis({ setTimeString }: { setTimeString: (time: string) => void }) {
  const [searchParams] = useSearchParams();
  const participantId = useMemo(() => searchParams.get('participantId') || undefined, [searchParams]);
  const timestamp = useMemo(() => searchParams.get('t') || undefined, [searchParams]);

  const replayTimestamp = useMemo(() => {
    if (!timestamp) {
      return undefined;
    }

    // If the timestamp is already in milliseconds, return it
    if (!Number.isNaN(Number(timestamp))) {
      return parseInt(timestamp, 10);
    }

    const hours = parseInt(timestamp.match(/(\d+)h/)?.[1] || '0', 10);
    const minutes = parseInt(timestamp.match(/(\d+)m/)?.[1] || '0', 10);
    const seconds = parseInt(timestamp.match(/(\d+)s/)?.[1] || '0', 10);

    const milliseconds = (hours * 3600 + minutes * 60 + seconds) * 1000;
    return milliseconds;
  }, [timestamp]);

  const { storageEngine } = useStorageEngine();

  const analysisIsPlaying = useStoreSelector((state) => state.analysisIsPlaying);
  const analysisHasAudio = useStoreSelector((state) => state.analysisHasAudio);

  const {
    saveAnalysisState, setAnalysisHasAudio, setAnalysisIsPlaying, setProvenanceJumpTime,
  } = useStoreActions();
  const storeDispatch = useStoreDispatch();

  const currentComponent = useCurrentComponent();
  const currentStep = useCurrentStep();
  useEffect(() => { storeDispatch(saveAnalysisState({ prov: undefined, location: 'stimulus' })); }, [currentStep, saveAnalysisState, storeDispatch]);

  const [ref, { width }] = useResizeObserver();
  const [waveSurferWidth, setWaveSurferWidth] = useState<number>(0);

  const [currentNode, setCurrentNode] = useState<string | null>(null);
  const [currentResponseNodes, setCurrentResponseNodes] = useState<Record<ResponseBlockLocation, string | undefined>>({
    aboveStimulus: undefined,
    belowStimulus: undefined,
    sidebar: undefined,
    stimulus: undefined,
  });
  const [currentGlobalNode, setCurrentGlobalNode] = useState<{name: string, time: number} | null>(null);

  const [totalAudioLength, setTotalAudioLength] = useState<number>(0);

  const answers = useStoreSelector((state) => state.answers);

  const [playTime, setPlayTime] = useState<number>(0);

  const currentTimeRef = useRef<number>(0); // time in seconds

  const waveSurferDiv = useRef(null);

  const [waveSurferLoading, setWaveSurferLoading] = useState<boolean>(true);

  const trrackForTrial = useRef<Trrack<object, string> | null>(null);

  const identifier = useCurrentIdentifier();

  const _setCurrentResponseNodes = useEvent((node: string | null, location: ResponseBlockLocation) => {
    const graph = answers[identifier]?.provenanceGraph[location];
    if (graph && node) {
      if (!currentGlobalNode || graph.nodes[node].createdOn > currentGlobalNode.time || playTime < currentGlobalNode.time) {
        setCurrentGlobalNode({ name: node || '', time: graph.nodes[node].createdOn });
      }
    }

    setCurrentResponseNodes({ ...currentResponseNodes, [location]: node });
  });

  useUpdateProvenance('aboveStimulus', playTime, answers[identifier]?.provenanceGraph.aboveStimulus, currentResponseNodes.aboveStimulus, _setCurrentResponseNodes);

  useUpdateProvenance('belowStimulus', playTime, answers[identifier]?.provenanceGraph.belowStimulus, currentResponseNodes.belowStimulus, _setCurrentResponseNodes);

  useUpdateProvenance('sidebar', playTime, answers[identifier]?.provenanceGraph.sidebar, currentResponseNodes.sidebar, _setCurrentResponseNodes);

  // Make sure we always pause analysis when we change participants or tasks
  useEffect(() => {
    storeDispatch(setAnalysisIsPlaying(false));
  }, [participantId, currentComponent, currentStep, storeDispatch, setAnalysisIsPlaying, identifier]);
  // Create an instance of trrack to ensure getState works, incase the saved state is not a full state node.
  useEffect(() => {
    if (identifier && answers[identifier]?.provenanceGraph) {
      const reg = Registry.create();

      const trrack = initializeTrrack({ registry: reg, initialState: {} });

      if (answers[identifier]?.provenanceGraph.stimulus) {
        trrack.importObject(structuredClone(answers[identifier]?.provenanceGraph!.stimulus));

        trrackForTrial.current = trrack;
      }
    }
  }, [answers, identifier, storeDispatch]);

  const _setCurrentNode = useCallback((node: string | undefined) => {
    if (!node) {
      return;
    }

    if (identifier && trrackForTrial.current) {
      storeDispatch(saveAnalysisState({ prov: trrackForTrial.current.getState(answers[identifier]?.provenanceGraph.stimulus?.nodes[node]), location: 'stimulus' }));

      trrackForTrial.current.to(node);
    }

    _setCurrentResponseNodes(node, 'stimulus');
    setCurrentNode(node);
  }, [identifier, _setCurrentResponseNodes, storeDispatch, saveAnalysisState, answers]);

  // use effect to control the current provenance node based on the changing playtime.
  useEffect(() => {
    if (!identifier || !trrackForTrial.current || !answers[identifier]?.provenanceGraph) {
      return;
    }
    const provGraph = answers[identifier]?.provenanceGraph;

    if (!provGraph.stimulus) {
      return;
    }

    if (!currentNode || !provGraph.stimulus.nodes[currentNode]) {
      _setCurrentNode(provGraph.stimulus.root as string);
      return;
    }

    let tempNode = provGraph.stimulus.nodes[currentNode];

    while (true) {
      if (playTime < tempNode.createdOn) {
        if (!isRootNode(tempNode)) {
          const parentNode = tempNode.parent;

          tempNode = provGraph.stimulus.nodes[parentNode];
        } else break;
      } else if (tempNode.children.length > 0) {
        const child = tempNode.children[0];

        if (playTime > provGraph.stimulus.nodes[child].createdOn) {
          tempNode = provGraph.stimulus.nodes[child];
        } else break;
      } else break;
    }

    if (tempNode.id !== currentNode) {
      _setCurrentNode(tempNode.id);
    }
  }, [_setCurrentNode, currentNode, participantId, playTime, identifier, answers]);

  const startTime = useMemo(() => answers[identifier]?.startTime || 0, [answers, identifier]);

  useEffect(() => {
    if (startTime) {
      setPlayTime(startTime + (replayTimestamp || 0));
      currentTimeRef.current = replayTimestamp || 0;
    }
  }, [startTime, replayTimestamp]);

  useEffect(() => {
    if (totalAudioLength === 0) {
      setTimeString('');
    } else if (playTime !== 0) {
      setTimeString(`${humanReadableDuration(playTime - startTime)} / ${humanReadableDuration(totalAudioLength * 1000)}`);
    }
  }, [identifier, playTime, setTimeString, startTime, totalAudioLength]);

  useEffect(() => {
    if (!analysisHasAudio) {
      // eslint-disable-next-line no-unsafe-optional-chaining
      const length = answers[identifier]?.endTime - answers[identifier]?.startTime;
      setTotalAudioLength(length > -1 ? length / 1000 : 0);
    }
  }, [analysisHasAudio, answers, identifier]);

  const navigate = useNavigate();

  useEffect(() => {
    if (totalAudioLength > 0 && replayTimestamp) {
      const maxTime = totalAudioLength * 1000;

      if (replayTimestamp > maxTime) {
        navigate(`?participantId=${participantId}&t=${maxTime}`);
      }
    }
  }, [totalAudioLength, replayTimestamp, participantId, navigate]);

  const isAnalysis = useIsAnalysis();
  const wavesurfer = useRef<WaveSurferType | null>(null);

  const handleWSMount = useCallback(
    async (waveSurfer: WaveSurferType | null) => {
      wavesurfer.current = waveSurfer;
      if (identifier.includes('__dynamicLoading')) {
        return;
      }
      if (waveSurfer && isAnalysis && identifier && storageEngine) {
        try {
          if (!participantId) {
            throw new Error('Participant ID is required to load audio');
          }

          const [audioUrl, screenUrl] = await Promise.all([
            safe(storageEngine.getAudio(identifier, participantId)),
            safe(storageEngine.getScreenRecording(identifier, participantId)),
          ]);

          if (screenUrl) {
            // Audio is played from the screen recording video.
            wavesurfer.current?.setMuted(true);
          }

          const url = audioUrl ?? screenUrl ?? null;
          await waveSurfer.load(url!);
          setWaveSurferLoading(false);
          storeDispatch(setAnalysisHasAudio(true));

          setTotalAudioLength(waveSurfer.getDuration());
          setWaveSurferWidth(waveSurfer.getWidth());
          waveSurfer.seekTo(0);
          waveSurfer.on('redrawcomplete', () => setWaveSurferWidth(waveSurfer.getWidth()));
        } catch (error: any) {
          storeDispatch(setAnalysisHasAudio(false));
          throw new Error(error);
        }
      } else {
        storeDispatch(setAnalysisHasAudio(false));
        setTotalAudioLength(0);
      }
    },
    [identifier, isAnalysis, storageEngine, participantId, storeDispatch, setAnalysisHasAudio],
  );

  const _setPlayTime = useThrottledCallback((n: number, percent: number | undefined) => {
    // if were past the end, pause the timer
    const audioEndTime = totalAudioLength * 1000 + startTime;

    currentTimeRef.current = n - startTime;

    if (n > audioEndTime) {
      storeDispatch(setAnalysisIsPlaying(false));
      setPlayTime(n);

      return;
    }

    setPlayTime(n);

    if (wavesurfer.current && percent !== undefined && !Number.isNaN(percent)) {
      setTimeout(() => {
        wavesurfer.current?.seekTo(percent);
      });
    }
  }, 100); // 100ms throttle

  useEffect(() => {
    if (wavesurfer.current) {
      if (analysisIsPlaying) {
        wavesurfer.current.play();
      } else {
        wavesurfer.current.pause();
      }
    }
  }, [wavesurfer, analysisIsPlaying, totalAudioLength, startTime, setPlayTime]);

  useEffect(() => {
    storeDispatch(setProvenanceJumpTime(currentTimeRef.current));
  }, [analysisIsPlaying, setProvenanceJumpTime, storeDispatch]);

  const handleClickUpdateTimer = useCallback(() => {
    storeDispatch(setProvenanceJumpTime(currentTimeRef.current));
  }, [setProvenanceJumpTime, storeDispatch]);

  const xScale = useMemo(() => {
    if (!answers[identifier]?.startTime || !answers[identifier]?.endTime) {
      return null;
    }

    // eslint-disable-next-line no-unsafe-optional-chaining
    const endTime = totalAudioLength > 0 ? answers[identifier]?.startTime + totalAudioLength * 1000 : answers[identifier]?.endTime;

    const scale = d3.scaleLinear([margin.left, width + margin.left + margin.right]).domain([answers[identifier]?.startTime, endTime]).clamp(true);

    return scale;
  }, [answers, identifier, totalAudioLength, width]);

  useEffect(() => {
    handleWSMount(wavesurfer.current);
  }, [_setPlayTime, handleWSMount, participantId, wavesurfer]);

  return (
    <Group wrap="nowrap" gap={10} mx={10}>
      <Stack ref={ref} style={{ width: '100%' }} gap={0}>
        <Center />
        {participantId !== undefined && identifier
          ? (
            <Box
              ref={waveSurferDiv}
              style={{
                overflow: 'hidden', width: '100%', pointerEvents: 'none',
              }}
              display={analysisHasAudio ? 'block' : 'none'}
              id="waveformDiv"
            >
              <WaveSurfer onMount={handleWSMount} plugins={[]} container="#waveformDiv" height={50} waveColor="#484848" progressColor="#e15759" barHeight={0} cursorColor="rgba(0, 0, 0, 0)">
                <WaveForm id="waveform" height={50} />
              </WaveSurfer>
              {waveSurferLoading ? <Loader /> : null}
            </Box>
          ) : null}

        {xScale && identifier && answers[identifier]?.provenanceGraph
          ? (
            <WithinTaskTimeline
              xScale={xScale}
              trialName={identifier}
              currentNode={currentGlobalNode?.name || ''}
              answers={answers}
              width={waveSurferWidth || width}
              height={25}
            />
          ) : null}
        {xScale ? (
          <Timer
            duration={totalAudioLength * 1000}
            height={(analysisHasAudio ? 50 : 0) + 25}
            isPlaying={analysisIsPlaying}
            startTime={startTime}
            width={width}
            xScale={xScale}
            updateTimer={_setPlayTime}
            initialTime={replayTimestamp ? startTime + replayTimestamp : undefined}
            onClickUpdateTimer={handleClickUpdateTimer}
          />
        ) : null}
      </Stack>
    </Group>
  );
}
