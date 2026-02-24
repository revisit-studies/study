import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { useStudyConfig } from './useStudyConfig';
import { useCurrentComponent, useCurrentIdentifier } from '../../routes/utils';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { useRecordingConfig } from './useRecordingConfig';
import { useStoredAnswer } from './useStoredAnswer';
import { useIsAnalysis } from './useIsAnalysis';

/**
 * Captures and records the screen and audio.
 * When screen recording is enabled in atleast a stimulus, screen capture should be called before recording is initiated.
 * When just audio recording is enabled throughout the study, recording is initiated on each screen separately.
 */
export function useRecording() {
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
  const [isMuted, setIsMuted] = useState(false);

  // currentMediaStream and recorder can be just screen, just audio, or screen and audio combined.
  const currentMediaStream = useRef<MediaStream>(null);
  const currentMediaRecorder = useRef<MediaRecorder | null>(null);
  const audioMediaStream = useRef<MediaStream | null>(null);
  const audioMediaRecorder = useRef<MediaRecorder | null>(null); // recorder for audio. Necessary to save audio file to get transcription.
  const screenMediaStream = useRef<MediaStream>(null);

  const currentTrialName = useRef<string | null>(null);
  const identifier = useCurrentIdentifier();
  const status = useStoredAnswer();
  const isAnalysis = useIsAnalysis();

  const { storageEngine } = useStorageEngine();

  const currentComponent = useCurrentComponent();

  const [pageTitle] = useState(document.title);

  const {
    studyHasScreenRecording,
    studyHasAudioRecording,
    currentComponentHasAudioRecording,
    currentComponentHasScreenRecording,
    currentComponentHasClickToRecord,
  } = useRecordingConfig();

  useEffect(() => {
    setIsMuted(currentComponentHasClickToRecord);
  }, [currentComponentHasClickToRecord]);

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

    if (audioMediaRecorder.current) {
      audioMediaRecorder.current.stream.getTracks().forEach((track) => { track.stop(); audioMediaRecorder.current?.stream.removeTrack(track); });
      audioMediaRecorder.current.stream.getAudioTracks().forEach((track) => { track.stop(); audioMediaRecorder.current?.stream.removeTrack(track); });
      audioMediaRecorder.current.stop();
      audioMediaRecorder.current = null;
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

    stream.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });

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
        storageEngine?.saveScreenRecording(blob, trialName).catch((error) => {
          console.error('Error saving screen recording:', error);
        });
      });

      audioRecorder?.addEventListener('stop', () => {
        const { mimeType } = audioRecorder;

        const blob = new Blob(audioChunks, { type: mimeType });
        storageEngine?.saveAudioRecording(blob, trialName).catch((error) => {
          console.error('Error saving audio recording:', error);
        });
      });
    } else {
      mediaRecorder.addEventListener('stop', () => {
        const { mimeType } = mediaRecorder;

        const blob = new Blob(chunks, { type: mimeType });
        storageEngine?.saveAudioRecording(blob, trialName).catch((error) => {
          console.error('Error saving audio recording:', error);
        });
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
  }, [currentComponentHasAudioRecording, currentComponentHasScreenRecording, storageEngine, isMuted]);

  // Stop screen recording. This does not stop screen capture.
  const stopScreenRecording = useCallback(() => {
    setIsScreenRecording(false);
    setScreenWithAudioRecording(false);
    currentMediaRecorder.current?.stop();
    audioMediaRecorder.current?.stop();
  }, []);

  const stopAudioRecording = useCallback(() => {
    setIsScreenRecording(false);
    setScreenWithAudioRecording(false);
    setIsAudioRecording(false);

    currentMediaRecorder.current?.stop();
    if (audioMediaRecorder.current) {
      audioMediaRecorder.current.stream.getTracks().forEach((track) => { track.stop(); audioMediaRecorder.current?.stream.removeTrack(track); });
      audioMediaRecorder.current.stream.getAudioTracks().forEach((track) => { track.stop(); audioMediaRecorder.current?.stream.removeTrack(track); });
      audioMediaRecorder.current.stop();
      audioMediaRecorder.current = null;
    }
  }, []);

  useEffect(() => {
    if (currentComponent !== '$screen-recording.components.screenRecordingPermission' && currentComponent !== 'end' && screenCaptureStarted && !isScreenCapturing) {
      setIsRejected(true);
    }
  }, [currentComponent, isScreenCapturing, screenCaptureStarted]);

  const startAudioRecording = useCallback((trialName: string) => {
    navigator.mediaDevices.getUserMedia({
      audio: true,
    }).then((s) => {
      audioMediaStream.current = s;
      currentMediaStream.current = s;

      s.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });

      const recorder = new MediaRecorder(s);
      audioMediaRecorder.current = recorder;

      let chunks : Blob[] = [];

      recorder.addEventListener('start', () => {
        chunks = [];
      });

      recorder.addEventListener('dataavailable', (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      });

      recorder.addEventListener('stop', () => {
        const { mimeType } = recorder;
        const blob = new Blob(chunks, { type: mimeType });
        storageEngine?.saveAudioRecording(blob, trialName).catch((error) => {
          console.error('Error saving audio recording:', error);
        });
      });

      recorder.start();
    });

    setIsAudioRecording(true);
  }, [storageEngine, isMuted]);

  // For study with just audio recording
  useEffect(() => {
    // Always stop recording when navigating to a trial without audio recording
    if (!currentComponentHasAudioRecording && audioMediaRecorder.current) {
      stopAudioRecording();
      currentTrialName.current = null;
      return;
    }

    if (!studyConfig || studyHasScreenRecording || !studyHasAudioRecording || !storageEngine || (status && status.endTime > 0) || isAnalysis) {
      return;
    }

    if (audioMediaRecorder.current) {
      stopAudioRecording();
      currentTrialName.current = null;
    }

    if (currentComponent !== 'end' && currentTrialName.current !== identifier && (currentComponentHasAudioRecording)) {
      currentTrialName.current = identifier;
      startAudioRecording(identifier);
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentComponent, identifier, currentComponentHasAudioRecording]);

  // For study with screen recording
  useEffect(() => {
    if (!studyConfig || !(studyHasScreenRecording) || !storageEngine || (status && status.endTime > 0) || isAnalysis) {
      return;
    }

    if (currentMediaRecorder.current) {
      stopScreenRecording();
      currentTrialName.current = null;
    }

    if (currentComponent !== 'end' && isMediaCapturing && currentTrialName.current !== identifier && (currentComponentHasAudioRecording || currentComponentHasScreenRecording)) {
      currentTrialName.current = identifier;
      startScreenRecording(identifier);
    }

    if (currentComponent === 'end') {
      stopScreenCapture();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentComponent, identifier, currentComponentHasAudioRecording, currentComponentHasScreenRecording, isMediaCapturing]);

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

  useEffect(() => {
    audioMediaStream.current?.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });
  }, [isMuted]);

  return {
    recordVideoRef,
    studyHasScreenRecording,
    isMuted,
    setIsMuted,
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
    clickToRecord: currentComponentHasClickToRecord,
    isRejected,
  };
}

type RecordingContextType = ReturnType<typeof useRecording>;

export const RecordingContext = createContext<RecordingContextType | undefined>(undefined);

export function useRecordingContext() {
  const context = useContext(RecordingContext);
  if (!context) {
    throw new Error('useRecordingContext must be used within a RecordingProvider');
  }
  return context;
}
