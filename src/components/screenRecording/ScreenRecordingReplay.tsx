import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import type {
  CSSProperties, PointerEvent as ReactPointerEvent, RefObject,
} from 'react';
import { useSearchParams } from 'react-router';
import {
  Box, Flex, Group, SegmentedControl, Text,
} from '@mantine/core';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import {
  useStoreActions,
  useStoreDispatch,
} from '../../store/store';
import { useCurrentIdentifier } from '../../routes/utils';
import { useIsAnalysis } from '../../store/hooks/useIsAnalysis';
import { ReplayLayout, useReplayContext } from '../../store/hooks/useReplay';

type ScreenRecordingReplayProps = {
  webcamOnly?: boolean;
};

type WebcamDrag = {
  pointerId: number;
  offsetX: number;
  offsetY: number;
};

type WebcamOverlayMode = 'webcam-only' | 'picture-in-picture';

type WebcamTopSize = 'small' | 'medium' | 'large';

type WebcamReplayOverlayProps = {
  mode: WebcamOverlayMode;
  videoRef: RefObject<HTMLVideoElement | null>;
  videoStyle: CSSProperties;
  hasWebcamVideo: boolean;
};

const webcamTopWidths: Record<WebcamTopSize, string> = {
  small: '20%',
  medium: '28%',
  large: '36%',
};

function WebcamReplayOverlay({
  mode, videoRef, videoStyle, hasWebcamVideo,
}: WebcamReplayOverlayProps) {
  const webcamOverlayRef = useRef<HTMLDivElement>(null);
  const webcamDragRef = useRef<WebcamDrag | null>(null);
  const [webcamPosition, setWebcamPosition] = useState<{ left: number; top: number } | null>(null);

  const handleWebcamPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const overlay = webcamOverlayRef.current;
    if (!overlay) return;

    const rect = overlay.getBoundingClientRect();
    webcamDragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    setWebcamPosition({ left: rect.left, top: rect.top });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const handleWebcamPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = webcamDragRef.current;
    const overlay = webcamOverlayRef.current;
    if (!drag || !overlay || drag.pointerId !== event.pointerId) return;

    const { width, height } = overlay.getBoundingClientRect();
    const maxLeft = Math.max(0, window.innerWidth - width);
    const maxTop = Math.max(0, window.innerHeight - height);
    const left = Math.min(Math.max(event.clientX - drag.offsetX, 0), maxLeft);
    const top = Math.min(Math.max(event.clientY - drag.offsetY, 0), maxTop);
    setWebcamPosition({ left, top });
  }, []);

  const handleWebcamPointerUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (webcamDragRef.current?.pointerId !== event.pointerId) return;
    webcamDragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }, []);

  return (
    <Box
      ref={webcamOverlayRef}
      role="group"
      aria-label="Webcam recording replay"
      data-replay-layout={`${mode}-overlay`}
      style={{
        position: 'fixed',
        display: hasWebcamVideo ? undefined : 'none',
        width: mode === 'webcam-only'
          ? 'min(320px, calc(100vw - 32px))'
          : 'min(320px, 28vw, calc(100vw - 32px))',
        zIndex: 1000,
        background: 'black',
        padding: '4px',
        ...(webcamPosition || (mode === 'webcam-only' ? { right: 16, bottom: 80 } : { right: 16, top: 140 })),
      }}
    >
      <button
        type="button"
        aria-label="Move webcam replay"
        onPointerDown={handleWebcamPointerDown}
        onPointerMove={handleWebcamPointerMove}
        onPointerUp={handleWebcamPointerUp}
        onPointerCancel={handleWebcamPointerUp}
        style={{
          display: 'block',
          width: '100%',
          padding: '4px 8px',
          border: 0,
          color: 'white',
          background: 'black',
          textAlign: 'left',
          cursor: 'move',
          userSelect: 'none',
        }}
      >
        Webcam Recording · Drag to move
      </button>
      <video
        ref={videoRef}
        width="100%"
        style={{
          ...videoStyle,
          display: hasWebcamVideo ? 'block' : 'none',
          margin: 0,
          maxHeight: '35vh',
          objectFit: 'cover',
        }}
      >
        <source type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </Box>
  );
}

