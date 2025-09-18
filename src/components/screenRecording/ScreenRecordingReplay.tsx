import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { useSearchParams } from 'react-router';
import {
  Box, LoadingOverlay,
} from '@mantine/core';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import {
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

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const { storageEngine } = useStorageEngine();

  const { setAnalysisHasScreenRecording, setAnalysisCanPlayScreenRecording } = useStoreActions();

  const storeDispatch = useStoreDispatch();

  const isAnalysis = useIsAnalysis();

  const identifier = useCurrentIdentifier();

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = (0 + provenanceJumpTime) / 1000;
      if (analysisIsPlaying) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  }, [analysisIsPlaying, provenanceJumpTime]);

  // Add events for the video so that it plays between the stimulus start time and end time.
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      video.onpause = () => {
        setIsPlaying(false);
      };

      video.onplay = () => {
        setIsPlaying(true);
      };

      setTimeout(() => {
        setIsReady(true);
      }, 300);
    }
  }, [setAnalysisCanPlayScreenRecording, storeDispatch]);

  // Load and show the video
  useEffect(
    () => {
      async function getVideoURL() {
        if (isAnalysis && identifier && storageEngine) {
          try {
            if (!participantId) {
              throw new Error('Participant ID is required to load audio');
            }
            const url = await storageEngine.getScreenRecording(identifier, participantId);
            if (!url) {
              storeDispatch(setAnalysisHasScreenRecording(false));
              storeDispatch(setAnalysisCanPlayScreenRecording(false));
              return;
            }
            storeDispatch(setAnalysisHasScreenRecording(true));
            if (videoRef.current) {
              const video = videoRef.current;
              video.preload = 'metadata';
              if (url) {
                videoRef.current.src = url;
              }
            }
          } catch (error) {
            storeDispatch(setAnalysisHasScreenRecording(false));
            storeDispatch(setAnalysisCanPlayScreenRecording(false));
            throw new Error(error as string);
          }
        } else {
          storeDispatch(setAnalysisHasScreenRecording(false));
          storeDispatch(setAnalysisCanPlayScreenRecording(false));
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
      setAnalysisCanPlayScreenRecording,
    ],
  );

  return (
    <Box pos="relative">
      <LoadingOverlay visible={!isReady} zIndex={1000} overlayProps={{ blur: 5, bg: 'rgba(255, 255, 255, .98)' }} />
      <video
        ref={videoRef}
        width="100%"
        style={{
          background: 'black',
          maxWidth: '100%',
          maxHeight: 'calc(100vh - 270px)',
          display: 'block',
          margin: '20px auto',
          height: isReady ? 'auto' : 200,
          border: `5px solid ${isPlaying ? '#ccc' : 'black'}`,
        }}
      >
        <source type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </Box>
  );
}
