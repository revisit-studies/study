import {
  Box, Group, Loader, Stack,
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
import { humanReadableDuration } from '../../utils/humanReadableDuration';
import { ResponseBlockLocation, StoredAnswer } from '../../parser/types';
import { useEvent } from '../../store/hooks/useEvent';
import { encryptIndex } from '../../utils/encryptDecryptIndex';
import { useUpdateProvenance } from './useUpdateProvenance';

const margin = {
  left: 0, top: 0, right: 0, bottom: 0,
};

export function AudioProvenanceVis({
  setTimeString, answers, setTime, taskName, context, saveProvenance, analysisIsPlaying, setAnalysisIsPlaying, speed,
}: { setTimeString: (time: string) => void; answers: Record<string, StoredAnswer>, setTime?: (time: number) => void, taskName: string, context: 'audioAnalysis' | 'provenanceVis', saveProvenance?: ((state: unknown) => void), analysisIsPlaying: boolean, setAnalysisIsPlaying: (b: boolean) => void, speed: number }) {
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

  // wrap these in useMemo to avoid unnecessary re-renders
  const [analysisHasAudio, setAnalysisHasAudio] = useState(true);

  // useEffect(() => { saveAnalysisState({ prov: undefined, location: 'stimulus' }); }, []);

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
      console.log(e);
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

      if (e.key === 'analysisIsPlaying') {
        setAnalysisIsPlaying(e.newValue === 'true');
      }

      if (e.key === 'trialOrder') {
        if (context === 'provenanceVis') {
          navigate(taskName ? `./../${encryptIndex(+e.newValue)}?participantId=${participantId}&currentTrial=${taskName}` : `./${e.newValue}?participantId=${participantId}&currentTrial=${taskName}`);
        }
      }

      if (e.key === 'currentTime') {
        _setPlayTime(+e.newValue.split('_')[0], +e.newValue.split('_')[1]);
      }
    };

    window.addEventListener('storage', listener);

    return () => window.removeEventListener('storage', listener);
  }, [_setPlayTime, context, navigate, participantId, setAnalysisIsPlaying, setSearchParams, taskName]);

  useUpdateProvenance('aboveStimulus', playTime, answers[taskName]?.provenanceGraph.aboveStimulus, currentResponseNodes.aboveStimulus, _setCurrentResponseNodes, saveProvenance);

  useUpdateProvenance('belowStimulus', playTime, answers[taskName]?.provenanceGraph.belowStimulus, currentResponseNodes.belowStimulus, _setCurrentResponseNodes, saveProvenance);

  useUpdateProvenance('sidebar', playTime, answers[taskName]?.provenanceGraph.sidebar, currentResponseNodes.sidebar, _setCurrentResponseNodes, saveProvenance);

  // Make sure we always pause analysis when we change participants or tasks
  // useEffect(() => {
  //   setAnalysisIsPlaying(false);
  // }, [participantId, taskName]);
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
    }
  }, [startTime, replayTimestamp]);

  useEffect(() => {
    if (totalAudioLength === 0) {
      setTimeString('');
    } else if (playTime !== 0) {
      setTimeString(`${humanReadableDuration(playTime - startTime)} / ${humanReadableDuration(totalAudioLength * 1000)}`);
    }
  }, [taskName, playTime, setTimeString, startTime, totalAudioLength]);

  useEffect(() => {
    if (!analysisHasAudio) {
      // eslint-disable-next-line no-unsafe-optional-chaining
      const length = answers[taskName]?.endTime - answers[taskName]?.startTime;
      setTotalAudioLength(length > -1 ? length / 1000 : 0);
    }
  }, [analysisHasAudio, answers, taskName]);

  const isAnalysis = useIsAnalysis();

  const handleWSMount = useCallback(
    async (waveSurfer: WaveSurferType | null) => {
      wavesurfer.current = waveSurfer;

      if (waveSurfer && isAnalysis && taskName && storageEngine) {
        try {
          if (!participantId) {
            throw new Error('Participant ID is required to load audio');
          }
          const url = await storageEngine.getAudio(taskName, participantId);
          await waveSurfer.load(url!);
          setWaveSurferLoading(false);
          // setAnalysisHasAudio(true);

          setTotalAudioLength(waveSurfer.getDuration());
          setWaveSurferWidth(waveSurfer.getWidth());
          setAnalysisHasAudio(true);
          waveSurfer.setPlaybackRate(speed);
          waveSurfer.seekTo(0);
          waveSurfer.on('redrawcomplete', () => setWaveSurferWidth(waveSurfer.getWidth()));
        } catch (error: unknown) {
          // setAnalysisHasAudio(false);
          throw new Error(error as string);
        }
      } else {
        // setAnalysisHasAudio(false);
        setTotalAudioLength(0);
      }
    },
    // adding speed here makes this remount which is bad
    [isAnalysis, taskName, storageEngine, participantId],
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
    if (wavesurfer.current) {
      wavesurfer.current.setPlaybackRate(speed);
    }
  }, [speed]);

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
    handleWSMount(wavesurfer.current);
  }, [_setPlayTime, handleWSMount, participantId, wavesurfer]);

  return (
    <Group wrap="nowrap" gap={10} mx={10}>
      {/* <ActionIcon variant="filled" size={30} onClick={() => setAnalysisIsPlaying(!analysisIsPlaying)}>
        {analysisIsPlaying ? <IconPlayerPauseFilled /> : <IconPlayerPlayFilled />}
      </ActionIcon> */}
      <Stack ref={ref} style={{ width: '100%' }} gap={0}>
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
              <WaveSurfer onMount={handleWSMount} plugins={[]} container="#waveformDiv" height={50} waveColor="#484848" progressColor="#e15759" barHeight={0} cursorColor="rgba(0, 0, 0, 0)">
                <WaveForm id="waveform" height={50} />
              </WaveSurfer>
              {waveSurferLoading ? <Loader /> : null}
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
            height={(analysisHasAudio ? 50 : 0) + 25}
            isPlaying={analysisIsPlaying}
            speed={speed}
            startTime={startTime}
            width={width}
            xScale={xScale}
            updateTimer={_setPlayTime}
            initialTime={replayTimestamp ? startTime + replayTimestamp : undefined}
          />
        ) : null}
      </Stack>
    </Group>
  );
}
