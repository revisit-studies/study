/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {

  ActionIcon,
  Box, Center, Group, Loader, Stack,
} from '@mantine/core';
import { useParams } from 'react-router-dom';
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
import { IconPlayerPauseFilled, IconPlayerPlayFilled } from '@tabler/icons-react';
import { PluginDictionary } from 'wavesurfer-react/dist/hooks/useWavesurfer';
import { GenericPlugin } from 'wavesurfer.js/dist/base-plugin';
import { StorageEngine } from '../../storage/engines/StorageEngine';
import { useCurrentComponent } from '../../routes/utils';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { useAsync } from '../../store/hooks/useAsync';
import { useStoreActions, useStoreDispatch } from '../../store/store';
import { deepCopy } from '../../utils/deepCopy';
import { useEvent } from '../../store/hooks/useEvent';
import { SingleTaskTimeline } from './SingleTaskTimeline';

const margin = {
  left: 5, top: 0, right: 5, bottom: 0,
};

function getParticipantData(trrackId: string | undefined, storageEngine: StorageEngine | undefined) {
  if (storageEngine) {
    return storageEngine.getParticipantData(trrackId);
  }

  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function AnalysisPopout({ setPercent } : {setPercent: (n: number) => void}) {
  const { participantId, index } = useParams();

  const _trialFilter = useCurrentComponent();

  const totalAudioLength = useRef<number>(0);
  const trialFilter = useMemo(() => (index ? _trialFilter : null), [_trialFilter, index]);

  const { storageEngine } = useStorageEngine();

  const [ref, { width }] = useResizeObserver();

  const [currentNode, setCurrentNode] = useState<string | null>(null);

  const { value: participant, status } = useAsync(getParticipantData, [participantId, storageEngine]);

  const { saveAnalysisState } = useStoreActions();
  const storeDispatch = useStoreDispatch();

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playTime, setPlayTime] = useThrottledState<number>(0, 200);

  const waveSurferDiv = useRef(null);

  const [waveSurferLoading, setWaveSurferLoading] = useState<boolean>(true);

  const trrackForTrial = useRef<Trrack<object, string> | null>(null);

  const trialFilterAnswersName = useMemo(() => {
    if (!trialFilter || !participant) {
      return null;
    }

    return Object.keys(participant.answers).find((key) => key.startsWith(trialFilter)) || null;
  }, [participant, trialFilter]);

  // Create an instance of trrack to ensure getState works, incase the saved state is not a full state node.
  useEffect(() => {
    if (trialFilterAnswersName && participant) {
      const reg = Registry.create();

      const trrack = initializeTrrack({ registry: reg, initialState: {} });

      if (participant.answers[trialFilterAnswersName].provenanceGraph) {
        trrack.importObject(deepCopy(participant.answers[trialFilterAnswersName].provenanceGraph!));

        trrackForTrial.current = trrack;
      }
    }
  }, [participant, trialFilterAnswersName]);

  const _setCurrentNode = useCallback((node: string | undefined) => {
    if (!node) {
      return;
    }

    if (trialFilterAnswersName && participant && trrackForTrial.current) {
      storeDispatch(saveAnalysisState(trrackForTrial.current.getState(participant.answers[trialFilterAnswersName].provenanceGraph?.nodes[node])));

      trrackForTrial.current.to(node);
    }

    setCurrentNode(node);
  }, [participant, saveAnalysisState, storeDispatch, trialFilterAnswersName]);

  const timeUpdate = useEvent((t: number) => {
    // check if were on the next node. If so, navigate to the next node
    if (participant && trialFilter && trrackForTrial.current && trrackForTrial.current.current.children.length > 0 && (trrackForTrial.current.graph.backend.nodes[trrackForTrial.current.current.children[0]].createdOn - participant.answers.audioTest_2.startTime) / 1000 < t) {
      _setCurrentNode(trrackForTrial.current.current.children[0]);
    }

    if (participant && trialFilter && trialFilterAnswersName) {
      const { startTime } = participant.answers[trialFilterAnswersName];
      setPlayTime(t * 1000 + startTime);

      setPercent((t / totalAudioLength.current) * 100);
    }
  });

  const handleWSMount = useCallback(
    (waveSurfer: WaveSurfer | null) => {
      if (waveSurfer && participant && participantId) {
        const crunker = new Crunker();

        storageEngine?.getAudio([`${trialFilter}_0`], participantId).then((urls) => {
          if (waveSurfer) {
            crunker
              .fetchAudio(...urls)
              .then((buffers) => crunker.concatAudio(buffers))
              .then((merged) => crunker.export(merged, 'audio/mp3'))
              .then((output) => waveSurfer.loadBlob(output.blob).then(() => { setWaveSurferLoading(false); }))
              .catch((error) => {
                throw new Error(error);
              });
          }

          totalAudioLength.current = waveSurfer.getDuration();
          waveSurfer.on('timeupdate', timeUpdate);
        });
      }
    },
    [participant, storageEngine, timeUpdate, trialFilter, participantId],
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
    if (!participant) {
      return null;
    }

    const allStartTimes = Object.values(participant.answers || {}).map((answer) => [answer.startTime, answer.endTime]).flat();

    const extent = d3.extent(allStartTimes) as [number, number];

    const scale = d3.scaleLinear([margin.left, width + margin.left + margin.right]).domain(trialFilterAnswersName ? [participant.answers[trialFilterAnswersName].startTime, participant.answers[trialFilterAnswersName].endTime] : extent).clamp(true);

    return scale;
  }, [participant, trialFilterAnswersName, width]);

  useEffect(() => {
    handleWSMount(wavesurfer);
  }, [handleWSMount, participant, wavesurfer]);

  const fullWaveSurferObj: [WaveSurfer, PluginDictionary<GenericPlugin>, GenericPlugin[]] = useMemo(() => [wavesurfer, {}, []], [wavesurfer]);

  return (
    <Group wrap="nowrap" gap={25}>
      <Stack ref={ref} style={{ width: '100%' }} gap={0}>
        <Group wrap="nowrap">
          <Center>
            <ActionIcon variant="light" size={50} onClick={() => _setIsPlaying(!isPlaying)}>{isPlaying ? <IconPlayerPauseFilled /> : <IconPlayerPlayFilled />}</ActionIcon>
          </Center>
          { xScale && participant !== null && (trialFilterAnswersName ? participant.answers[trialFilterAnswersName] !== undefined : true)
            ? (
              <Box
                ref={waveSurferDiv}
                ml={participant && xScale ? xScale(participant.answers['$test.components.test-md_0'].startTime) : 0}
                mr={participant && xScale ? xScale(participant.answers['$test.components.test-md_1'].startTime) : 0}
                style={{
                  overflow: 'visible', width: `${participant && !trialFilter ? xScale(participant.answers['post-study_19'].startTime) - xScale(participant.answers.audioTest_2.startTime) : (xScale.range()[1] - xScale.range()[0])}px`,
                }}
              >
                <WaveSurferContext.Provider value={fullWaveSurferObj}>
                  <WaveForm id="waveform" />
                </WaveSurferContext.Provider>
                {waveSurferLoading ? <Loader /> : null}
              </Box>
            ) : null }
        </Group>

        {status === 'success' && participant && xScale && trialFilterAnswersName && participant.answers[trialFilterAnswersName].provenanceGraph ? <SingleTaskTimeline xScale={xScale} playTime={playTime - participant.answers['$test.components.test-md_0'].startTime} setPlayTime={_setPlayTime} currentNode={currentNode} setCurrentNode={_setCurrentNode} participantData={participant} width={width} height={50} /> : null}
      </Stack>
    </Group>
  );
}
