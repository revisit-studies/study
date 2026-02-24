import {
  Box, Group, LoadingOverlay, Stack,
} from '@mantine/core';
import {
  useLocation, useNavigate, useParams, useSearchParams,
} from 'react-router';
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
import { TaskProvenanceTimeline } from './TaskProvenanceTimeline';
import { useIsAnalysis } from '../../store/hooks/useIsAnalysis';
import { Timer } from './Timer';
import { youtubeReadableDuration } from '../../utils/humanReadableDuration';
import { ResponseBlockLocation, StoredAnswer } from '../../parser/types';
import { useEvent } from '../../store/hooks/useEvent';
import { encryptIndex } from '../../utils/encryptDecryptIndex';
import { parseTrialOrder } from '../../utils/parseTrialOrder';
import { useUpdateProvenance } from './useUpdateProvenance';
import { useReplayContext } from '../../store/hooks/useReplay';
import { syncChannel, syncEmitter } from '../../utils/syncReplay';

const margin = {
  left: 20, top: 0, right: 20, bottom: 0,
};

function safe<T>(p: Promise<T>): Promise<T | null> {
  return p.catch(() => null);
}

export function AudioProvenanceVis({
  setTimeString,
  answers,
  setTime,
  taskName,
  context,
  saveProvenance,
  setHasAudio,
}: {
  setTimeString: (time: string) => void;
  answers: Record<string, StoredAnswer>;
  setTime: (time: number) => void;
  taskName: string;
  context: 'audioAnalysis' | 'provenanceVis';
  saveProvenance: ((state: unknown) => void);
  setHasAudio: (b: boolean) => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const routerLocation = useLocation();
  const { studyId } = useParams();
  const participantId = useMemo(() => searchParams.get('participantId') || '', [searchParams]);

  const {
    audioRef, updateReplayRef, duration, setDuration, seekTime,
  } = useReplayContext();

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

  // playtime in epoch ms
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

  const _setPlayTime = useThrottledCallback((n: number) => {
    setPlayTime(startTime + n);
    if (setTime) {
      setTime(startTime + n);
    }
  }, 100); // 100ms throttle

  useEffect(() => {
    _setPlayTime(seekTime * 1000);
  }, [seekTime, _setPlayTime]);

  useEffect(() => {
    if (taskName) {
      if (answers[taskName]?.trialOrder) {
        syncChannel.postMessage({
          key: 'trialOrder',
          value: answers[taskName].trialOrder,
        });
      }
    }
  }, [answers, taskName]);

  useEffect(() => {
    const participantIdListener = (newId: string) => {
      setSearchParams((params) => {
        params.set('participantId', newId || '');
        params.delete('currentTrial');
        return params;
      });
    };

    const trialOrderListener = (newValue: string) => {
      const { step, funcIndex } = parseTrialOrder(newValue);
      if (!studyId || step === null) {
        return;
      }

      const params = new URLSearchParams(routerLocation.search);
      params.set('participantId', participantId || '');
      params.delete('currentTrial');
      const search = params.toString();

      if (context === 'provenanceVis') {
        navigate({
          pathname: funcIndex === null ? `/${studyId}/${encryptIndex(step)}` : `/${studyId}/${encryptIndex(step)}/${encryptIndex(funcIndex)}`,
          search: search ? `?${search}` : '',
        });
        return;
      }

      const matchingIdentifier = Object.entries(answers).find(([_identifier, answer]) => answer.trialOrder === newValue)?.[0];
      if (!matchingIdentifier) {
        return;
      }

      navigate({
        pathname: `/analysis/stats/${studyId}/tagging/${encodeURIComponent(matchingIdentifier)}`,
        search: search ? `?${search}` : '',
      });
    };

    syncEmitter.on('participantId', participantIdListener);
    syncEmitter.on('trialOrder', trialOrderListener);

    return () => {
      syncEmitter.off('participantId', participantIdListener);
      syncEmitter.off('trialOrder', trialOrderListener);
    };
  }, [answers, context, navigate, participantId, routerLocation.search, setSearchParams, studyId]);

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
    if (duration === 0) {
      setTimeString('');
    } else if (playTime !== 0) {
      setTimeString(`${youtubeReadableDuration((playTime - startTime))}/${youtubeReadableDuration(duration * 1000)}`);
    }
  }, [taskName, playTime, setTimeString, startTime, duration]);

  useEffect(() => {
    // eslint-disable-next-line no-unsafe-optional-chaining
    const length = answers[taskName]?.endTime - answers[taskName]?.startTime;
    setDuration(length > -1 ? length / 1000 : 0);
  }, [analysisHasAudio, answers, taskName, setDuration]);

  const isAnalysis = useIsAnalysis();

  const handleWSMount = useEvent(
    async (waveSurfer: WaveSurferType | null) => {
      wavesurfer.current = waveSurfer;

      audioRef.current = null;
      updateReplayRef();

      if (waveSurfer && isAnalysis && taskName && storageEngine) {
        try {
          if (!participantId) {
            throw new Error('Participant ID is required to load audio');
          }

          const [audioUrl, screenUrl] = await Promise.all([
            safe(storageEngine.getAudio(taskName, participantId)),
            safe(storageEngine.getScreenRecording(taskName, participantId)),
          ]);

          const url = screenUrl ?? audioUrl ?? null;

          if (!url) {
            setAnalysisHasAudio(false);
            setWaveSurferLoading(false);
            wavesurfer.current?.empty();
            return;
          }

          await waveSurfer.load(url!, undefined, duration);
          setWaveSurferLoading(false);

          audioRef.current = waveSurfer.getMediaElement();
          updateReplayRef();

          setWaveSurferWidth(waveSurfer.getWidth());
          setAnalysisHasAudio(true);
          waveSurfer.seekTo(0);
          waveSurfer.on('redrawcomplete', () => setWaveSurferWidth(waveSurfer.getWidth()));
        } catch (error: unknown) {
          setAnalysisHasAudio(false);
          setWaveSurferLoading(false);
          audioRef.current = null;
          updateReplayRef();
          throw new Error(error as string);
        }
      } else {
        setAnalysisHasAudio(false);
        setWaveSurferLoading(false);
        audioRef.current = null;
        updateReplayRef();
        setDuration(0);
      }
    },
  );

  const xScale = useMemo(() => {
    if (!answers[taskName]?.startTime || !answers[taskName]?.endTime) {
      return null;
    }
    const scale = d3.scaleLinear([margin.left, width - margin.right]).domain([0, duration]).clamp(true);

    return scale;
  }, [answers, taskName, duration, width]);

  return (
    <Group wrap="nowrap" gap={0} mx={0}>
      <Stack ref={ref} style={{ width: '100%' }} gap={0}>
        <LoadingOverlay visible={waveSurferLoading} overlayProps={{ blur: 5, backgroundOpacity: 0.35 }} />

        {participantId !== undefined && taskName
          ? (
            <Box pos="relative" ml={margin.left} mr={margin.right}>
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
            </Box>
          ) : null}

        {xScale && taskName && answers[taskName]?.provenanceGraph
          ? (
            <TaskProvenanceTimeline
              xScale={xScale}
              trialName={taskName}
              currentNode={currentGlobalNode?.name || ''}
              answers={answers}
              width={waveSurferWidth || (width - margin.left - margin.right)}
              height={25}
              margin={margin}
              startTime={answers[taskName]?.startTime}
            />
          ) : null}

        {xScale ? (
          <Timer height={(analysisHasAudio ? 49 : 0) + 25} width={width} xScale={xScale} debounceUpdateTimer={_setPlayTime} />
        ) : null}
      </Stack>
    </Group>
  );
}
