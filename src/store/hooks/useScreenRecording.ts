import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { useStudyConfig } from './useStudyConfig';
import { useCurrentComponent } from '../../routes/utils';
import { useStorageEngine } from '../../storage/storageEngineHooks';

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

  const combinedMediaStream = useRef<MediaStream>(null);
  const combinedMediaRecorder = useRef<MediaRecorder | null>(null); // combined stream recorder
  const audioRecordingStream = useRef<MediaStream | null>(null); // audio stream

  const { storageEngine } = useStorageEngine();

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

    if (combinedMediaRecorder.current) {
      combinedMediaRecorder.current.stream.getTracks().forEach((track) => { track.stop(); combinedMediaRecorder.current?.stream.removeTrack(track); });
      combinedMediaRecorder.current.stream.getVideoTracks().forEach((track) => { track.stop(); combinedMediaRecorder.current?.stream.removeTrack(track); });
      combinedMediaRecorder.current.stream.getAudioTracks().forEach((track) => { track.stop(); combinedMediaRecorder.current?.stream.removeTrack(track); });
      combinedMediaRecorder.current.stop();
      combinedMediaRecorder.current = null;
      audioRecordingStream.current = null;
    }
  }, []);

  // Start screen recording
  const startScreenRecording = useCallback((trialName: string) => {
    if (!combinedMediaStream.current) {
      return;
    }
    const stream = combinedMediaStream.current;

    const mediaRecorder = new MediaRecorder(stream);
    combinedMediaRecorder.current = mediaRecorder;

    let chunks : Blob[] = [];
    mediaRecorder.addEventListener('dataavailable', (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    });

    mediaRecorder.addEventListener('start', () => {
      chunks = [];
    });

    mediaRecorder.addEventListener('stop', () => {
      const { mimeType } = mediaRecorder;

      const blob = new Blob(chunks, { type: mimeType });
      storageEngine?.saveScreenRecording(blob, trialName);
    });

    setIsScreenCapturing(true);
    setScreenCaptureStarted(true);
    setScreenWithAudioRecording(!!recordAudio);
    setRecordingError(null);

    setIsScreenRecording(true);
    mediaRecorder.start(1000); // 1s chunks
  }, [recordAudio, storageEngine]);

  // Start screen recording. This does not stop screen capture.
  const stopScreenRecording = useCallback(() => {
    setIsScreenRecording(false);
    setScreenWithAudioRecording(false);
    combinedMediaRecorder.current?.stop();
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

        combinedMediaStream.current = combinedStream;

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
        combinedMediaRecorder.current = mediaRecorder;

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
    screenRecordingError,
    isScreenRecording,
    isScreenCapturing,
    combinedMediaRecorder,
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
