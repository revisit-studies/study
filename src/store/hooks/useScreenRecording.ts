import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { useStudyConfig } from './useStudyConfig';
import { useCurrentComponent } from '../../routes/utils';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { useRecordingConfig } from './useRecordingConfig';

/**
 * Captures and records the screen and audio.
 * This hook is only used when at least one of the stimuli requires screen recording.
 */
export function useScreenRecording() {
  const studyConfig = useStudyConfig();

  const { recordScreenFPS, recordAudio } = studyConfig.uiConfig;

  const recordVideoRef = useRef<HTMLVideoElement>(null);
  const [screenRecordingError, setRecordingError] = useState<string | null>(null);
  const [isScreenRecording, setIsScreenRecording] = useState(false);
  const [isAudioRecording, setIsAudioRecording] = useState(false);
  const [screenWithAudioRecording, setScreenWithAudioRecording] = useState(false);
  const [screenCaptureStarted, setScreenCaptureStarted] = useState(false);
  const [isScreenCapturing, setIsScreenCapturing] = useState(false);
  const [isAudioCapturing, setIsAudioCapturing] = useState(false);
  const [isMediaCapturing, setIsMediaCapturing] = useState(false);
  const [isRejected, setIsRejected] = useState(false);

  // currentMediaStream and recorder can be just screen, just audio, or screen and audio combined.
  const currentMediaStream = useRef<MediaStream>(null);
  const currentMediaRecorder = useRef<MediaRecorder | null>(null);
  const audioMediaStream = useRef<MediaStream | null>(null);
  const audioMediaRecorder = useRef<MediaRecorder | null>(null); // recorder for audio. Necessary to save audio file to get transcription.
  const screenMediaStream = useRef<MediaStream>(null);

  const { storageEngine } = useStorageEngine();

  const currentComponent = useCurrentComponent();

  const [pageTitle] = useState(document.title);

  const {
    studyHasScreenRecording,
    studyHasAudioRecording,
    currentComponentHasAudioRecording,
    currentComponentHasScreenRecording,
  } = useRecordingConfig();

  // Screen capture starts once and stops at the end of the study.
  // At the beginning of each stimulus, recording starts by calling `startScreenRecording`.
  // At the end of each stimulus, recording stops by calling `stopScreenRecording`.

  // Stop the screen capture.
  const stopScreenCapture = useCallback(() => {
    if (recordVideoRef.current) {
      recordVideoRef.current.srcObject = null;
    }
    setIsScreenCapturing(false);
    setIsAudioCapturing(false);
    setIsMediaCapturing(false);
    setIsScreenRecording(false);
    setIsAudioRecording(false);
    setScreenWithAudioRecording(false);

    if (audioMediaStream.current) {
      audioMediaStream.current.getTracks().forEach((track) => {
        track.stop();
        audioMediaStream.current?.removeTrack(track);
      });
      audioMediaStream.current = null;
    }

    if (screenMediaStream.current) {
      screenMediaStream.current.getTracks().forEach((track) => {
        track.stop();
        screenMediaStream.current?.removeTrack(track);
      });
      screenMediaStream.current = null;
    }

    if (currentMediaRecorder.current) {
      currentMediaRecorder.current.stream.getTracks().forEach((track) => { track.stop(); currentMediaRecorder.current?.stream.removeTrack(track); });
      currentMediaRecorder.current.stream.getVideoTracks().forEach((track) => { track.stop(); currentMediaRecorder.current?.stream.removeTrack(track); });
      currentMediaRecorder.current.stream.getAudioTracks().forEach((track) => { track.stop(); currentMediaRecorder.current?.stream.removeTrack(track); });
      currentMediaRecorder.current.stop();
      currentMediaRecorder.current = null;
    }
  }, []);

  // Start screen recording
  const startScreenRecording = useCallback((trialName: string) => {
    // check if the current stimulus needs combined or just screen

    if (!(currentComponentHasAudioRecording || currentComponentHasScreenRecording)) {
      return;
    }

    if (!screenMediaStream.current) {
      return;
    }

    currentMediaStream.current = new MediaStream([
      ...((currentComponentHasScreenRecording ? screenMediaStream.current?.getVideoTracks() : []) ?? []),
      ...((currentComponentHasAudioRecording ? audioMediaStream.current?.getAudioTracks() : []) ?? []),
    ]);

    const stream = currentMediaStream.current;

    const mediaRecorder = new MediaRecorder(stream);

    currentMediaRecorder.current = mediaRecorder;

    const audioRecorder = (currentComponentHasAudioRecording && audioMediaStream.current) ? new MediaRecorder(audioMediaStream.current) : null;
    audioMediaRecorder.current = audioRecorder;

    let chunks : Blob[] = [];
    mediaRecorder.addEventListener('dataavailable', (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    });

    let audioChunks: Blob[] = [];
    audioRecorder?.addEventListener('dataavailable', (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
      }
    });

    mediaRecorder.addEventListener('start', () => {
      chunks = [];
    });

    audioRecorder?.addEventListener('start', () => {
      audioChunks = [];
    });

    if (currentComponentHasScreenRecording) {
      mediaRecorder.addEventListener('stop', () => {
        const { mimeType } = mediaRecorder;

        const blob = new Blob(chunks, { type: mimeType });
        storageEngine?.saveScreenRecording(blob, trialName);
      });

      audioRecorder?.addEventListener('stop', () => {
        const { mimeType } = audioRecorder;

        const blob = new Blob(audioChunks, { type: mimeType });
        storageEngine?.saveAudioRecording(blob, trialName);
      });
    } else {
      mediaRecorder.addEventListener('stop', () => {
        const { mimeType } = mediaRecorder;

        const blob = new Blob(chunks, { type: mimeType });
        storageEngine?.saveAudioRecording(blob, trialName);
      });
    }

    setIsScreenCapturing(true);
    setScreenCaptureStarted(true);
    setScreenWithAudioRecording(currentComponentHasAudioRecording);
    setRecordingError(null);

    setIsAudioRecording(currentComponentHasAudioRecording);
    setIsScreenRecording(currentComponentHasScreenRecording);

    mediaRecorder.start(1000); // 1s chunks
    audioRecorder?.start(1000);
  }, [currentComponentHasAudioRecording, currentComponentHasScreenRecording, storageEngine]);

  // Start screen recording. This does not stop screen capture.
  const stopScreenRecording = useCallback(() => {
    setIsScreenRecording(false);
    setScreenWithAudioRecording(false);
    currentMediaRecorder.current?.stop();
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
        const screenStream = studyHasScreenRecording ? await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'browser', ...(recordScreenFPS ? { frameRate: { ideal: recordScreenFPS } } : {}) },
          audio: false,
          // @ts-expect-error: experimental (selfBrowserSurface and preferCurrentTab are not yet standardized)
          // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia#selfbrowsersurface
          selfBrowserSurface: 'include',
          preferCurrentTab: true,
        }) : null;

        screenMediaStream.current = screenStream;

        const micStream = studyHasAudioRecording ? await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        }) : null;

        audioMediaStream.current = micStream;

        const combinedStream = new MediaStream([
          ...screenStream?.getVideoTracks() || [],
          ...(micStream?.getAudioTracks() ?? []),
        ]);

        currentMediaStream.current = combinedStream;

        if (recordVideoRef.current) {
          recordVideoRef.current.srcObject = combinedStream;
          recordVideoRef.current.play();
        }

        combinedStream.getTracks().forEach((track) => {
          track.addEventListener('ended', () => {
            stopScreenCapture();
          });
        });

        setIsScreenCapturing(screenStream !== null);
        setIsAudioCapturing(micStream !== null);
        setIsMediaCapturing(screenStream !== null || micStream !== null);
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
    captureFn();
  }, [pageTitle, recordAudio, recordScreenFPS, stopScreenCapture, studyHasAudioRecording, studyHasScreenRecording]);

  return {
    recordVideoRef,
    studyHasScreenRecording,
    recordAudio,
    startScreenCapture,
    stopScreenCapture,
    startScreenRecording,
    stopScreenRecording,
    screenRecordingError,
    isScreenRecording,
    isAudioRecording,
    isScreenCapturing,
    isAudioCapturing,
    isMediaCapturing,
    combinedMediaRecorder: currentMediaRecorder,
    audioMediaStream,
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
