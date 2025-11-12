import {
  Box, Group, LoadingOverlay, Stack,
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
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { WithinTaskTimeline } from './WithinTaskTimeline';
import { useIsAnalysis } from '../../store/hooks/useIsAnalysis';
import { Timer } from './Timer';
import { youtubeReadableDuration } from '../../utils/humanReadableDuration';
import { ResponseBlockLocation, StoredAnswer } from '../../parser/types';
import { useEvent } from '../../store/hooks/useEvent';
import { encryptIndex } from '../../utils/encryptDecryptIndex';
import { useUpdateProvenance } from './useUpdateProvenance';

const margin = {
  left: 0, top: 0, right: 0, bottom: 0,
};

function safe<T>(p: Promise<T>): Promise<T | null> {
  return p.catch(() => null);
}

export function AudioProvenanceVis({
  setTimeString, answers, setTime, taskName, context, saveProvenance, analysisIsPlaying, setAnalysisIsPlaying, speed, jumpedToAudioTime, setHasAudio, setSpeed, isMuted, onProvenanceTimelineChange,
}: { setTimeString: (time: string) => void; answers: Record<string, StoredAnswer>, setTime: (time: number) => void, taskName: string, context: 'audioAnalysis' | 'provenanceVis', saveProvenance: ((state: unknown) => void), analysisIsPlaying: boolean, setAnalysisIsPlaying: (b: boolean) => void, speed: number, jumpedToAudioTime: number, setHasAudio: (b: boolean) => void, setSpeed: (n: number) => void, isMuted: boolean, onProvenanceTimelineChange?: (n: number) => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const participantId = useMemo(() => searchParams.get('participantId') || '', [searchParams]);

  const timestamp = useMemo(() => searchParams.get('t') || '', [searchParams]);

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

  const [analysisHasAudio, _setAnalysisHasAudio] = useState(true);

  const setAnalysisHasAudio = useCallback((b: boolean) => {
    _setAnalysisHasAudio(b);
    setHasAudio(b);
  }, [setHasAudio]);

  const [ref, { width }] = useResizeObserver();
  const [waveSurferWidth, setWaveSurferWidth] = useState<number>(0);

  const startTime = useMemo(() => answers[taskName]?.startTime || 0, [answers, taskName]);

  const [currentNode, setCurrentNode] = useState<string | null>(null);
  const [currentResponseNodes, setCurrentResponseNodes] = useState<Record<ResponseBlockLocation, string | undefined>>({
    aboveStimulus: undefined,
    belowStimulus: undefined,
    sidebar: undefined,
    stimulus: undefined,
  });
  const [currentGlobalNode, setCurrentGlobalNode] = useState<{name: string, time: number} | null>(null);

  const [totalAudioLength, setTotalAudioLength] = useState<number>(0);

  const [playTime, setPlayTime] = useState<number>(0);

  const wavesurfer = useRef<WaveSurferType | null>(null);
  const currentTimeRef = useRef<number>(0); // time in seconds

  const waveSurferDiv = useRef(null);

  const navigate = useNavigate();

  const [waveSurferLoading, setWaveSurferLoading] = useState<boolean>(true);

  const trrackForTrial = useRef<Trrack<object, string> | null>(null);

  const _setCurrentResponseNodes = useEvent((node: string | null, location: ResponseBlockLocation) => {
    const graph = answers[taskName]?.provenanceGraph[location];
    if (graph && node) {
      if (!currentGlobalNode || graph.nodes[node].createdOn > currentGlobalNode.time || playTime < currentGlobalNode.time) {
        setCurrentGlobalNode({ name: node || '', time: graph.nodes[node].createdOn });
      }
    }

    setCurrentResponseNodes({ ...currentResponseNodes, [location]: node });
  });

  const _setPlayTime = useThrottledCallback((n: number, percent: number | undefined) => {
    // if were past the end, pause the timer
    const audioEndTime = totalAudioLength * 1000 + startTime;
    if (n > audioEndTime) {
      setAnalysisIsPlaying(false);
      setPlayTime(n);

      return;
    }

    setPlayTime(n);

    if (wavesurfer.current && percent !== undefined && !Number.isNaN(percent)) {
      setTimeout(() => {
        wavesurfer.current?.seekTo(percent);
      });
    }

    if (setTime) {
      setTime(n);
    }
  }, 100); // 100ms throttle

  const setWavesurferTime = useCallback((n: number, percent: number | undefined) => {
    // if were past the end, pause the timer
    const audioEndTime = totalAudioLength * 1000 + startTime;
    if (n > audioEndTime) {
      setAnalysisIsPlaying(false);
      setPlayTime(n);

      return;
    }

    setPlayTime(n);
    onProvenanceTimelineChange && onProvenanceTimelineChange(n - startTime);

    if (wavesurfer.current && percent !== undefined && !Number.isNaN(percent)) {
      setTimeout(() => {
        wavesurfer.current?.seekTo(percent);
      });
    }

    if (setTime) {
      setTime(n);
    }
  }, [setAnalysisIsPlaying, setTime, startTime, totalAudioLength, onProvenanceTimelineChange]);

  useEffect(() => {
    _setPlayTime(startTime + jumpedToAudioTime * 1000 + 1, undefined);
  }, [_setPlayTime, jumpedToAudioTime, startTime, totalAudioLength]);

  useEffect(() => {
    if (taskName) {
      localStorage.setItem('currentTrial', taskName);
      if (answers[taskName]?.trialOrder) {
        localStorage.setItem('trialOrder', answers[taskName].trialOrder);
      }
    }
  }, [answers, taskName]);

  useEffect(() => {
    const listener = (e: StorageEvent) => {
      if (!e.newValue) {
        return;
      }

      if (e.key === 'participantId') {
        setSearchParams((params) => {
          params.set('participantId', e.newValue || '');

          return params;
        });
      }
      if (e.key === 'currentTrial') {
        setSearchParams((params) => {
          params.set('currentTrial', e.newValue || '');

          return params;
        });
      }

      if (e.key === 'currentSpeed') {
        setSpeed(+e.newValue);
      }

      if (e.key === 'analysisIsPlaying') {
        setAnalysisIsPlaying(e.newValue === 'true');
      }

      if (e.key === 'trialOrder') {
        if (context === 'provenanceVis') {
          navigate(taskName ? `./../${encryptIndex(+e.newValue)}?participantId=${participantId}&currentTrial=${taskName}` : `./${e.newValue}?participantId=${participantId}&currentTrial=${taskName}`);
        }
      }
    };

    window.addEventListener('storage', listener);

    return () => window.removeEventListener('storage', listener);
  }, [_setPlayTime, context, navigate, participantId, setAnalysisIsPlaying, setSearchParams, setSpeed, setWavesurferTime, taskName]);

  useUpdateProvenance('aboveStimulus', playTime, answers[taskName]?.provenanceGraph.aboveStimulus, currentResponseNodes.aboveStimulus, _setCurrentResponseNodes, saveProvenance);

  useUpdateProvenance('belowStimulus', playTime, answers[taskName]?.provenanceGraph.belowStimulus, currentResponseNodes.belowStimulus, _setCurrentResponseNodes, saveProvenance);

  useUpdateProvenance('sidebar', playTime, answers[taskName]?.provenanceGraph.sidebar, currentResponseNodes.sidebar, _setCurrentResponseNodes, saveProvenance);

  // Create an instance of trrack to ensure getState works, incase the saved state is not a full state node.
  useEffect(() => {
    if (taskName && answers[taskName]?.provenanceGraph) {
      const reg = Registry.create();

      const trrack = initializeTrrack({ registry: reg, initialState: {} });

      if (answers[taskName]?.provenanceGraph.stimulus) {
        trrack.importObject(structuredClone(answers[taskName]?.provenanceGraph!.stimulus));

        trrackForTrial.current = trrack;
      }
    }
  }, [answers, taskName]);

  const _setCurrentNode = useCallback((node: string | undefined) => {
    if (!node) {
      return;
    }

    if (taskName && trrackForTrial.current && context === 'provenanceVis' && saveProvenance) {
      saveProvenance({ prov: trrackForTrial.current.getState(answers[taskName]?.provenanceGraph.stimulus?.nodes[node]), location: 'stimulus' });

      trrackForTrial.current.to(node);
    }

    _setCurrentResponseNodes(node, 'stimulus');
    setCurrentNode(node);
  }, [taskName, context, _setCurrentResponseNodes, saveProvenance, answers]);

  // use effect to control the current provenance node based on the changing playtime.
  useEffect(() => {
    if (!taskName || !trrackForTrial.current || !answers[taskName]?.provenanceGraph) {
      return;
    }
    const provGraph = answers[taskName]?.provenanceGraph;

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
  }, [_setCurrentNode, currentNode, participantId, playTime, taskName, answers]);

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
      setTimeString(`${youtubeReadableDuration(playTime - startTime)}/${youtubeReadableDuration(totalAudioLength * 1000)}`);
    }
  }, [taskName, playTime, setTimeString, startTime, totalAudioLength]);

  useEffect(() => {
    // eslint-disable-next-line no-unsafe-optional-chaining
    const length = answers[taskName]?.endTime - answers[taskName]?.startTime;
    setTotalAudioLength(length > -1 ? length / 1000 : 0);
  }, [analysisHasAudio, answers, taskName]);

  const isAnalysis = useIsAnalysis();

  const handleWSMount = useEvent(
    async (waveSurfer: WaveSurferType | null) => {
      wavesurfer.current = waveSurfer;

      if (taskName.includes('__dynamicLoading')) {
        return;
      }

      if (waveSurfer && isAnalysis && taskName && storageEngine) {
        try {
          if (!participantId) {
            throw new Error('Participant ID is required to load audio');
          }

          const [audioUrl, screenUrl] = await Promise.all([
            safe(storageEngine.getAudio(taskName, participantId)),
            safe(storageEngine.getScreenRecording(taskName, participantId)),
          ]);

          // Mute wavesurfer if audio is played from the screen recorded video.
          wavesurfer.current?.setMuted(!!screenUrl);

          const url = screenUrl ?? audioUrl ?? null;

          if (!url) {
            setAnalysisHasAudio(false);
            setWaveSurferLoading(false);
            wavesurfer.current?.empty();
          }

          await waveSurfer.load(url!, undefined, totalAudioLength);
          setWaveSurferLoading(false);

          setWaveSurferWidth(waveSurfer.getWidth());
          setAnalysisHasAudio(true);
          waveSurfer.setPlaybackRate(speed);
          waveSurfer.seekTo(0);
          waveSurfer.on('redrawcomplete', () => setWaveSurferWidth(waveSurfer.getWidth()));
        } catch (error: unknown) {
          setAnalysisHasAudio(false);
          setWaveSurferLoading(false);
          throw new Error(error as string);
        }
      } else {
        setAnalysisHasAudio(false);
        setWaveSurferLoading(false);

        setTotalAudioLength(0);
      }
    },
  );

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
    wavesurfer.current?.setPlaybackRate(speed);
  }, [speed]);

  useEffect(() => {
    wavesurfer.current?.setMuted(isMuted);
  }, [isMuted]);

  const xScale = useMemo(() => {
    if (!answers[taskName]?.startTime || !answers[taskName]?.endTime) {
      return null;
    }

    // eslint-disable-next-line no-unsafe-optional-chaining
    const endTime = totalAudioLength > 0 ? answers[taskName]?.startTime + totalAudioLength * 1000 : answers[taskName]?.endTime;

    const scale = d3.scaleLinear([margin.left, width + margin.left + margin.right]).domain([answers[taskName]?.startTime, endTime]).clamp(true);

    return scale;
  }, [answers, taskName, totalAudioLength, width]);

  useEffect(() => {
    setWaveSurferLoading(true);
    handleWSMount(wavesurfer.current);
  }, [_setPlayTime, handleWSMount, participantId, wavesurfer, taskName]);

  return (
    <Group wrap="nowrap" gap={10} mx={10}>
      <Stack ref={ref} style={{ width: '100%' }} gap={0}>
        <LoadingOverlay visible={waveSurferLoading} overlayProps={{ blur: 5, backgroundOpacity: 0.35 }} />

        {participantId !== undefined && taskName
          ? (
            <Box
              ref={waveSurferDiv}
              style={{
                overflow: 'hidden', width: '100%', pointerEvents: 'none',
              }}
              display={analysisHasAudio ? 'block' : 'none'}
              id="waveformDiv"
            >

              <WaveSurfer backend="MediaElement" onMount={handleWSMount} plugins={[]} container="#waveformDiv" height={50} waveColor="#484848" progressColor="cornflowerblue" barHeight={0} cursorColor="rgba(0, 0, 0, 0)">
                <WaveForm id="waveform" height={50} />
              </WaveSurfer>
            </Box>
          ) : null}

        {xScale && taskName && answers[taskName]?.provenanceGraph
          ? (
            <WithinTaskTimeline
              xScale={xScale}
              trialName={taskName}
              currentNode={currentGlobalNode?.name || ''}
              answers={answers}
              width={waveSurferWidth || width}
              height={25}
            />
          ) : null}

        {xScale ? (
          <Timer
            duration={totalAudioLength * 1000}
            initialTime={jumpedToAudioTime ? startTime + jumpedToAudioTime * 1000 + 1 : replayTimestamp ? startTime + replayTimestamp : startTime}
            height={(analysisHasAudio ? 50 : 0) + 25}
            isPlaying={analysisIsPlaying}
            speed={speed}
            startTime={startTime}
            width={width}
            xScale={xScale}
            debounceUpdateTimer={_setPlayTime}
            directUpdateTimer={setWavesurferTime}
          />
        ) : null}
      </Stack>
    </Group>
  );
}
