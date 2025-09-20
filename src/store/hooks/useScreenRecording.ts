import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { useStudyConfig } from './useStudyConfig';
import { useCurrentComponent } from '../../routes/utils';

/**
 * Capture screen and audio
 * If screen and audio capture in mentioned in the ui config,
 * both are recorded at the same time
 */
export function useScreenRecording() {
  const studyConfig = useStudyConfig();

  const { recordScreen, recordScreenFPS, recordAudio } = studyConfig.uiConfig;

  const recordVideoRef = useRef<HTMLVideoElement>(null);
  const [screenRecordingError, setRecordingError] = useState<string | null>(null);
  const [isScreenRecording, setIsScreenRecording] = useState(false);
  const [screenWithAudioRecording, setScreenWithAudioRecording] = useState(false);
  const [screenCaptureStarted, setScreenCaptureStarted] = useState(false);
  const [isScreenCapturing, setIsScreenCapturing] = useState(false);
  const [isRejected, setIsRejected] = useState(false);

  const screenRecordingStream = useRef<MediaRecorder | null>(null); // combined stream
  const audioRecordingStream = useRef<MediaStream | null>(null); // audio stream

  const chunks = useRef<Blob[]>([]);

  const currentComponent = useCurrentComponent();

  const [pageTitle] = useState(document.title);

  // Screen capture starts once and stops at the end of the study.
  // At the beginning of each stimulus, recording starts by calling `startScreenRecording`.
  // At the end of each stimulus, recording stops by calling `stopScreenRecording`.

  // Stop the screen capture.
  const stopScreenCapture = useCallback(() => {
    if (recordVideoRef.current) {
      recordVideoRef.current.srcObject = null;
    }
    setIsScreenCapturing(false);
    setIsScreenRecording(false);
    setScreenWithAudioRecording(false);

    if (screenRecordingStream.current) {
      screenRecordingStream.current.stream.getTracks().forEach((track) => { track.stop(); screenRecordingStream.current?.stream.removeTrack(track); });
      screenRecordingStream.current.stream.getVideoTracks().forEach((track) => { track.stop(); screenRecordingStream.current?.stream.removeTrack(track); });
      screenRecordingStream.current.stream.getAudioTracks().forEach((track) => { track.stop(); screenRecordingStream.current?.stream.removeTrack(track); });
      screenRecordingStream.current.stop();
      screenRecordingStream.current = null;
      audioRecordingStream.current = null;
    }
  }, []);

  // Start screen recording
  const startScreenRecording = useCallback(() => {
    setIsScreenRecording(true);
    setScreenWithAudioRecording(!!recordAudio);

    chunks.current = [];
    screenRecordingStream.current?.start(1000); // 1s chunks
  }, [recordAudio]);

  // Start screen recording. This does not stop screen capture.
  const stopScreenRecording = useCallback(() => {
    setIsScreenRecording(false);
    setScreenWithAudioRecording(false);
    screenRecordingStream.current?.stop();
  }, []);

  useEffect(() => {
    if (currentComponent !== '$screen-recording.co.screenRecordingPermission' && currentComponent !== 'end' && screenCaptureStarted && !isScreenCapturing) {
      setIsRejected(true);
    }
  }, [currentComponent, isScreenCapturing, screenCaptureStarted]);

  // Start screen capture. This does not begin recording.
  const startScreenCapture = useCallback(() => {
    const captureFn = async () => {
      document.title = `RECORD THIS TAB: ${pageTitle}`;

      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'browser', ...(recordScreenFPS ? { frameRate: { ideal: recordScreenFPS } } : {}) },
          audio: false,
          // @ts-expect-error: experimental (selfBrowserSurface and preferCurrentTab are not yet standardized)
          // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia#selfbrowsersurface
          selfBrowserSurface: 'include',
          preferCurrentTab: true,
        });

        const micStream = recordAudio ? await navigator.mediaDevices.getUserMedia({
          audio: recordAudio,
          video: false,
        }) : null;

        audioRecordingStream.current = micStream;

        const combinedStream = new MediaStream([
          ...screenStream.getVideoTracks(),
          ...(micStream?.getAudioTracks() ?? []),
        ]);

        if (recordVideoRef.current) {
          recordVideoRef.current.srcObject = combinedStream;
          recordVideoRef.current.play();
        }

        combinedStream.getTracks().forEach((track) => {
          track.addEventListener('ended', () => {
            stopScreenCapture();
          });
        });

        const mediaRecorder = new MediaRecorder(combinedStream);
        screenRecordingStream.current = mediaRecorder;

        screenRecordingStream.current.addEventListener('dataavailable', (event: BlobEvent) => {
          if (event.data && event.data.size > 0) {
            chunks.current.push(event.data);
          }
        });

        setIsScreenCapturing(true);
        setScreenCaptureStarted(true);
        setScreenWithAudioRecording(!!recordAudio);
        setRecordingError(null);
      } catch (err) {
        console.error('Error accessing screen:', err);
        setRecordingError('Recording permission denied or not supported.');
      } finally {
        document.title = pageTitle;
      }
    };
    if (recordScreen) {
      captureFn();
    }
  }, [pageTitle, recordAudio, recordScreen, recordScreenFPS, stopScreenCapture]);

  return {
    recordVideoRef,
    recordScreen,
    recordAudio,
    startScreenCapture,
    stopScreenCapture,
    startScreenRecording,
    stopScreenRecording,
    chunks,
    screenRecordingError,
    isScreenRecording,
    isScreenCapturing,
    screenRecordingStream,
    audioRecordingStream,
    screenWithAudioRecording,
    isRejected,
  };
}

type ScreenRecordingContextType = ReturnType<typeof useScreenRecording>;

export const ScreenRecordingContext = createContext<ScreenRecordingContextType | undefined>(undefined);

export function useScreenRecordingContext() {
  const context = useContext(ScreenRecordingContext);
  if (!context) {
    throw new Error('useScreenRecordingContext must be used within a ScreenRecordingProvider');
  }
  return context;
}