export function ScreenRecordingReplay({ webcamOnly = false }: ScreenRecordingReplayProps) {
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
    replayLayout,
    setReplayLayout,
  } = useReplayContext();

  const [hasScreenVideo, setHasScreenVideo] = useState(false);
  const [hasWebcamVideo, setHasWebcamVideo] = useState(false);
  const [webcamTopSize, setWebcamTopSize] = useState<WebcamTopSize>('small');

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
      let cancelled = false;
      let loadedUrls: string[] = [];

      const releaseUrl = (url: string | null) => {
        if (url?.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      };
      const clearVideoSource = (video: HTMLVideoElement | null) => {
        video?.removeAttribute('src');
      };
      const screenVideo = screenVideoRef.current;
      const webcamVideo = webcamVideoRef.current;
      clearVideoSource(screenVideo);
      clearVideoSource(webcamVideo);
      updateReplayRef();
      setHasScreenVideo(false);
      setHasWebcamVideo(false);
      storeDispatch(setAnalysisHasScreenRecording(false));
      storeDispatch(setAnalysisHasWebcamRecording(false));

      async function getVideoURLs() {
        if (isAnalysis && identifier && storageEngine) {
          try {
            if (!participantId) {
              throw new Error('Participant ID is required to load recordings');
            }

            const safeGetRecording = async (getRecording: () => Promise<string | null>) => {
              try {
                return await getRecording();
              } catch {
                return null;
              }
            };
            const [screenUrl, webcamUrl] = await Promise.all([
              safeGetRecording(() => storageEngine.getScreenRecording(identifier, participantId)),
              safeGetRecording(() => storageEngine.getWebcamRecording(identifier, participantId)),
            ]);

            if (cancelled) {
              releaseUrl(screenUrl);
              releaseUrl(webcamUrl);
              return;
            }
            loadedUrls = [screenUrl, webcamUrl].filter((url): url is string => !!url);

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
              if (screenUrl) screenVideoRef.current.src = screenUrl;
            }

            if (webcamVideoRef.current) {
              webcamVideoRef.current.preload = 'metadata';
              if (webcamUrl) webcamVideoRef.current.src = webcamUrl;
            }

            updateReplayRef();
          } catch {
            if (cancelled) return;
            setHasScreenVideo(false);
            setHasWebcamVideo(false);
            storeDispatch(setAnalysisHasScreenRecording(false));
            storeDispatch(setAnalysisHasWebcamRecording(false));
            storeDispatch(setAnalysisCanPlayScreenRecording(false));
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

      return () => {
        cancelled = true;
        loadedUrls.forEach(releaseUrl);
        loadedUrls = [];
        clearVideoSource(screenVideo);
        clearVideoSource(webcamVideo);
        updateReplayRef();
      };
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
      updateReplayRef,
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

  const hasBothVideos = hasScreenVideo && hasWebcamVideo;
  const layoutDirection = replayLayout === 'side-by-side' && hasBothVideos
    ? { base: 'column' as const, md: 'row' as const }
    : 'column' as const;
  const screenContainerStyle = replayLayout === 'webcam-top' && hasBothVideos
    ? { order: 2 }
    : undefined;
  const webcamContainerStyle = replayLayout === 'webcam-top' && hasBothVideos
    ? { order: 1, width: webcamTopWidths[webcamTopSize], alignSelf: 'center' as const }
    : undefined;
  const isPictureInPictureLayout = replayLayout === 'picture-in-picture';

  if (webcamOnly) {
    return (
      <WebcamReplayOverlay
        mode="webcam-only"
        videoRef={webcamVideoRef}
        videoStyle={videoStyle}
        hasWebcamVideo={hasWebcamVideo}
      />
    );
  }

  return (
    <Box pos="relative">
      {hasBothVideos && (
        <Group justify="center" mb="md">
          <Text size="sm" fw={500}>Replay layout</Text>
          <SegmentedControl
            aria-label="Replay layout"
            value={replayLayout}
            onChange={(value) => setReplayLayout(value as ReplayLayout)}
            data={[
              { label: 'Side by side', value: 'side-by-side' },
              { label: 'Picture in picture', value: 'picture-in-picture' },
              { label: 'Webcam on top', value: 'webcam-top' },
            ]}
          />
          {replayLayout === 'webcam-top' && (
            <SegmentedControl
              aria-label="Webcam size"
              value={webcamTopSize}
              onChange={(value) => setWebcamTopSize(value as WebcamTopSize)}
              data={[
                { label: 'Small', value: 'small' },
                { label: 'Medium', value: 'medium' },
                { label: 'Large', value: 'large' },
              ]}
            />
          )}
        </Group>
      )}
      <Flex
        data-replay-layout={replayLayout}
        gap="md"
        direction={layoutDirection}
        align="stretch"
      >
        <Box flex={hasBothVideos ? 2 : 1} style={screenContainerStyle}>
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

        {!isPictureInPictureLayout && (
          <Box
            flex={1}
            style={webcamContainerStyle}
            data-webcam-size={replayLayout === 'webcam-top' ? webcamTopSize : undefined}
          >
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
        )}
      </Flex>
      {isPictureInPictureLayout && (
        <WebcamReplayOverlay
          mode="picture-in-picture"
          videoRef={webcamVideoRef}
          videoStyle={videoStyle}
          hasWebcamVideo={hasWebcamVideo}
        />
      )}
    </Box>
  );
}
