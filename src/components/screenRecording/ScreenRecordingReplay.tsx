import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { useSearchParams } from 'react-router';
import {
  Box, LoadingOverlay,
} from '@mantine/core';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import {
  useFlatSequence,
  useStoreActions,
  useStoreDispatch,
  useStoreSelector,
} from '../../store/store';
import { useCurrentIdentifier } from '../../routes/utils';
import { useIsAnalysis } from '../../store/hooks/useIsAnalysis';

export function ScreenRecordingReplay() {
  const [searchParams] = useSearchParams();
  const participantId = useMemo(
    () => searchParams.get('participantId') || undefined,
    [searchParams],
  );

  const [isReady, setIsReady] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);

  const analysisIsPlaying = useStoreSelector((state) => state.analysisIsPlaying);
  const provenanceJumpTime = useStoreSelector((state) => state.provenanceJumpTime);

  const [videoStartTime, setVideoStartTime] = useState(0);
  const [videoEndTime, setVideoEndTime] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [duration, setDuration] = useState<number>(0);

  const { storageEngine } = useStorageEngine();

  const { setAnalysisHasScreenRecording, setAnalysisCanPlayScreenRecording } = useStoreActions();

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
      }
    }

    if (duration > 0) {
      fetchParticipantId();
    }
  }, [storageEngine, duration, flatSequence, identifier]);

  // Add events for the video so that it plays between the stimulus start time and end time.
  useEffect(() => {
    const video = videoRef.current;
    if (videoStartTime < 0) {
      storeDispatch(setAnalysisCanPlayScreenRecording(false));
    }
    if (video && videoStartTime > 0 && videoEndTime > 0) {
      video.currentTime = videoStartTime / 1000;
      video.onpause = () => {
        setIsPlaying(false);
      };

      video.ontimeupdate = () => {
        if (videoRef.current) {
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
  }, [videoStartTime, videoEndTime, setAnalysisCanPlayScreenRecording, storeDispatch]);

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

  return (
    <Box pos="relative">
      <video
        ref={videoRef}
        width="100%"
        style={{
          background: 'black',
          maxWidth: '100%',
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
  );
}
