import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { useStudyConfig } from './useStudyConfig';
import { useCurrentComponent, useCurrentIdentifier } from '../../routes/utils';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { useRecordingConfig } from './useRecordingConfig';
import { useStoredAnswer } from './useStoredAnswer';
import { useIsAnalysis } from './useIsAnalysis';
import {
  getRmsLevel,
  isSpeakingAtLevel,
  shouldMonitorMutedAudio,
  SPEECH_DETECTION_HOLD_MS,
} from '../../utils/recordingWarnings';

const SCREEN_PERMISSION_COMPONENT = '$screen-recording.components.screenRecordingPermission';
const WEBCAM_PERMISSION_COMPONENT = '$webcam-recording.components.webcamRecordingPermission';

function stopMediaTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => {
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
 * When screen or webcam recording is enabled in a stimulus, capture should be called before recording is initiated.
 * When just audio recording is enabled throughout the study, recording is initiated on each screen separately.
 */
export function useRecording() {
  const studyConfig = useStudyConfig();

  const { recordScreenFPS, recordAudio } = studyConfig.uiConfig;

  const recordVideoRef = useRef<HTMLVideoElement>(null);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const [screenRecordingError, setRecordingError] = useState<string | null>(null);
  const [audioRecordingError, setAudioRecordingError] = useState<string | null>(null);
  const [isScreenRecording, setIsScreenRecording] = useState(false);
  const [isAudioRecording, setIsAudioRecording] = useState(false);
  const [isWebcamRecording, setIsWebcamRecording] = useState(false);
  const [screenWithAudioRecording, setScreenWithAudioRecording] = useState(false);
  const [mediaCaptureStarted, setMediaCaptureStarted] = useState(false);
  const [isScreenCapturing, setIsScreenCapturing] = useState(false);
  const [isAudioCapturing, setIsAudioCapturing] = useState(false);
  const [isWebcamCapturing, setIsWebcamCapturing] = useState(false);
  const [isMediaCapturing, setIsMediaCapturing] = useState(false);
  const [isRejected, setIsRejected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const analysisAudioStream = useRef<MediaStream | null>(null);
  const [isSpeakingWhileMuted, setIsSpeakingWhileMuted] = useState(false);
  const [analysisStreamReady, setAnalysisStreamReady] = useState(false);
  const [showMutedWarning, setShowMutedWarning] = useState(false);

  // currentMediaStream and recorder can be just screen, just audio, or screen and audio combined.
  const currentMediaStream = useRef<MediaStream>(null);
  const currentMediaRecorder = useRef<MediaRecorder | null>(null);
  const audioMediaStream = useRef<MediaStream | null>(null);
  const audioMediaRecorder = useRef<MediaRecorder | null>(null); // recorder for audio. Necessary to save audio file to get transcription.
  const screenMediaStream = useRef<MediaStream>(null);
  const webcamMediaStream = useRef<MediaStream | null>(null);
  const webcamMediaRecorder = useRef<MediaRecorder | null>(null);
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

  // Screen capture starts once and stops at the end of the study.
  // At the beginning of each stimulus, recording starts by calling `startScreenRecording`.
  // At the end of each stimulus, recording stops by calling `stopScreenRecording`.

  // Stop all persistent media capture streams.
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
    setIsScreenCapturing(false);
    setIsAudioCapturing(false);
    setIsWebcamCapturing(false);
    setIsMediaCapturing(false);
    setIsScreenRecording(false);
    setIsAudioRecording(false);
    setIsWebcamRecording(false);
    setScreenWithAudioRecording(false);

    stopRecorder(currentMediaRecorder.current);
    stopRecorder(webcamMediaRecorder.current);
    stopRecorder(audioMediaRecorder.current);

    stopMediaTracks(audioMediaStream.current);
    stopMediaTracks(screenMediaStream.current);
    stopMediaTracks(webcamMediaStream.current);
    stopMediaTracks(analysisAudioStream.current);

    audioMediaStream.current = null;
    screenMediaStream.current = null;
    webcamMediaStream.current = null;
    analysisAudioStream.current = null;
    setAnalysisStreamReady(false);
    currentMediaRecorder.current = null;
    webcamMediaRecorder.current = null;
    audioMediaRecorder.current = null;

    window.setTimeout(() => {
      isStoppingCapture.current = false;
    }, 0);
  }, []);

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
      saveBlob(new Blob(chunks, { type: recorder.mimeType }), trialName).catch((error) => {
        console.error(`Error saving ${errorLabel}:`, error);
      });
    });
  }, []);

  // Start separate per-trial screen, webcam, and audio recordings from persistent capture streams.
  const startScreenRecording = useCallback((trialName: string) => {
    const wantsScreen = currentComponentHasScreenRecording;
    const wantsAudio = currentComponentHasAudioRecording;
    const wantsWebcam = currentComponentHasWebcamRecording;

    if (!(wantsScreen || wantsAudio || wantsWebcam)) {
      return;
    }
    if ((wantsScreen && !screenMediaStream.current)
      || (wantsWebcam && !webcamMediaStream.current)
      || (wantsAudio && !audioMediaStream.current)) {
      return;
    }

    if (wantsScreen && screenMediaStream.current) {
      const screenStream = new MediaStream([
        ...screenMediaStream.current.getVideoTracks(),
        ...(wantsAudio ? audioMediaStream.current?.getAudioTracks() ?? [] : []),
      ]);
      currentMediaStream.current = screenStream;
      const recorder = new MediaRecorder(screenStream);
      currentMediaRecorder.current = recorder;
      attachSaveHandler(
        recorder,
        storageEngine ? storageEngine.saveScreenRecording.bind(storageEngine) : undefined,
        trialName,
        'screen recording',
      );
      recorder.start(1000);
    }

    if (wantsWebcam && webcamMediaStream.current) {
      const webcamStream = new MediaStream(webcamMediaStream.current.getVideoTracks());
      const recorder = new MediaRecorder(webcamStream);
      webcamMediaRecorder.current = recorder;
      currentMediaRecorder.current ??= recorder;
      attachSaveHandler(
        recorder,
        storageEngine ? storageEngine.saveWebcamRecording.bind(storageEngine) : undefined,
        trialName,
        'webcam recording',
      );
      recorder.start(1000);
    }

    if (wantsAudio && audioMediaStream.current) {
      const audioStream = new MediaStream(audioMediaStream.current.getAudioTracks());
      const recorder = new MediaRecorder(audioStream);
      audioMediaRecorder.current = recorder;
      currentMediaRecorder.current ??= recorder;
      attachSaveHandler(
        recorder,
        storageEngine ? storageEngine.saveAudioRecording.bind(storageEngine) : undefined,
        trialName,
        'audio recording',
      );
      recorder.start(1000);
    }

    setScreenWithAudioRecording(wantsScreen && wantsAudio);
    setRecordingError(null);
    setIsAudioRecording(wantsAudio);
    setIsScreenRecording(wantsScreen);
    setIsWebcamRecording(wantsWebcam);
  }, [
    attachSaveHandler,
    currentComponentHasAudioRecording,
    currentComponentHasScreenRecording,
    currentComponentHasWebcamRecording,
    storageEngine,
  ]);

  // Stop screen recording. This does not stop screen capture.
  const stopScreenRecording = useCallback(() => {
    setIsScreenRecording(false);
    setIsAudioRecording(false);
    setIsWebcamRecording(false);
    setScreenWithAudioRecording(false);
    stopRecorder(currentMediaRecorder.current);
    stopRecorder(webcamMediaRecorder.current);
    stopRecorder(audioMediaRecorder.current);
    currentMediaRecorder.current = null;
    webcamMediaRecorder.current = null;
    audioMediaRecorder.current = null;
  }, []);

  const stopAudioRecording = useCallback(() => {
    setIsScreenRecording(false);
    setScreenWithAudioRecording(false);
    setIsAudioRecording(false);

    stopRecorder(currentMediaRecorder.current);
    if (audioMediaRecorder.current) {
      audioMediaRecorder.current.stream.getTracks().forEach((track) => { track.stop(); audioMediaRecorder.current?.stream.removeTrack(track); });
      audioMediaRecorder.current.stream.getAudioTracks().forEach((track) => { track.stop(); audioMediaRecorder.current?.stream.removeTrack(track); });
      stopRecorder(audioMediaRecorder.current);
      audioMediaRecorder.current = null;
    }
    stopMediaTracks(analysisAudioStream.current);
    analysisAudioStream.current = null;
    setAnalysisStreamReady(false);
  }, []);

  useEffect(() => {
    const isPermissionComponent = currentComponent === SCREEN_PERMISSION_COMPONENT
      || currentComponent === WEBCAM_PERMISSION_COMPONENT;
    const missingRequiredCapture = (studyHasScreenRecording && !isScreenCapturing)
      || (studyHasWebcamRecording && !isWebcamCapturing)
      || ((studyHasScreenRecording || studyHasWebcamRecording) && studyHasAudioRecording && !isAudioCapturing);

    if (!isPermissionComponent && currentComponent !== 'end' && mediaCaptureStarted && missingRequiredCapture) {
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
    }).then((s) => {
      audioMediaStream.current = s;
      currentMediaStream.current = s;

      const analysisTrack = s.getAudioTracks()[0]?.clone();
      if (analysisTrack) {
        analysisAudioStream.current = new MediaStream([analysisTrack]);
        setAnalysisStreamReady(true);
      }

      s.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });

      const recorder = new MediaRecorder(s);
      audioMediaRecorder.current = recorder;

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
        const { mimeType } = recorder;
        const blob = new Blob(chunks, { type: mimeType });
        storageEngine?.saveAudioRecording(blob, trialName).catch((error) => {
          console.error('Error saving audio recording:', error);
        });
      });

      recorder.start();
      setAudioRecordingError(null);
      setIsAudioRecording(true);
    }).catch((err) => {
      console.error('Error accessing microphone:', err);
      setAudioRecordingError('Microphone permission denied');
      setIsAudioRecording(false);
    });
  }, [storageEngine, isMuted]);

  // For study with just audio recording
  useEffect(() => {
    // Always stop recording when navigating to a trial without audio recording
    if (!currentComponentHasAudioRecording && audioMediaRecorder.current) {
      stopAudioRecording();
      currentTrialName.current = null;
      return;
    }

    if (!studyConfig || studyHasScreenRecording || studyHasWebcamRecording || !studyHasAudioRecording || !storageEngine || (status && status.endTime > 0) || isAnalysis) {
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

  // For studies with screen or webcam recording.
  useEffect(() => {
    if (!studyConfig || !(studyHasScreenRecording || studyHasWebcamRecording) || !storageEngine || (status && status.endTime > 0) || isAnalysis) {
      return;
    }

    if (currentMediaRecorder.current || webcamMediaRecorder.current || audioMediaRecorder.current) {
      stopScreenRecording();
      currentTrialName.current = null;
    }

    if (currentComponent !== 'end' && isMediaCapturing && currentTrialName.current !== identifier && (currentComponentHasAudioRecording || currentComponentHasScreenRecording || currentComponentHasWebcamRecording)) {
      currentTrialName.current = identifier;
      startScreenRecording(identifier);
    }

    if (currentComponent === 'end') {
      stopScreenCapture();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentComponent, identifier, currentComponentHasAudioRecording, currentComponentHasScreenRecording, currentComponentHasWebcamRecording, isMediaCapturing]);

  // Start persistent capture. Per-trial recording begins in the navigation effect above.
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
      setRecordingError(null);
      setAudioRecordingError(null);

      const screenStream = includeScreen ? await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser', ...(recordScreenFPS ? { frameRate: { ideal: recordScreenFPS } } : {}) },
        audio: false,
        // @ts-expect-error: experimental (selfBrowserSurface and preferCurrentTab are not yet standardized)
        // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia#selfbrowsersurface
        selfBrowserSurface: 'include',
        preferCurrentTab: true,
      }) : null;

      const webcamStream = includeWebcam ? await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      }) : null;

      let micStream: MediaStream | null = null;
      if (includeAudio) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
        } catch (err) {
          console.error('Error accessing microphone:', err);
          setAudioRecordingError('Microphone permission denied');
        }
      }

      screenMediaStream.current = screenStream;
      webcamMediaStream.current = webcamStream;
      audioMediaStream.current = micStream;

      const analysisTrack = micStream?.getAudioTracks()[0]?.clone();
      if (analysisTrack) {
        analysisAudioStream.current = new MediaStream([analysisTrack]);
        setAnalysisStreamReady(true);
      }

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

      const stopOnEnded = () => {
        if (!isStoppingCapture.current) {
          stopScreenCapture();
        }
      };
      [screenStream, webcamStream, micStream].forEach((stream) => {
        stream?.getTracks().forEach((track) => track.addEventListener('ended', stopOnEnded));
      });

      setIsScreenCapturing(!!screenStream);
      setIsWebcamCapturing(!!webcamStream);
      setIsAudioCapturing(!!micStream);
      setIsMediaCapturing(!!(screenStream || webcamStream || micStream));
      setMediaCaptureStarted(true);
      setScreenWithAudioRecording(!!(screenStream && micStream && recordAudio));
      setIsRejected(false);
    } catch (err) {
      console.error('Error accessing recording media:', err);
      setRecordingError('Recording permission denied');
      stopScreenCapture();
    } finally {
      document.title = pageTitle;
    }
  }, [pageTitle, recordAudio, recordScreenFPS, stopScreenCapture]);

  const startScreenCapture = useCallback(() => {
    startMediaCapture({
      includeScreen: studyHasScreenRecording,
      includeAudio: studyHasAudioRecording,
      includeWebcam: studyHasWebcamRecording,
    });
  }, [startMediaCapture, studyHasAudioRecording, studyHasScreenRecording, studyHasWebcamRecording]);

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
    let t = <NodeJS.Timeout | null>null;
    if (shouldMonitorMutedAudio(isMuted, currentComponentHasAudioRecording)) {
      t = setTimeout(() => {
        setShowMutedWarning(true);
      }, 5000);
    } else {
      setShowMutedWarning(false);
    }
    return () => {
      t && clearTimeout(t);
    };
  }, [currentComponentHasAudioRecording, isMuted]);

  useEffect(() => {
    if (!shouldMonitorMutedAudio(isMuted, currentComponentHasAudioRecording) || !analysisStreamReady || !analysisAudioStream.current) return undefined;

    const stream = analysisAudioStream.current;
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.2;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    const domainData = new Float32Array(analyser.fftSize);
    const speechReleaseDelayMs = 3000;

    let animFrameId = 0;
    let wasSpeaking = false;
    let speechCandidateStart: number | null = null;
    let lastDetectedSpeechAt: number | null = null;

    const clearSpeaking = () => {
      wasSpeaking = false;
      speechCandidateStart = null;
      lastDetectedSpeechAt = null;
      setIsSpeakingWhileMuted(false);
    };

    const checkAudio = (timestamp: number) => {
      analyser.getFloatTimeDomainData(domainData);
      const rmsLevel = getRmsLevel(domainData);
      const speaking = isSpeakingAtLevel(rmsLevel, wasSpeaking);

      if (speaking) {
        speechCandidateStart ??= timestamp;
        lastDetectedSpeechAt = timestamp;

        if (!wasSpeaking && timestamp - speechCandidateStart >= SPEECH_DETECTION_HOLD_MS) {
          wasSpeaking = true;
        }
      } else {
        speechCandidateStart = null;
      }

      if (wasSpeaking && lastDetectedSpeechAt !== null && timestamp - lastDetectedSpeechAt >= speechReleaseDelayMs) {
        clearSpeaking();
      } else if (wasSpeaking) {
        setIsSpeakingWhileMuted(true);
      }

      animFrameId = requestAnimationFrame(checkAudio);
    };
    animFrameId = requestAnimationFrame(checkAudio);

    return () => {
      cancelAnimationFrame(animFrameId);
      audioContext.close();
      clearSpeaking();
    };
  }, [currentComponentHasAudioRecording, isMuted, analysisStreamReady]);

  return {
    recordVideoRef,
    webcamVideoRef,
    studyHasScreenRecording,
    studyHasAudioRecording,
    studyHasWebcamRecording,
    currentComponentHasAudioRecording,
    currentComponentHasWebcamRecording,
    isMuted,
    setIsMuted,
    recordAudio,
    startScreenCapture,
    startWebcamCapture,
    stopScreenCapture,
    startScreenRecording,
    stopScreenRecording,
    screenRecordingError,
    audioRecordingError,
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
    isSpeakingWhileMuted,
    showMutedWarning,
    audioStatus: audioRecordingError
      ? 'denied'
      : isAudioRecording
        ? 'recording'
        : currentComponentHasAudioRecording
          ? 'pending'
          : 'idle',
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
