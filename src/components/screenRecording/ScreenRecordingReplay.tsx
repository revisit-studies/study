import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { Box } from '@mantine/core';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import {
  useStoreActions,
  useStoreDispatch,
  useStoreSelector,
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

  const { videoRef, updateReplayRef, isPlaying } = useReplayContext();

  useEffect(() => {
    updateReplayRef();
  }, [updateReplayRef]);

  const analysisCanPlayScreenRecording = useStoreSelector((state) => state.analysisCanPlayScreenRecording);

  const { storageEngine } = useStorageEngine();

  const { setAnalysisHasScreenRecording, setAnalysisCanPlayScreenRecording } = useStoreActions();

  const storeDispatch = useStoreDispatch();

  const isAnalysis = useIsAnalysis();

  const identifier = useCurrentIdentifier();

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
                updateReplayRef();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      {analysisCanPlayScreenRecording && (
      <video
        ref={videoRef}
        width="100%"
        style={{
          background: 'black',
          maxWidth: '100%',
          maxHeight: 'calc(100vh - 270px)',
          display: 'block',
          margin: '20px auto',
          height: 'auto',
          border: `5px solid ${isPlaying ? '#ccc' : 'black'}`,
        }}
      >
        <source type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      )}
    </Box>
  );
}
