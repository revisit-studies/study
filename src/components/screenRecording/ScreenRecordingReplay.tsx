import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  Box, Flex, Text,
} from '@mantine/core';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import {
  useStoreActions,
  useStoreDispatch,
} from '../../store/store';
import { useCurrentIdentifier } from '../../routes/utils';
import { useIsAnalysis } from '../../store/hooks/useIsAnalysis';
import { useReplayContext } from '../../store/hooks/useReplay';

export function ScreenRecordingReplay() {
  const [searchParams] = useSearchParams();
  const participantId = useMemo(
    () => searchParams.get('participantId') || undefined,
    [searchParams],
  );

  const {
    screenVideoRef,
    webcamVideoRef,
    updateReplayRef,
    isPlaying,
  } = useReplayContext();

  const [hasScreenVideo, setHasScreenVideo] = useState(false);
  const [hasWebcamVideo, setHasWebcamVideo] = useState(false);

  useEffect(() => {
    updateReplayRef();
  }, [updateReplayRef]);

  const { storageEngine } = useStorageEngine();

  const {
    setAnalysisHasScreenRecording,
    setAnalysisHasWebcamRecording,
    setAnalysisCanPlayScreenRecording,
  } = useStoreActions();

  const storeDispatch = useStoreDispatch();

  const isAnalysis = useIsAnalysis();

  const identifier = useCurrentIdentifier();

  useEffect(
    () => {
      async function getVideoURLs() {
        if (isAnalysis && identifier && storageEngine) {
          try {
            if (!participantId) {
              throw new Error('Participant ID is required to load recordings');
            }

            const [screenUrl, webcamUrl] = await Promise.all([
              storageEngine.getScreenRecording(identifier, participantId),
              storageEngine.getWebcamRecording(identifier, participantId),
            ]);

            const hasScreenRecording = !!screenUrl;
            const hasWebcamRecording = !!webcamUrl;
            const hasVideoRecording = hasScreenRecording || hasWebcamRecording;

            setHasScreenVideo(hasScreenRecording);
            setHasWebcamVideo(hasWebcamRecording);
            storeDispatch(setAnalysisHasScreenRecording(hasScreenRecording));
            storeDispatch(setAnalysisHasWebcamRecording(hasWebcamRecording));
            storeDispatch(setAnalysisCanPlayScreenRecording(hasVideoRecording));

            if (screenVideoRef.current) {
              screenVideoRef.current.preload = 'metadata';
              screenVideoRef.current.src = screenUrl || '';
            }

            if (webcamVideoRef.current) {
              webcamVideoRef.current.preload = 'metadata';
              webcamVideoRef.current.src = webcamUrl || '';
            }

            updateReplayRef();
          } catch (error) {
            setHasScreenVideo(false);
            setHasWebcamVideo(false);
            storeDispatch(setAnalysisHasScreenRecording(false));
            storeDispatch(setAnalysisHasWebcamRecording(false));
            storeDispatch(setAnalysisCanPlayScreenRecording(false));
            throw new Error(error as string);
          }
        } else {
          setHasScreenVideo(false);
          setHasWebcamVideo(false);
          storeDispatch(setAnalysisHasScreenRecording(false));
          storeDispatch(setAnalysisHasWebcamRecording(false));
          storeDispatch(setAnalysisCanPlayScreenRecording(false));
        }
      }

      getVideoURLs();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isAnalysis,
      identifier,
      storageEngine,
      participantId,
      storeDispatch,
      setAnalysisHasScreenRecording,
      setAnalysisHasWebcamRecording,
      setAnalysisCanPlayScreenRecording,
    ],
  );

  const videoStyle = useMemo(() => ({
    background: 'black',
    width: '100%',
    maxWidth: '100%',
    maxHeight: 'calc(100vh - 270px)',
    display: 'block',
    margin: '20px auto',
    height: 'auto',
    border: `5px solid ${isPlaying ? '#ccc' : 'black'}`,
  }), [isPlaying]);

  return (
    <Box pos="relative">
      <Flex
        gap="md"
        direction={{ base: 'column', md: hasScreenVideo && hasWebcamVideo ? 'row' : 'column' }}
        align="stretch"
      >
        <Box flex={hasScreenVideo && hasWebcamVideo ? 2 : 1}>
          <Text fw={600} size="sm" ta="center" mb="xs" display={hasScreenVideo ? 'block' : 'none'}>
            Screen Recording
          </Text>
          <video
            ref={screenVideoRef}
            width="100%"
            style={{
              ...videoStyle,
              display: hasScreenVideo ? 'block' : 'none',
            }}
          >
            <source type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </Box>

        <Box flex={1}>
          <Text fw={600} size="sm" ta="center" mb="xs" display={hasWebcamVideo ? 'block' : 'none'}>
            Webcam Recording
          </Text>
          <video
            ref={webcamVideoRef}
            width="100%"
            style={{
              ...videoStyle,
              display: hasWebcamVideo ? 'block' : 'none',
              objectFit: 'cover',
            }}
          >
            <source type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </Box>
      </Flex>
    </Box>
  );
}
