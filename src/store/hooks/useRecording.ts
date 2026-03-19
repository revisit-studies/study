import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { useStudyConfig } from './useStudyConfig';
import { useCurrentComponent, useCurrentIdentifier } from '../../routes/utils';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { useRecordingConfig } from './useRecordingConfig';
import { useStoredAnswer } from './useStoredAnswer';
import { useIsAnalysis } from './useIsAnalysis';

const SCREEN_PERMISSION_COMPONENT = '$screen-recording.components.screenRecordingPermission';
const WEBCAM_PERMISSION_COMPONENT = '$webcam-recording.components.webcamRecordingPermission';

function stopMediaTracks(stream: MediaStream | null) {
  if (!stream) {
    return;
  }

  stream.getTracks().forEach((track) => {
    track.stop();
    stream.removeTrack(track);
  });
}

function stopRecorder(recorder: MediaRecorder | null) {
  if (recorder && recorder.state !== 'inactive') {
    recorder.stop();
  }
}

/**
 * Captures and records the screen, webcam, and audio.
 * When screen or webcam recording is enabled in at least one stimulus, the corresponding capture
 * should be started once from a permission component before recording begins.
 * When the study uses only audio recording, recording is initiated on each screen separately.
 */
export function useRecording() {
  const studyConfig = useStudyConfig();

  const { recordScreenFPS } = studyConfig.uiConfig;

  const recordVideoRef = useRef<HTMLVideoElement>(null);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const [screenRecordingError, setRecordingError] = useState<string | null>(null);
  const [isScreenRecording, setIsScreenRecording] = useState(false);
  const [isAudioRecording, setIsAudioRecording] = useState(false);
  const [isWebcamRecording, setIsWebcamRecording] = useState(false);
  const [screenWithAudioRecording, setScreenWithAudioRecording] = useState(false);
  const [isScreenCapturing, setIsScreenCapturing] = useState(false);
  const [isAudioCapturing, setIsAudioCapturing] = useState(false);
  const [isWebcamCapturing, setIsWebcamCapturing] = useState(false);
  const [isMediaCapturing, setIsMediaCapturing] = useState(false);
  const [mediaCaptureStarted, setMediaCaptureStarted] = useState(false);
  const [isRejected, setIsRejected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const currentMediaRecorder = useRef<MediaRecorder | null>(null);
  const screenMediaRecorder = useRef<MediaRecorder | null>(null);
  const webcamMediaRecorder = useRef<MediaRecorder | null>(null);
  const audioMediaRecorder = useRef<MediaRecorder | null>(null);
  const audioMediaStream = useRef<MediaStream | null>(null);
  const screenMediaStream = useRef<MediaStream | null>(null);
  const webcamMediaStream = useRef<MediaStream | null>(null);

  const isStoppingCapture = useRef(false);
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
    studyHasWebcamRecording,
    currentComponentHasAudioRecording,
    currentComponentHasScreenRecording,
    currentComponentHasWebcamRecording,
    currentComponentHasClickToRecord,
  } = useRecordingConfig();

  useEffect(() => {
    setIsMuted(currentComponentHasClickToRecord);
  }, [currentComponentHasClickToRecord]);

  const syncCaptureFlags = useCallback(() => {
    const screenCapturing = !!screenMediaStream.current?.getVideoTracks().length;
    const audioCapturing = !!audioMediaStream.current?.getAudioTracks().length;
    const webcamCapturing = !!webcamMediaStream.current?.getVideoTracks().length;

    setIsScreenCapturing(screenCapturing);
    setIsAudioCapturing(audioCapturing);
    setIsWebcamCapturing(webcamCapturing);
    setIsMediaCapturing(screenCapturing || audioCapturing || webcamCapturing);
  }, []);

  const stopTrialRecording = useCallback(() => {
    setIsScreenRecording(false);
    setIsAudioRecording(false);
    setIsWebcamRecording(false);
    setScreenWithAudioRecording(false);

    stopRecorder(screenMediaRecorder.current);
    stopRecorder(webcamMediaRecorder.current);
    stopRecorder(audioMediaRecorder.current);

    currentMediaRecorder.current = null;
    screenMediaRecorder.current = null;
    webcamMediaRecorder.current = null;
    audioMediaRecorder.current = null;
  }, []);

  const stopScreenCapture = useCallback(() => {
    if (isStoppingCapture.current) {
      return;
    }

    isStoppingCapture.current = true;

    if (recordVideoRef.current) {
      recordVideoRef.current.srcObject = null;
    }
    if (webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = null;
    }

    stopTrialRecording();
    stopMediaTracks(audioMediaStream.current);
    stopMediaTracks(screenMediaStream.current);
    stopMediaTracks(webcamMediaStream.current);

    audioMediaStream.current = null;
    screenMediaStream.current = null;
    webcamMediaStream.current = null;

    syncCaptureFlags();

    window.setTimeout(() => {
      isStoppingCapture.current = false;
    }, 0);
  }, [stopTrialRecording, syncCaptureFlags]);

  const attachSaveHandler = useCallback((
    recorder: MediaRecorder,
    saveBlob: ((blob: Blob, trialName: string) => Promise<void>) | undefined,
    trialName: string,
    errorLabel: string,
  ) => {
    let chunks: Blob[] = [];

    recorder.addEventListener('start', () => {
      chunks = [];
    });

    recorder.addEventListener('dataavailable', (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    });

    recorder.addEventListener('stop', () => {
      if (!saveBlob) {
        return;
      }
      const { mimeType } = recorder;
      const blob = new Blob(chunks, { type: mimeType });
      saveBlob(blob, trialName).catch((error) => {
        console.error(`Error saving ${errorLabel}:`, error);
      });
    });
  }, []);

  const startScreenRecording = useCallback((trialName: string) => {
    const wantsScreen = currentComponentHasScreenRecording;
    const wantsAudio = currentComponentHasAudioRecording;
    const wantsWebcam = currentComponentHasWebcamRecording;

    if (!(wantsScreen || wantsAudio || wantsWebcam)) {
      return;
    }

    if (wantsScreen && !screenMediaStream.current) {
      return;
    }

    if (wantsWebcam && !webcamMediaStream.current) {
      return;
    }

    if (wantsAudio && !audioMediaStream.current) {
      return;
    }

    if (wantsScreen && screenMediaStream.current) {
      const screenStream = new MediaStream([
        ...screenMediaStream.current.getVideoTracks(),
        ...(wantsAudio ? audioMediaStream.current?.getAudioTracks() ?? [] : []),
      ]);
      const mediaRecorder = new MediaRecorder(screenStream);
      screenMediaRecorder.current = mediaRecorder;
      currentMediaRecorder.current = mediaRecorder;
      attachSaveHandler(mediaRecorder, storageEngine ? storageEngine.saveScreenRecording.bind(storageEngine) : undefined, trialName, 'screen recording');
      mediaRecorder.start(1000);
    }

    if (wantsWebcam && webcamMediaStream.current) {
      const webcamStream = new MediaStream([
        ...webcamMediaStream.current.getVideoTracks(),
      ]);
      const mediaRecorder = new MediaRecorder(webcamStream);
      webcamMediaRecorder.current = mediaRecorder;
      attachSaveHandler(mediaRecorder, storageEngine ? storageEngine.saveWebcamRecording.bind(storageEngine) : undefined, trialName, 'webcam recording');
      mediaRecorder.start(1000);
    }

    if (wantsAudio && audioMediaStream.current) {
      const audioStream = new MediaStream([
        ...audioMediaStream.current.getAudioTracks(),
      ]);
      const audioRecorder = new MediaRecorder(audioStream);
      audioMediaRecorder.current = audioRecorder;
      attachSaveHandler(audioRecorder, storageEngine ? storageEngine.saveAudioRecording.bind(storageEngine) : undefined, trialName, 'audio recording');
      audioRecorder.start(1000);
    }

    setMediaCaptureStarted(true);
    setRecordingError(null);
    setIsAudioRecording(wantsAudio);
    setIsScreenRecording(wantsScreen);
    setIsWebcamRecording(wantsWebcam);
    setScreenWithAudioRecording(wantsScreen && wantsAudio);
  }, [
    attachSaveHandler,
    currentComponentHasAudioRecording,
    currentComponentHasScreenRecording,
    currentComponentHasWebcamRecording,
    storageEngine,
  ]);

  const stopScreenRecording = useCallback(() => {
    stopTrialRecording();
  }, [stopTrialRecording]);

  const stopAudioRecording = useCallback(() => {
    stopTrialRecording();

    if (!(studyHasScreenRecording || studyHasWebcamRecording)) {
      stopMediaTracks(audioMediaStream.current);
      audioMediaStream.current = null;
      syncCaptureFlags();
    }
  }, [stopTrialRecording, studyHasScreenRecording, studyHasWebcamRecording, syncCaptureFlags]);

  useEffect(() => {
    const permissionComponents = [SCREEN_PERMISSION_COMPONENT, WEBCAM_PERMISSION_COMPONENT];
    const missingRequiredCapture = (
      (studyHasScreenRecording && !isScreenCapturing)
      || (studyHasWebcamRecording && !isWebcamCapturing)
      || (((studyHasScreenRecording || studyHasWebcamRecording) && studyHasAudioRecording) && !isAudioCapturing)
    );

    if (!permissionComponents.includes(currentComponent) && currentComponent !== 'end' && mediaCaptureStarted && missingRequiredCapture) {
      setIsRejected(true);
    }
  }, [
    currentComponent,
    isAudioCapturing,
    isScreenCapturing,
    isWebcamCapturing,
    mediaCaptureStarted,
    studyHasAudioRecording,
    studyHasScreenRecording,
    studyHasWebcamRecording,
  ]);

  const startAudioRecording = useCallback((trialName: string) => {
    navigator.mediaDevices.getUserMedia({
      audio: true,
    }).then((stream) => {
      audioMediaStream.current = stream;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });

      const recorder = new MediaRecorder(stream);
      audioMediaRecorder.current = recorder;

      attachSaveHandler(recorder, storageEngine ? storageEngine.saveAudioRecording.bind(storageEngine) : undefined, trialName, 'audio recording');

      recorder.start(1000);
      syncCaptureFlags();
    }).catch((error) => {
      console.error('Error accessing audio:', error);
      setRecordingError('Recording permission denied or not supported.');
    });

    setIsAudioRecording(true);
  }, [attachSaveHandler, isMuted, storageEngine, syncCaptureFlags]);

  // For study with just audio recording
  useEffect(() => {
    if (!currentComponentHasAudioRecording && audioMediaRecorder.current) {
      stopAudioRecording();
      currentTrialName.current = null;
      return;
    }

    if (
      !studyConfig
      || studyHasScreenRecording
      || studyHasWebcamRecording
      || !studyHasAudioRecording
      || !storageEngine
      || (status && status.endTime > 0)
      || isAnalysis
    ) {
      return;
    }

    if (audioMediaRecorder.current) {
      stopAudioRecording();
      currentTrialName.current = null;
    }

    if (currentComponent !== 'end' && currentTrialName.current !== identifier && currentComponentHasAudioRecording) {
      currentTrialName.current = identifier;
      startAudioRecording(identifier);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentComponent, identifier, currentComponentHasAudioRecording]);

  // For study with screen or webcam recording
  useEffect(() => {
    if (
      !studyConfig
      || !(studyHasScreenRecording || studyHasWebcamRecording)
      || !storageEngine
      || (status && status.endTime > 0)
      || isAnalysis
    ) {
      return;
    }

    if (screenMediaRecorder.current || webcamMediaRecorder.current || audioMediaRecorder.current) {
      stopScreenRecording();
      currentTrialName.current = null;
    }

    const shouldRecordCurrentComponent = currentComponentHasAudioRecording
      || currentComponentHasScreenRecording
      || currentComponentHasWebcamRecording;

    if (currentComponent !== 'end' && isMediaCapturing && currentTrialName.current !== identifier && shouldRecordCurrentComponent) {
      currentTrialName.current = identifier;
      startScreenRecording(identifier);
    }

    if (currentComponent === 'end') {
      stopScreenCapture();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentComponent,
    identifier,
    currentComponentHasAudioRecording,
    currentComponentHasScreenRecording,
    currentComponentHasWebcamRecording,
    isMediaCapturing,
  ]);

  const startMediaCapture = useCallback(async ({
    includeScreen,
    includeAudio,
    includeWebcam,
  }: {
    includeScreen: boolean;
    includeAudio: boolean;
    includeWebcam: boolean;
  }) => {
    document.title = includeScreen ? `RECORD THIS TAB: ${pageTitle}` : pageTitle;

    try {
      const screenStream = includeScreen ? await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser', ...(recordScreenFPS ? { frameRate: { ideal: recordScreenFPS } } : {}) },
        audio: false,
        // @ts-expect-error: experimental (selfBrowserSurface and preferCurrentTab are not yet standardized)
        selfBrowserSurface: 'include',
        preferCurrentTab: true,
      }) : null;

      const webcamStream = includeWebcam ? await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      }) : null;

      const micStream = includeAudio ? await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      }) : null;

      screenMediaStream.current = screenStream;
      webcamMediaStream.current = webcamStream;
      audioMediaStream.current = micStream;

      const stopOnEnded = () => {
        if (!isStoppingCapture.current) {
          stopScreenCapture();
        }
      };

      screenStream?.getTracks().forEach((track) => track.addEventListener('ended', stopOnEnded));
      webcamStream?.getTracks().forEach((track) => track.addEventListener('ended', stopOnEnded));
      micStream?.getTracks().forEach((track) => track.addEventListener('ended', stopOnEnded));

      if (recordVideoRef.current) {
        recordVideoRef.current.srcObject = screenStream;
        if (screenStream) {
          recordVideoRef.current.play().catch(() => undefined);
        }
      }

      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = webcamStream;
        if (webcamStream) {
          webcamVideoRef.current.play().catch(() => undefined);
        }
      }

      setIsRejected(false);
      setMediaCaptureStarted(true);
      setRecordingError(null);
      syncCaptureFlags();
    } catch (err) {
      console.error('Error accessing media:', err);
      setRecordingError('Recording permission denied or not supported.');
      stopScreenCapture();
    } finally {
      document.title = pageTitle;
    }
  }, [pageTitle, recordScreenFPS, stopScreenCapture, syncCaptureFlags]);

  const startScreenCapture = useCallback(() => {
    startMediaCapture({
      includeScreen: true,
      includeAudio: studyHasAudioRecording,
      includeWebcam: studyHasWebcamRecording,
    });
  }, [startMediaCapture, studyHasAudioRecording, studyHasWebcamRecording]);

  const startWebcamCapture = useCallback(() => {
    startMediaCapture({
      includeScreen: false,
      includeAudio: studyHasAudioRecording,
      includeWebcam: true,
    });
  }, [startMediaCapture, studyHasAudioRecording]);

  useEffect(() => {
    audioMediaStream.current?.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });
  }, [isMuted]);

  return {
    recordVideoRef,
    webcamVideoRef,
    studyHasScreenRecording,
    studyHasWebcamRecording,
    isMuted,
    setIsMuted,
    recordAudio: studyHasAudioRecording,
    recordWebcam: studyHasWebcamRecording,
    startScreenCapture,
    startWebcamCapture,
    stopScreenCapture,
    stopScreenRecording,
    startScreenRecording,
    stopAudioRecording,
    screenRecordingError,
    isScreenRecording,
    isAudioRecording,
    isWebcamRecording,
    isScreenCapturing,
    isAudioCapturing,
    isWebcamCapturing,
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
