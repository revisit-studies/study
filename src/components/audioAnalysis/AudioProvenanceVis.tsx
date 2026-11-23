import {
  Box, Group, LoadingOverlay, Select, Stack, Text, useComputedColorScheme, useMantineTheme,
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
  Registry, Trrack, initializeTrrack,
} from '@trrack/core';
import WaveSurferType from 'wavesurfer.js';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { TaskProvenanceTimeline } from './TaskProvenanceTimeline';
import { useIsAnalysis } from '../../store/hooks/useIsAnalysis';
import { Timer } from './Timer';
import { youtubeReadableDuration } from '../../utils/humanReadableDuration';
import { StoredAnswer } from '../../parser/types';
import { useEvent } from '../../store/hooks/useEvent';
import { encryptIndex } from '../../utils/encryptDecryptIndex';
import { parseTrialOrder } from '../../utils/parseTrialOrder';
import { useUpdateProvenance } from './useUpdateProvenance';
import { useReplayContext } from '../../store/hooks/useReplay';
import { syncChannel, syncEmitter } from '../../utils/syncReplay';
import type { ProvenanceLocation, StoredProvenance } from '../../store/types';
import { getCombinedProvenance, getLegacyStoredAnswerProvenance } from '../../store/provenance';
import { getReplaySelection } from './provenanceReplay';
import { getRecordingEventLabel } from '../../utils/recordingEvents';
import { getScreenRecordingSegmentUrl } from '../../utils/recordingAssets';

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
    audioRef, updateReplayRef, duration, setDuration, seekTime, setSeekTime,
  } = useReplayContext();

  const { storageEngine } = useStorageEngine();
  const legacyProvenanceGraph = useMemo(
    () => getLegacyStoredAnswerProvenance(answers[taskName]),
    [answers, taskName],
  );
  const [storedProvenanceGraph, setStoredProvenanceGraph] = useState<StoredProvenance | null>(legacyProvenanceGraph);
  const provenanceGraph = storedProvenanceGraph ?? legacyProvenanceGraph;

  const [analysisHasAudio, _setAnalysisHasAudio] = useState(true);

  const setAnalysisHasAudio = useCallback((b: boolean) => {
    _setAnalysisHasAudio(b);
    setHasAudio(b);
  }, [setHasAudio]);

  const [ref, { width }] = useResizeObserver();
  const [waveSurferWidth, setWaveSurferWidth] = useState<number>(0);

  const assetIdentifier = answers[taskName]?.assetIdentifier ?? taskName;
  const recordingSegments = useMemo(() => {
    const segments = answers[taskName]?.recordingSegments ?? [];
    return Array.from(new Set([...segments, assetIdentifier]));
  }, [answers, assetIdentifier, taskName]);
  const [selectedRecordingSegment, setSelectedRecordingSegment] = useState(searchParams.get('recordingSegment') ?? assetIdentifier);
  const [loadedRecordingSegment, setLoadedRecordingSegment] = useState(assetIdentifier);
  const recordingSegmentRange = answers[taskName]?.recordingSegmentRanges
    ?.find((range) => range.assetIdentifier === selectedRecordingSegment);
  const recordingSegmentTime = answers[taskName]?.recordingSegmentTimes?.[selectedRecordingSegment];
  const startTime = recordingSegmentRange?.startTime
    ?? recordingSegmentTime?.startTime
    ?? answers[taskName]?.recordingStartTime
    ?? answers[taskName]?.startTime
    ?? 0;
  const answerEndTime = answers[taskName]?.endTime ?? -1;
  const selectedSegmentEndTime = recordingSegmentRange?.endTime
    ?? recordingSegmentTime?.endTime
    ?? (answerEndTime > startTime ? answerEndTime : answers[taskName]?.recordingEndTime)
    ?? startTime;
  const selectedSegmentDuration = Math.max(0, (selectedSegmentEndTime - startTime) / 1000);

  const [currentNode, setCurrentNode] = useState<string | null>(null);
  const [currentResponseNodes, setCurrentResponseNodes] = useState<Record<ProvenanceLocation, string | undefined>>({
    aboveStimulus: undefined,
    belowStimulus: undefined,
    sidebar: undefined,
    stimulus: undefined,
    globalStore: undefined,
  });
  const [currentGlobalNode, setCurrentGlobalNode] = useState<{name: string, time: number} | null>(null);

  // playtime in epoch ms
  const [playTime, setPlayTime] = useState<number>(0);

  const wavesurfer = useRef<WaveSurferType | null>(null);
  const requestedRecordingSegment = useRef(assetIdentifier);
  useEffect(() => {
    requestedRecordingSegment.current = assetIdentifier;
    setSelectedRecordingSegment(assetIdentifier);
    setLoadedRecordingSegment(assetIdentifier);
  }, [assetIdentifier, taskName]);
  useEffect(() => {
    const requestedSegment = searchParams.get('recordingSegment');
    if (requestedSegment && recordingSegments.includes(requestedSegment)) {
      setSelectedRecordingSegment(requestedSegment);
    } else {
      setSelectedRecordingSegment(assetIdentifier);
    }
  }, [assetIdentifier, recordingSegments, searchParams]);
  const loadedAnalysisUrls = useRef<string[]>([]);
  const loadedAnalysisUrlGeneration = useRef<number | null>(null);
  const analysisLoadGeneration = useRef(0);

  const waveSurferDiv = useRef(null);

  const navigate = useNavigate();

  const [waveSurferLoading, setWaveSurferLoading] = useState<boolean>(true);
  const [recordingLoadError, setRecordingLoadError] = useState<string | null>(null);

  const trrackForTrial = useRef<Trrack<object, string> | null>(null);
  const hasLoadableTask = Boolean(participantId && taskName && answers[taskName]);

  useEffect(() => () => {
    analysisLoadGeneration.current += 1;
    loadedAnalysisUrls.current.forEach((url) => URL.revokeObjectURL(url));
    loadedAnalysisUrls.current = [];
    loadedAnalysisUrlGeneration.current = null;
  }, []);

  useEffect(() => {
    let canceled = false;

    async function fetchProvenance() {
      if (!taskName || !participantId || !storageEngine) {
        setStoredProvenanceGraph(legacyProvenanceGraph);
        return;
      }

      try {
        const storedProvenance = await getCombinedProvenance(storageEngine, taskName, participantId);
        if (!canceled) {
          setStoredProvenanceGraph(storedProvenance ?? legacyProvenanceGraph);
        }
      } catch {
        if (!canceled) {
          setStoredProvenanceGraph(legacyProvenanceGraph);
        }
      }
    }

    fetchProvenance();

    return () => {
      canceled = true;
    };
  }, [legacyProvenanceGraph, participantId, storageEngine, taskName]);

  const _setCurrentResponseNodes = useEvent((node: string | null, location: ProvenanceLocation, createdOn?: number) => {
    const graph = provenanceGraph?.[location];
    if (graph && node) {
      const replayEventTime = createdOn ?? graph.nodes[node].createdOn;
      if (!currentGlobalNode || replayEventTime > currentGlobalNode.time || playTime < currentGlobalNode.time) {
        setCurrentGlobalNode({ name: node || '', time: replayEventTime });
      }
    }

    setCurrentResponseNodes({ ...currentResponseNodes, [location]: node });
  });

  const updatePlayTime = useCallback((n: number) => {
    setPlayTime(startTime + n);
    if (setTime) {
      setTime(startTime + n);
    }
  }, [setTime, startTime]);
  const throttledUpdatePlayTime = useThrottledCallback(updatePlayTime, 100);
  // Replay seeks must reach the provenance state immediately. The throttled
  // path is useful for live audio rendering, but can drop an intermediate
  // seek while the analysis component is still applying the previous one.
  const _setPlayTime = context === 'provenanceVis' ? updatePlayTime : throttledUpdatePlayTime;

  useEffect(() => {
    _setPlayTime(seekTime * 1000);
  }, [seekTime, _setPlayTime]);

  useEffect(() => {
    if (taskName) {
      if (answers[taskName]?.trialOrder) {
        syncChannel.postMessage({
          key: 'trialOrder',
          value: { trialOrder: answers[taskName].trialOrder, answerIdentifier: taskName },
        });
      }
    }
  }, [answers, taskName]);

  useEffect(() => {
    const participantIdListener = (newId: string) => {
      setSearchParams((params) => {
        params.set('participantId', newId || '');
        params.delete('globalStoreNode');
        return params;
      });
    };

    const trialOrderListener = (newValue: string | { trialOrder: string; answerIdentifier?: string }) => {
      const trialOrder = typeof newValue === 'string' ? newValue : newValue.trialOrder;
      const answerIdentifier = typeof newValue === 'string' ? undefined : newValue.answerIdentifier;
      const { step, funcIndex } = parseTrialOrder(trialOrder);
      if (!studyId || step === null) {
        return;
      }

      const params = new URLSearchParams(routerLocation.search);
      params.set('participantId', participantId || '');
      if (answerIdentifier) params.set('analysisAnswerId', answerIdentifier);
      else params.delete('analysisAnswerId');
      const search = params.toString();

      if (context === 'provenanceVis') {
        navigate({
          pathname: funcIndex === null ? `/${studyId}/${encryptIndex(step)}` : `/${studyId}/${encryptIndex(step)}/${encryptIndex(funcIndex)}`,
          search: search ? `?${search}` : '',
        });
        return;
      }

      const matchingIdentifier = answerIdentifier
        ? (answers[answerIdentifier]?.trialOrder === trialOrder ? answerIdentifier : undefined)
        : Object.entries(answers).find(([_identifier, answer]) => answer.trialOrder === trialOrder)?.[0];
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

  useUpdateProvenance('aboveStimulus', playTime, provenanceGraph?.aboveStimulus, currentResponseNodes.aboveStimulus, _setCurrentResponseNodes, saveProvenance);

  useUpdateProvenance('belowStimulus', playTime, provenanceGraph?.belowStimulus, currentResponseNodes.belowStimulus, _setCurrentResponseNodes, saveProvenance);

  useUpdateProvenance('globalStore', playTime, provenanceGraph?.globalStore, currentResponseNodes.globalStore, _setCurrentResponseNodes, saveProvenance);

  useUpdateProvenance('sidebar', playTime, provenanceGraph?.sidebar, currentResponseNodes.sidebar, _setCurrentResponseNodes, saveProvenance);

  // Create an instance of trrack to ensure getState works, incase the saved state is not a full state node.
  useEffect(() => {
    trrackForTrial.current = null;

    if (taskName && provenanceGraph) {
      const reg = Registry.create();

      const trrack = initializeTrrack({ registry: reg, initialState: {} });

      if (provenanceGraph.stimulus) {
        trrack.importObject(structuredClone(provenanceGraph.stimulus));

        trrackForTrial.current = trrack;
      }
    }
  }, [provenanceGraph, taskName]);

  const _setCurrentNode = useCallback((node: string | undefined, createdOn?: number) => {
    if (!node) {
      return;
    }

    if (taskName && trrackForTrial.current && context === 'provenanceVis' && saveProvenance) {
      saveProvenance({ prov: trrackForTrial.current.getState(provenanceGraph?.stimulus?.nodes[node]), location: 'stimulus' });

      trrackForTrial.current.to(node);
    }

    _setCurrentResponseNodes(node, 'stimulus', createdOn);
    setCurrentNode(node);
  }, [taskName, context, _setCurrentResponseNodes, saveProvenance, provenanceGraph]);

  // use effect to control the current provenance node based on the changing playtime.
  useEffect(() => {
    if (!taskName || !trrackForTrial.current || !provenanceGraph) {
      return;
    }
    const provGraph = provenanceGraph;

    if (!provGraph.stimulus) {
      return;
    }

    const replaySelection = getReplaySelection(provGraph.stimulus, playTime, currentNode);

    if (replaySelection.nodeId !== currentNode) {
      _setCurrentNode(
        replaySelection.nodeId,
        replaySelection.fromTraversal ? replaySelection.createdOn : undefined,
      );
    }
  }, [_setCurrentNode, currentNode, participantId, playTime, taskName, provenanceGraph]);

  useEffect(() => {
    if (duration === 0) {
      setTimeString('');
    } else if (playTime !== 0) {
      setTimeString(`${youtubeReadableDuration((playTime - startTime))}/${youtubeReadableDuration(duration * 1000)}`);
    }
  }, [taskName, playTime, setTimeString, startTime, duration]);

  useEffect(() => {
    setDuration(selectedSegmentDuration);
  }, [analysisHasAudio, selectedSegmentDuration, setDuration]);

  const isAnalysis = useIsAnalysis();
  const theme = useMantineTheme();
  const colorScheme = useComputedColorScheme('light');
  const waveColors = useMemo(() => ({
    waveColor: colorScheme === 'dark' ? theme.colors.dark[2] : theme.colors.gray[7],
    progressColor: theme.colors.blue[colorScheme === 'dark' ? 4 : 7],
  }), [colorScheme, theme]);

  useEffect(() => {
    // WaveSurfer only reads its React options on mount; recolor without reloading audio.
    wavesurfer.current?.setOptions(waveColors);
  }, [waveColors]);

  const handleWSMount = useEvent(
    async (waveSurfer: WaveSurferType | null) => {
      requestedRecordingSegment.current = selectedRecordingSegment;
      const loadGeneration = analysisLoadGeneration.current + 1;
      analysisLoadGeneration.current = loadGeneration;
      loadedAnalysisUrls.current.forEach((url) => URL.revokeObjectURL(url));
      loadedAnalysisUrls.current = [];
      loadedAnalysisUrlGeneration.current = null;
      wavesurfer.current = waveSurfer;

      audioRef.current = null;
      updateReplayRef();

      if (waveSurfer && isAnalysis && hasLoadableTask && storageEngine) {
        let ownedUrl: string | null = null;
        try {
          if (!participantId) {
            throw new Error('Participant ID is required to load audio');
          }

          const [audioUrl, screenResult] = await Promise.all([
            safe(Promise.resolve().then(() => storageEngine.getAudio(selectedRecordingSegment, participantId))),
            getScreenRecordingSegmentUrl(
              storageEngine,
              participantId,
              selectedRecordingSegment,
              answers[taskName]?.recordingChunkKeys?.[selectedRecordingSegment] ?? [],
            ).then((url) => ({ url, failed: false })).catch(() => ({ url: null, failed: true })),
          ]);
          const { url: screenUrl, failed: screenLoadFailed } = screenResult;
          const loadedUrls = [audioUrl, screenUrl]
            .filter((url): url is string => !!url && url.startsWith('blob:'));
          if (loadGeneration !== analysisLoadGeneration.current) {
            loadedUrls.forEach((url) => URL.revokeObjectURL(url));
            return;
          }
          const url = screenUrl ?? audioUrl ?? null;
          ownedUrl = url;
          const hasAudioSource = !!(screenUrl ?? audioUrl);
          loadedUrls.filter((loadedUrl) => loadedUrl !== url).forEach((loadedUrl) => URL.revokeObjectURL(loadedUrl));
          loadedAnalysisUrls.current = url?.startsWith('blob:') ? [url] : [];
          loadedAnalysisUrlGeneration.current = loadGeneration;
          setRecordingLoadError(screenLoadFailed ? 'The screen recording segment could not be loaded. Playing available audio instead.' : null);

          if (!url) {
            setAnalysisHasAudio(false);
            setWaveSurferLoading(false);
            wavesurfer.current?.empty();
            if (screenLoadFailed) setRecordingLoadError('This recording segment could not be loaded. It may be incomplete.');
            return;
          }

          await waveSurfer.load(url!, undefined, duration);
          if (loadGeneration !== analysisLoadGeneration.current) {
            loadedUrls.filter((loadedUrl) => loadedUrl === url).forEach((loadedUrl) => URL.revokeObjectURL(loadedUrl));
            if (loadedAnalysisUrlGeneration.current === loadGeneration) {
              loadedAnalysisUrls.current = [];
              loadedAnalysisUrlGeneration.current = null;
            }
            return;
          }
          setWaveSurferLoading(false);
          setLoadedRecordingSegment(selectedRecordingSegment);

          audioRef.current = waveSurfer.getMediaElement();
          updateReplayRef();

          setWaveSurferWidth(waveSurfer.getWidth());
          setAnalysisHasAudio(hasAudioSource);
          waveSurfer.on('redrawcomplete', () => setWaveSurferWidth(waveSurfer.getWidth()));
        } catch {
          if (loadGeneration !== analysisLoadGeneration.current) {
            if (ownedUrl?.startsWith('blob:')) URL.revokeObjectURL(ownedUrl);
            if (loadedAnalysisUrlGeneration.current === loadGeneration) {
              loadedAnalysisUrls.current = [];
              loadedAnalysisUrlGeneration.current = null;
            }
            return;
          }
          if (loadedAnalysisUrlGeneration.current === loadGeneration) {
            loadedAnalysisUrls.current.forEach((url) => URL.revokeObjectURL(url));
            loadedAnalysisUrls.current = [];
            loadedAnalysisUrlGeneration.current = null;
          } else if (ownedUrl?.startsWith('blob:')) {
            URL.revokeObjectURL(ownedUrl);
          }
          setAnalysisHasAudio(false);
          setWaveSurferLoading(false);
          setRecordingLoadError('This recording segment could not be loaded. It may be incomplete.');
          audioRef.current = null;
          updateReplayRef();
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

  useEffect(() => {
    if (!wavesurfer.current || !isAnalysis || !hasLoadableTask || !storageEngine
      || !participantId
      || (selectedRecordingSegment === loadedRecordingSegment
        && selectedRecordingSegment === requestedRecordingSegment.current)) return undefined;
    let canceled = false;
    const waveSurfer = wavesurfer.current;
    const generation = analysisLoadGeneration.current + 1;
    analysisLoadGeneration.current = generation;
    requestedRecordingSegment.current = selectedRecordingSegment;
    loadedAnalysisUrls.current.forEach((url) => URL.revokeObjectURL(url));
    loadedAnalysisUrls.current = [];
    loadedAnalysisUrlGeneration.current = null;
    setWaveSurferLoading(true);
    setRecordingLoadError(null);
    let ownedUrl: string | null = null;
    const load = async () => {
      const [audioUrl, screenResult] = await Promise.all([
        safe(Promise.resolve().then(() => storageEngine.getAudio(selectedRecordingSegment, participantId))),
        getScreenRecordingSegmentUrl(
          storageEngine,
          participantId,
          selectedRecordingSegment,
          answers[taskName]?.recordingChunkKeys?.[selectedRecordingSegment] ?? [],
        ).then((url) => ({ url, failed: false })).catch(() => ({ url: null, failed: true })),
      ]);
      const { url: screenUrl, failed: screenLoadFailed } = screenResult;
      const selectedUrls = Array.from(new Set([audioUrl, screenUrl].filter((candidate): candidate is string => !!candidate && candidate.startsWith('blob:'))));
      const url = screenUrl ?? audioUrl;
      ownedUrl = url;
      if (canceled || generation !== analysisLoadGeneration.current) {
        selectedUrls.forEach((selectedUrl) => URL.revokeObjectURL(selectedUrl));
        return;
      }
      selectedUrls.filter((candidate) => candidate !== url).forEach((unusedUrl) => URL.revokeObjectURL(unusedUrl));
      if (url?.startsWith('blob:')) {
        loadedAnalysisUrls.current = [url];
        loadedAnalysisUrlGeneration.current = generation;
      }
      setRecordingLoadError(screenLoadFailed
        ? 'The screen recording segment could not be loaded. Playing available audio instead.'
        : null);
      if (url) await waveSurfer.load(url, undefined, duration);
      if (canceled || generation !== analysisLoadGeneration.current) {
        if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
        if (loadedAnalysisUrlGeneration.current === generation) {
          loadedAnalysisUrls.current = [];
          loadedAnalysisUrlGeneration.current = null;
        }
        return;
      }
      if (url) {
        audioRef.current = waveSurfer.getMediaElement();
        updateReplayRef();
        setAnalysisHasAudio(true);
      } else {
        setAnalysisHasAudio(false);
        if (screenLoadFailed) setRecordingLoadError('This recording segment could not be loaded. It may be incomplete.');
        audioRef.current = null;
        updateReplayRef();
        waveSurfer.empty();
      }
      setWaveSurferLoading(false);
      setLoadedRecordingSegment(selectedRecordingSegment);
    };
    load().catch(() => {
      if (canceled || generation !== analysisLoadGeneration.current) {
        if (ownedUrl?.startsWith('blob:')) URL.revokeObjectURL(ownedUrl);
        if (loadedAnalysisUrlGeneration.current === generation) {
          loadedAnalysisUrls.current = [];
          loadedAnalysisUrlGeneration.current = null;
        }
        return;
      }
      if (loadedAnalysisUrlGeneration.current === generation) {
        loadedAnalysisUrls.current.forEach((url) => URL.revokeObjectURL(url));
        loadedAnalysisUrls.current = [];
        loadedAnalysisUrlGeneration.current = null;
      } else if (ownedUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(ownedUrl);
      }
      setAnalysisHasAudio(false);
      setWaveSurferLoading(false);
      setRecordingLoadError('This recording segment could not be loaded. It may be incomplete.');
      audioRef.current = null;
      updateReplayRef();
    });
    return () => { canceled = true; };
  }, [answers, assetIdentifier, audioRef, duration, hasLoadableTask, isAnalysis, loadedRecordingSegment, participantId, selectedRecordingSegment, setAnalysisHasAudio, storageEngine, taskName, updateReplayRef]);

  const xScale = useMemo(() => {
    if (!startTime || selectedSegmentDuration <= 0) {
      return null;
    }
    const scale = d3.scaleLinear([margin.left, width - margin.right]).domain([0, selectedSegmentDuration]).clamp(true);

    return scale;
  }, [selectedSegmentDuration, startTime, width]);
  const activityEvents = useMemo(() => {
    const events = answers[taskName]?.windowEvents ?? [];
    const previousDisplayStatus = events.reduce<typeof events[number] | undefined>((latest, event) => (
      event[1] === 'displaystatus' && event[0] < startTime && (!latest || event[0] > latest[0]) ? event : latest
    ), undefined);
    const carriedStatus = previousDisplayStatus
      ? [{ event: [startTime, previousDisplayStatus[1], previousDisplayStatus[2]] as NonNullable<typeof previousDisplayStatus>, label: getRecordingEventLabel(previousDisplayStatus)! }]
      : [];
    return [
      ...carriedStatus,
      ...events.flatMap((event) => {
        const label = getRecordingEventLabel(event);
        return label && event[0] >= startTime && event[0] <= selectedSegmentEndTime ? [{ event, label }] : [];
      }),
    ];
  }, [answers, selectedSegmentEndTime, startTime, taskName]);

  return (
    <Group wrap="nowrap" gap={0} mx={0}>
      <Stack ref={ref} style={{ width: '100%' }} gap={0}>
        {recordingSegments.length > 1 && (
          <Select
            aria-label="Recording segment"
            data={recordingSegments.map((segment, index) => ({ value: segment, label: `Recording segment ${index + 1}` }))}
            value={selectedRecordingSegment}
            onChange={(value) => {
              if (!value) return;
              setSeekTime(0);
              setSelectedRecordingSegment(value);
              setSearchParams((params) => {
                params.set('recordingSegment', value);
                return params;
              }, { replace: true });
            }}
            size="xs"
            w={190}
            mb="xs"
          />
        )}
        <LoadingOverlay visible={waveSurferLoading && hasLoadableTask} overlayProps={{ blur: 5, backgroundOpacity: 0.35 }} />
        {recordingLoadError && <Text c="red" role="alert">{recordingLoadError}</Text>}

        {hasLoadableTask
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
                <WaveSurfer backend="MediaElement" onMount={handleWSMount} plugins={[]} container="#waveformDiv" height={50} {...waveColors} barHeight={0} cursorColor="rgba(0, 0, 0, 0)">
                  <WaveForm id="waveform" height={50} />
                </WaveSurfer>
              </Box>
            </Box>
          ) : null}

        {xScale && taskName && provenanceGraph
          ? (
            <TaskProvenanceTimeline
              xScale={xScale}
              trialName={taskName}
              currentNode={currentGlobalNode?.name || ''}
              provenanceGraph={provenanceGraph}
              width={waveSurferWidth || (width - margin.left - margin.right)}
              height={25}
              margin={margin}
              startTime={startTime}
            />
          ) : null}

        {xScale && activityEvents.length > 0 && (
          <>
            <svg
              aria-hidden="true"
              data-testid="task-activity-playback-timeline"
              width={width}
              style={{ width, height: 16, display: 'block' }}
            >
              {activityEvents.map(({ event, label }, index) => (
                <circle
                  key={`${event[0]}-${index}`}
                  cx={xScale((event[0] - startTime) / 1000)}
                  cy={8}
                  r={4}
                  fill={event[1] === 'studyactivity' ? 'var(--mantine-color-orange-filled)' : 'var(--mantine-color-violet-filled)'}
                  data-testid="task-activity-playback-marker"
                >
                  <title>{`${label} at ${youtubeReadableDuration(Math.max(0, event[0] - startTime))}`}</title>
                </circle>
              ))}
            </svg>
            <div
              role="list"
              aria-label="Task activity events"
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: 'hidden',
                clipPath: 'inset(50%)',
                whiteSpace: 'nowrap',
                border: 0,
              }}
            >
              {activityEvents.map(({ event, label }, index) => (
                <div role="listitem" key={`${event[0]}-${index}`}>
                  {`${youtubeReadableDuration(Math.max(0, event[0] - startTime))}: ${label}`}
                </div>
              ))}
            </div>
          </>
        )}

        {xScale ? (
          <Timer height={(analysisHasAudio ? 49 : 0) + 25} width={width} xScale={xScale} debounceUpdateTimer={_setPlayTime} />
        ) : null}
      </Stack>
    </Group>
  );
}
