import {
  MouseEvent,
  useCallback,
  useEffect, useMemo, useRef, useState,
} from 'react';
import { useSearchParams } from 'react-router';
import {
  ActionIcon, Box, Flex, LoadingOverlay,
  Tooltip,
} from '@mantine/core';
import {
  IconArrowsMaximize, IconPlayerPauseFilled, IconPlayerPlayFilled,
} from '@tabler/icons-react';
import { useFullscreen } from '@mantine/hooks';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import {
  useFlatSequence,
  useStoreActions,
  useStoreDispatch,
  useStoreSelector,
} from '../../store/store';
import { useCurrentIdentifier } from '../../routes/utils';
import { useIsAnalysis } from '../../store/hooks/useIsAnalysis';
import classes from './screenRecording.module.css';
import { humanReadableDuration } from '../../utils/humanReadableDuration';

export function ScreenRecordingReplay() {
  const { ref: fullScreenRef, toggle: toggleFullScreen, fullscreen } = useFullscreen();

  const [searchParams] = useSearchParams();
  const participantId = useMemo(
    () => searchParams.get('participantId') || undefined,
    [searchParams],
  );

  const [isReady, setIsReady] = useState(false);

  const stopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);

  const analysisIsPlaying = useStoreSelector((state) => state.analysisIsPlaying);
  const provenanceJumpTime = useStoreSelector((state) => state.provenanceJumpTime);

  const [videoStartTime, setVideoStartTime] = useState(0);
  const [videoEndTime, setVideoEndTime] = useState(0);

  const [hoveredTime, setHoveredTime] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const timelineHoverRef = useRef<HTMLDivElement | null>(null);
  const timelineWrapperRef = useRef<HTMLDivElement | null>(null);

  const [duration, setDuration] = useState<number>(0);
  const [stimulusCurrentTime, setStimulusCurrentTime] = useState<number>(1);
  const [stimulusDuration, setStimulusDuration] = useState<number>(1);

  const { storageEngine } = useStorageEngine();

  const { setAnalysisHasScreenRecording } = useStoreActions();

  const storeDispatch = useStoreDispatch();

  const isAnalysis = useIsAnalysis();

  const identifier = useCurrentIdentifier();

  const flatSequence = useFlatSequence();

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = (videoStartTime + provenanceJumpTime) / 1000;
      if (analysisIsPlaying) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  }, [analysisIsPlaying, provenanceJumpTime, videoStartTime]);

  // get start time end time and stimulus duration
  useEffect(() => {
    async function fetchParticipantId() {
      if (storageEngine) {
        const _participantData = await storageEngine.getParticipantData();

        const firstStimuli = _participantData?.answers[`${flatSequence[0]}_0`];
        const lastStimuliIndex = flatSequence.length - 2;
        const lastStimuli = _participantData?.answers[`${flatSequence[lastStimuliIndex]}_${lastStimuliIndex}`];

        const _startTime = firstStimuli?.startTime || 0;
        const endTime = (lastStimuli?.endTime || 0) - _startTime;

        const currentStimuli = _participantData?.answers[identifier];

        const currentStimuliStartTime = (currentStimuli?.startTime || 0) - _startTime;
        const currentStimuliEndTime = (currentStimuli?.endTime || 0) - _startTime;

        const _videoStartTime = endTime - duration * 1000;

        const stimulusVideoStartTime = currentStimuliStartTime - _videoStartTime;
        const stimulusVideoEndTime = currentStimuliEndTime - _videoStartTime;

        setVideoStartTime(stimulusVideoStartTime);
        setVideoEndTime(stimulusVideoEndTime);

        setStimulusDuration(stimulusVideoEndTime - stimulusVideoStartTime);
      }
    }

    if (duration > 0) {
      fetchParticipantId();
    }
  }, [storageEngine, duration, flatSequence, identifier]);

  // Add events for the video so that it plays between the stimulus start time and end time.
  useEffect(() => {
    const video = videoRef.current;
    if (video && videoStartTime > 0 && videoEndTime > 0) {
      const currentStimulusVideoDuration = (videoEndTime - videoStartTime) / 1000;
      video.currentTime = videoStartTime / 1000;
      video.onpause = () => {
        setIsPlaying(false);

        if (stopTimeoutRef.current) {
          clearTimeout(stopTimeoutRef.current);
        }
        if (timelineRef.current) {
          const w = ((video.currentTime - videoStartTime / 1000) / currentStimulusVideoDuration) * 100;
          timelineRef.current.style.width = `${w > 100 ? 100 : w}%`;
        }
      };

      video.ontimeupdate = () => {
        if (timelineRef.current) {
          const w = ((video.currentTime - videoStartTime / 1000) / currentStimulusVideoDuration) * 100;
          timelineRef.current.style.width = `${w > 100 ? 100 : w}%`;
        }
        if (videoRef.current) {
          setStimulusCurrentTime(videoRef.current.currentTime * 1000 - videoStartTime);
          if (videoRef.current.currentTime > videoEndTime / 1000) {
            videoRef.current.pause();
          }
        }
      };

      video.onplay = () => {
        setIsPlaying(true);
        if (video.currentTime < videoStartTime / 1000 || video.currentTime >= videoEndTime / 1000) {
          video.currentTime = videoStartTime / 1000;
        }
      };

      setTimeout(() => {
        setIsReady(true);
      }, 300);
    }
  }, [videoStartTime, videoEndTime]);

  // Load and show the video
  useEffect(
    () => {
      async function getVideoURL() {
        if (isAnalysis && identifier && storageEngine) {
          try {
            if (!participantId) {
              throw new Error('Participant ID is required to load audio');
            }
            const url = await storageEngine.getScreenRecording('__global', participantId);
            if (!url) {
              storeDispatch(setAnalysisHasScreenRecording(false));
              return;
            }
            storeDispatch(setAnalysisHasScreenRecording(true));
            if (videoRef.current) {
              const video = videoRef.current;
              video.preload = 'metadata';
              video.onloadedmetadata = () => {
                if (video.duration === Infinity) {
                // Force duration to update
                  video.ontimeupdate = () => {
                    video.ontimeupdate = null;
                    if (!Number.isNaN(video.duration)) {
                      setDuration(video.duration);
                    }
                    video.currentTime = 0;
                    video.ontimeupdate = null;
                  };
                  video.currentTime = Number.MAX_SAFE_INTEGER;
                } else {
                  setDuration(video.duration);
                }
              };
              if (url) {
                videoRef.current.src = url;
              }
            }
          } catch (error) {
            storeDispatch(setAnalysisHasScreenRecording(false));
            throw new Error(error as string);
          }
        } else {
          storeDispatch(setAnalysisHasScreenRecording(false));
        }
      }

      getVideoURL();
    },
    [
      isAnalysis,
      identifier,
      storageEngine,
      participantId,
      storeDispatch,
      setAnalysisHasScreenRecording,
      videoRef,
    ],
  );

  const handleTimelineMouseUp = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (videoRef.current) {
      const parentBounding = timelineWrapperRef.current?.getBoundingClientRect();
      const percentage = (e.clientX - (parentBounding?.left || 0)) / (parentBounding?.width || 1);

      // get time from percentage
      videoRef.current.currentTime = (videoStartTime + percentage * (videoEndTime - videoStartTime)) / 1000;
      setStimulusCurrentTime(videoRef.current.currentTime * 1000 - videoStartTime);
    }
  }, [videoStartTime, videoEndTime]);

  const handleTimelineMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (videoRef.current) {
      const parentBounding = timelineWrapperRef.current?.getBoundingClientRect();
      const percentage = (e.clientX - (parentBounding?.left || 0)) / (parentBounding?.width || 1);

      // get time from percentage
      const currentTime = (videoStartTime + percentage * (videoEndTime - videoStartTime)) / 1000;
      const targetTime = (currentTime * 1000 - videoStartTime);

      setHoveredTime(targetTime);

      timelineHoverRef.current!.style.width = `${percentage * 100}%`;
    }
  }, [videoStartTime, videoEndTime]);

  return (
    <Box pos="relative" ref={fullScreenRef} bg="white" px={fullscreen ? 'lg' : 0}>
      <Box pos="relative">
        <video
          ref={videoRef}
          width="100%"
          style={{
            background: 'black',
            maxWidth: 'calc(100vw)',
            maxHeight: 'calc(100vh - 200px)',
            display: 'block',
            margin: '20px auto',
            height: isReady ? 'auto' : 200,
            border: `5px solid ${isPlaying ? '#ccc' : 'black'}`,
          }}
        >
          <source type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <LoadingOverlay visible={!isReady} zIndex={1000} overlayProps={{ blur: 5, bg: 'rgba(255, 255, 255, .98)' }} />
      </Box>
      <Flex ref={timelineWrapperRef} className={classes.timeline} onMouseUp={handleTimelineMouseUp} onMouseMove={handleTimelineMouseMove}>
        <div className={classes.timelineBar}>
          <div ref={timelineRef} className={classes.timelineInner} />
          <Tooltip label={humanReadableDuration(hoveredTime)} position="top-end" w={80} offset={{ mainAxis: 15, crossAxis: 40 }} ta="center" withArrow arrowOffset={37} arrowSize={6}>
            <div ref={timelineHoverRef} className={classes.timelineInnerHover} />
          </Tooltip>
        </div>
      </Flex>

      <Flex h={20} align="center">
        {isPlaying ? (
          <ActionIcon variant="filled" aria-label="Pause" onClick={() => videoRef.current?.pause()} color="green">
            <IconPlayerPauseFilled />
          </ActionIcon>
        ) : (
          <ActionIcon variant="filled" aria-label="Play" onClick={() => videoRef.current?.play()}>
            <IconPlayerPlayFilled />
          </ActionIcon>
        )}
        <Flex flex={1} justify="center">
          {humanReadableDuration(stimulusCurrentTime)}
          {' '}
          /
          {humanReadableDuration(stimulusDuration)}
        </Flex>
        <ActionIcon variant="filled" aria-label="Play" onClick={toggleFullScreen}>
          <IconArrowsMaximize />
        </ActionIcon>
      </Flex>
    </Box>
  );
}
