import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState,
} from 'react';
import { useRotateTrialAssetIdentifier, useTrialAssetIdentifier } from './useTrialAssetIdentifier';
import { useStudyConfig } from './useStudyConfig';
import { useCurrentComponent, useCurrentIdentifier, useStudyId } from '../../routes/utils';
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
import { useStartupInteractionBlocked } from '../../components/StartupContext';
import { useStoreSelector } from '../store';

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
  const requireEntireScreen = studyConfig.uiConfig.requireEntireScreen ?? false;

  const recordVideoRef = useRef<HTMLVideoElement>(null);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const [screenRecordingError, setRecordingError] = useState<string | null>(null);
  const [screenCaptureVerificationError, setScreenCaptureVerificationError] = useState<string | null>(null);
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

  const currentMediaRecorder = useRef<MediaRecorder | null>(null);
  const audioMediaStream = useRef<MediaStream | null>(null);
  const audioMediaRecorder = useRef<MediaRecorder | null>(null); // recorder for audio. Necessary to save audio file to get transcription.
  const screenMediaStream = useRef<MediaStream>(null);
  const webcamMediaStream = useRef<MediaStream | null>(null);
  const webcamMediaRecorder = useRef<MediaRecorder | null>(null);
  const isStoppingCapture = useRef(false);
  const captureAttempt = useRef(0);
  const screenCaptureRevision = useRef(0);
  const audioCaptureAttempt = useRef(0);
  const isStartingCapture = useRef(false);
  const isMounted = useRef(true);

  const attachScreenPreview = useCallback(() => {
    const video = recordVideoRef.current;
    const stream = screenMediaStream.current;
    if (video && stream && video.srcObject !== stream) {
      video.srcObject = stream;
      Promise.resolve(video.play()).catch(() => undefined);
    }
  }, []);

  const attachWebcamPreview = useCallback(() => {
    const video = webcamVideoRef.current;
    const stream = webcamMediaStream.current;
    if (video && stream && video.srcObject !== stream) {
      video.srcObject = stream;
      Promise.resolve(video.play()).catch(() => undefined);
    }
  }, []);

  const currentTrialName = useRef<string | null>(null);
  const currentTrialAssetIdentifier = useRef<string | null>(null);
  const recordingChunkKeys = useRef<Map<string, string[]>>(new Map());
  const recordingChunkUploadStates = useRef<Map<string, Map<number, boolean | undefined>>>(new Map());
  const recordingChunkListeners = useRef(new Set<(trialName: string, chunkKeys: string[]) => void>());
  const pendingRecorderStops = useRef(new Set<Promise<void>>());
  const recordingStartTimes = useRef<Map<string, number>>(new Map());
  const recordingStopTimes = useRef<Map<string, number>>(new Map());
  const recorderStopPromises = useRef(new WeakMap<MediaRecorder, Promise<void>>());
  const assetIdentifier = useTrialAssetIdentifier();
  const rotateTrialAssetIdentifier = useRotateTrialAssetIdentifier();
  const interruptedCapture = useRef(false);
  const identifier = useCurrentIdentifier();
  const status = useStoredAnswer();
  const isAnalysis = useIsAnalysis();
  const startupInteractionBlocked = useStartupInteractionBlocked();

  const { storageEngine } = useStorageEngine();
  const { dataCollectionEnabled } = useStoreSelector((state) => state.modes);
  const participantId = useStoreSelector((state) => state.participantId);
  const studyId = useStudyId();
  const completed = useStoreSelector((state) => state.completed);
  const completedRef = useRef(completed);
  completedRef.current = completed;

  const currentComponent = useCurrentComponent();
  const currentComponentRef = useRef(currentComponent);
  currentComponentRef.current = currentComponent;

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

  const hasActiveVerifiedScreenCapture = useCallback(() => {
    const track = screenMediaStream.current?.getVideoTracks()[0];
    const requiredRecordersAreRunning = (!currentComponentHasScreenRecording || currentMediaRecorder.current?.state === 'recording')
      && (!currentComponentHasWebcamRecording || webcamMediaRecorder.current?.state === 'recording')
      && (!currentComponentHasAudioRecording || audioMediaRecorder.current?.state === 'recording');
    return !isStartingCapture.current && requiredRecordersAreRunning && !!track && track.readyState === 'live'
      && (!requireEntireScreen || track.getSettings().displaySurface === 'monitor');
  }, [currentComponentHasAudioRecording, currentComponentHasScreenRecording, currentComponentHasWebcamRecording, requireEntireScreen]);
  const getScreenCaptureRevision = useCallback(() => screenCaptureRevision.current, []);
  const getRecordingChunkKeys = useCallback((trialName: string) => {
    const current = recordingChunkKeys.current.get(`${studyId}:${trialName}`) ?? [];
    try {
      const stored = window.sessionStorage.getItem(`revisit-recording-chunks:${studyId}:${participantId ?? 'anonymous'}:${trialName}`);
      if (stored) return Array.from(new Set([...JSON.parse(stored) as string[], ...current]));
    } catch {
      // Keep the in-memory chunk list if browser storage is unavailable.
    }
    return current;
  }, [participantId, studyId]);
  const getScreenRecordingStartTime = useCallback((trialName: string) => recordingStartTimes.current.get(`${studyId}:${trialName}`), [studyId]);
  const getRecordingStopTime = useCallback((trialName: string) => recordingStopTimes.current.get(`${studyId}:${trialName}`), [studyId]);
  const persistSuccessfulChunkPrefix = useCallback((trialName: string) => {
    const recordingKey = `${studyId}:${trialName}`;
    const chunkUploads = recordingChunkUploadStates.current.get(recordingKey);
    if (!chunkUploads) return;
    const successfulChunkKeys: string[] = [];
    for (let index = 0; chunkUploads.get(index) === true; index += 1) {
      successfulChunkKeys.push(`${trialName}__chunk_${index}`);
    }
    recordingChunkKeys.current.set(recordingKey, successfulChunkKeys);
    try {
      window.sessionStorage.setItem(
        `revisit-recording-chunks:${studyId}:${participantId ?? 'anonymous'}:${trialName}`,
        JSON.stringify(successfulChunkKeys),
      );
    } catch {
      // Keep the in-memory manifest when browser storage is unavailable.
    }
    recordingChunkListeners.current.forEach((listener) => listener(trialName, successfulChunkKeys));
  }, [participantId, studyId]);
  const subscribeToRecordingChunkUpdates = useCallback((listener: (trialName: string, chunkKeys: string[]) => void) => {
    recordingChunkListeners.current.add(listener);
    return () => { recordingChunkListeners.current.delete(listener); };
  }, []);

  useEffect(() => {
    if (!storageEngine || typeof storageEngine.subscribeToAssetUploadSuccess !== 'function') return undefined;
    return storageEngine.subscribeToAssetUploadSuccess((assetKey) => {
      const prefix = 'screenRecording/';
      if (!assetKey.startsWith(prefix)) return;
      const match = /^(.*)__chunk_(\d+)$/.exec(assetKey.slice(prefix.length));
      if (!match) return;
      const [, trialName, index] = match;
      const chunkUploads = recordingChunkUploadStates.current.get(`${studyId}:${trialName}`);
      if (!chunkUploads) return;
      chunkUploads.set(Number(index), true);
      persistSuccessfulChunkPrefix(trialName);
    });
  }, [persistSuccessfulChunkPrefix, storageEngine, studyId]);

  useLayoutEffect(() => {
    setIsMuted(currentComponentHasClickToRecord);
  }, [currentComponentHasClickToRecord, identifier]);

  // Screen capture starts once and stops at the end of the study.
  // At the beginning of each stimulus, recording starts by calling `startScreenRecording`.
  // At the end of each stimulus, recording stops by calling `stopScreenRecording`.

  // Stop all persistent media capture streams.
  const stopScreenCapture = useCallback(() => {
    screenCaptureRevision.current += 1;
    captureAttempt.current += 1;
    audioCaptureAttempt.current += 1;
    isStartingCapture.current = false;
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

  useEffect(() => {
    if (completed) {
      stopScreenCapture();
      currentTrialName.current = null;
    }
  }, [completed, stopScreenCapture]);

  const attachSaveHandler = useCallback((
    recorder: MediaRecorder,
    saveBlob: ((blob: Blob, trialName: string) => Promise<void>) | undefined,
    trialName: string,
    errorLabel: string,
    persistChunks = false,
  ): Promise<void> => {
    let chunks: Blob[] = [];
    const recordingKey = `${studyId}:${trialName}`;
    const chunkUploads = recordingChunkUploadStates.current.get(recordingKey) ?? new Map<number, boolean | undefined>();
    recordingChunkUploadStates.current.set(recordingKey, chunkUploads);
    let chunkIndex = 0;
    let resolveStopped!: () => void;
    const stopped = new Promise<void>((resolve) => { resolveStopped = resolve; });
    pendingRecorderStops.current.add(stopped);
    stopped.then(() => pendingRecorderStops.current.delete(stopped));
    const pendingSaves: Promise<void>[] = [];
    const save = (blob: Blob, recordingIdentifier: string) => {
      if (!saveBlob) return Promise.resolve(false);
      const pending = saveBlob(blob, recordingIdentifier).then(() => true).catch((error) => {
        console.error(`Error saving ${errorLabel}:`, error);
        return false;
      });
      pendingSaves.push(pending.then(() => undefined));
      return pending;
    };

    if (persistChunks) {
      const existingChunkKeys = getRecordingChunkKeys(trialName);
      const existingChunkIndices = existingChunkKeys
        .map((key) => Number(key.slice(key.lastIndexOf('_') + 1)))
        .filter(Number.isInteger);
      existingChunkIndices.forEach((index) => chunkUploads.set(index, true));
      chunkIndex = existingChunkIndices.length > 0 ? Math.max(...existingChunkIndices) + 1 : 0;
    }

    recorder.addEventListener('start', () => {
      chunks = [];
      recordingStartTimes.current.set(recordingKey, Date.now());
      recordingStopTimes.current.delete(recordingKey);
    });
    recorder.addEventListener('dataavailable', (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
        if (persistChunks && saveBlob) {
          const chunkIdentifier = `${trialName}__chunk_${chunkIndex}`;
          const currentChunkIndex = chunkIndex;
          chunkIndex += 1;
          chunkUploads.set(currentChunkIndex, undefined);
          save(event.data, chunkIdentifier).then((saved) => {
            chunkUploads.set(currentChunkIndex, saved || chunkUploads.get(currentChunkIndex) === true);
            persistSuccessfulChunkPrefix(trialName);
          });
        }
      }
    });
    recorder.addEventListener('stop', () => {
      recordingStopTimes.current.set(recordingKey, Math.max(recordingStopTimes.current.get(recordingKey) ?? 0, Date.now()));
      save(new Blob(chunks, { type: recorder.mimeType }), trialName);
      Promise.all(pendingSaves).then(resolveStopped);
    });
    return stopped;
  }, [getRecordingChunkKeys, persistSuccessfulChunkPrefix, studyId]);

  // Start separate per-trial screen, webcam, and audio recordings from persistent capture streams.
  const startScreenRecording = useCallback((trialName: string) => {
    const wantsScreen = currentComponentHasScreenRecording;
    const wantsAudio = currentComponentHasAudioRecording;
    const wantsWebcam = currentComponentHasWebcamRecording;

    if (completedRef.current || !dataCollectionEnabled || !(wantsScreen || wantsAudio || wantsWebcam)) {
      return;
    }
    if ((wantsScreen && !screenMediaStream.current)
      || (wantsWebcam && !webcamMediaStream.current)
      || (wantsAudio && !audioMediaStream.current)) {
      return;
    }

    if (wantsAudio && audioMediaStream.current) {
      audioMediaStream.current.getAudioTracks().forEach((track) => {
        track.enabled = !currentComponentHasClickToRecord;
      });
    }

    if (wantsScreen && screenMediaStream.current) {
      const screenStream = new MediaStream([
        ...screenMediaStream.current.getVideoTracks(),
        ...(wantsAudio ? audioMediaStream.current?.getAudioTracks() ?? [] : []),
      ]);
      const recorder = new MediaRecorder(screenStream);
      currentMediaRecorder.current = recorder;
      recorderStopPromises.current.set(recorder, attachSaveHandler(
        recorder,
        storageEngine ? storageEngine.saveScreenRecording.bind(storageEngine) : undefined,
        trialName,
        'screen recording',
        requireEntireScreen,
      ));
      recorder.start(1000);
    }

    if (wantsWebcam && webcamMediaStream.current) {
      const webcamStream = new MediaStream(webcamMediaStream.current.getVideoTracks());
      const recorder = new MediaRecorder(webcamStream);
      webcamMediaRecorder.current = recorder;
      currentMediaRecorder.current ??= recorder;
      recorderStopPromises.current.set(recorder, attachSaveHandler(
        recorder,
        storageEngine ? storageEngine.saveWebcamRecording.bind(storageEngine) : undefined,
        trialName,
        'webcam recording',
      ));
      recorder.start(1000);
    }

    if (wantsAudio && audioMediaStream.current) {
      const audioStream = new MediaStream(audioMediaStream.current.getAudioTracks());
      const recorder = new MediaRecorder(audioStream);
      audioMediaRecorder.current = recorder;
      currentMediaRecorder.current ??= recorder;
      recorderStopPromises.current.set(recorder, attachSaveHandler(
        recorder,
        storageEngine ? storageEngine.saveAudioRecording.bind(storageEngine) : undefined,
        trialName,
        'audio recording',
      ));
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
    currentComponentHasClickToRecord,
    currentComponentHasScreenRecording,
    currentComponentHasWebcamRecording,
    dataCollectionEnabled,
    requireEntireScreen,
    storageEngine,
  ]);

  // Stop screen recording. This does not stop screen capture.
  const stopScreenRecording = useCallback(async () => {
    setIsScreenRecording(false);
    setIsAudioRecording(false);
    setIsWebcamRecording(false);
    setScreenWithAudioRecording(false);
    const recorders = [currentMediaRecorder.current, webcamMediaRecorder.current, audioMediaRecorder.current]
      .filter((recorder): recorder is MediaRecorder => !!recorder);
    recorders.forEach(stopRecorder);
    currentMediaRecorder.current = null;
    webcamMediaRecorder.current = null;
    audioMediaRecorder.current = null;
    await Promise.all([
      ...recorders.map((recorder) => recorderStopPromises.current.get(recorder)),
      ...pendingRecorderStops.current,
    ]);
  }, []);

  const stopAudioRecording = useCallback(() => {
    audioCaptureAttempt.current += 1;
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
    // Audio-only studies acquire a microphone stream for each task. The visit
    // finalizer may already have cleared the recorder ref, so release that
    // standalone stream independently. Combined capture owns this stream for
    // the duration of the shared screen/webcam capture and must keep it alive.
    if (!studyHasScreenRecording && !studyHasWebcamRecording) {
      stopMediaTracks(audioMediaStream.current);
      audioMediaStream.current = null;
    }
    stopMediaTracks(analysisAudioStream.current);
    analysisAudioStream.current = null;
    setAnalysisStreamReady(false);
  }, [studyHasScreenRecording, studyHasWebcamRecording]);

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
    if (completedRef.current || !dataCollectionEnabled) {
      return;
    }
    audioCaptureAttempt.current += 1;
    const attempt = audioCaptureAttempt.current;

    navigator.mediaDevices.getUserMedia({
      audio: true,
    }).then((s) => {
      if (completedRef.current || !isMounted.current || attempt !== audioCaptureAttempt.current) {
        stopMediaTracks(s);
        return;
      }
      audioMediaStream.current = s;
      const analysisTrack = s.getAudioTracks()[0]?.clone();
      if (analysisTrack) {
        analysisAudioStream.current = new MediaStream([analysisTrack]);
        setAnalysisStreamReady(true);
      }

      s.getAudioTracks().forEach((track) => {
        track.enabled = !currentComponentHasClickToRecord;
      });

      const recorder = new MediaRecorder(s);
      audioMediaRecorder.current = recorder;
      recorderStopPromises.current.set(recorder, attachSaveHandler(
        recorder,
        storageEngine?.saveAudioRecording.bind(storageEngine),
        trialName,
        'audio recording',
      ));
      recorder.start();
      setAudioRecordingError(null);
      setIsAudioRecording(true);
    }).catch((err) => {
      if (completedRef.current || !isMounted.current || attempt !== audioCaptureAttempt.current) return;
      console.error('Error accessing microphone:', err);
      setAudioRecordingError('Microphone permission denied');
      setIsAudioRecording(false);
    });
  }, [attachSaveHandler, currentComponentHasClickToRecord, dataCollectionEnabled, storageEngine]);

  // For study with just audio recording
  useEffect(() => {
    if (startupInteractionBlocked || completed || !studyConfig || studyHasScreenRecording || studyHasWebcamRecording || !studyHasAudioRecording || !storageEngine || (status && status.endTime > 0 && !studyConfig.globalVariables && !requireEntireScreen) || isAnalysis) {
      return undefined;
    }

    // Always stop recording when navigating to a trial without audio recording
    if (!currentComponentHasAudioRecording && audioMediaRecorder.current) {
      stopAudioRecording();
      currentTrialName.current = null;
      currentTrialAssetIdentifier.current = null;
      return undefined;
    }

    if (audioMediaRecorder.current) {
      stopAudioRecording();
      currentTrialName.current = null;
      currentTrialAssetIdentifier.current = null;
    }

    if (assetIdentifier && currentComponent !== 'end' && currentTrialName.current !== identifier && (currentComponentHasAudioRecording)) {
      currentTrialName.current = identifier;
      currentTrialAssetIdentifier.current = assetIdentifier;
      startAudioRecording(assetIdentifier);
      return () => {
        stopAudioRecording();
        currentTrialName.current = null;
      };
    }
    return undefined;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startupInteractionBlocked, assetIdentifier, currentComponent, identifier, currentComponentHasAudioRecording, completed]);

  // For studies with screen or webcam recording.
  useEffect(() => {
    if (currentMediaRecorder.current || webcamMediaRecorder.current || audioMediaRecorder.current) {
      stopScreenRecording();
      currentTrialName.current = null;
      currentTrialAssetIdentifier.current = null;
    }

    if (startupInteractionBlocked || completed || !studyConfig || !(studyHasScreenRecording || studyHasWebcamRecording) || !storageEngine
      || (status && status.endTime > 0 && !studyConfig.globalVariables && !requireEntireScreen) || isAnalysis) {
      return;
    }

    if (assetIdentifier && currentComponent !== 'end' && isMediaCapturing
      && (currentTrialName.current !== identifier || currentTrialAssetIdentifier.current !== assetIdentifier)
      && (currentComponentHasAudioRecording || currentComponentHasScreenRecording || currentComponentHasWebcamRecording)) {
      currentTrialName.current = identifier;
      currentTrialAssetIdentifier.current = assetIdentifier;
      startScreenRecording(assetIdentifier);
    }

    if (currentComponent === 'end') {
      stopScreenCapture();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startupInteractionBlocked, assetIdentifier, currentComponent, identifier, currentComponentHasAudioRecording, currentComponentHasScreenRecording, currentComponentHasWebcamRecording, isMediaCapturing, completed, requireEntireScreen]);

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
    if (completedRef.current || !dataCollectionEnabled) {
      return;
    }

    if (isStartingCapture.current) {
      return;
    }

    isStartingCapture.current = true;
    const attempt = captureAttempt.current + 1;
    captureAttempt.current = attempt;
    let screenStream: MediaStream | null = null;
    let webcamStream: MediaStream | null = null;
    let micStream: MediaStream | null = null;

    const isCurrentAttempt = () => !completedRef.current && isMounted.current && captureAttempt.current === attempt;
    const hasLiveTracks = (stream: MediaStream | null) => !!stream
      && stream.getTracks().length > 0
      && stream.getTracks().every((track) => track.readyState !== 'ended');
    const stopOnEnded = () => {
      if (!isStoppingCapture.current) {
        interruptedCapture.current = true;
        currentTrialName.current = null;
        if (requireEntireScreen
          && currentComponentRef.current !== SCREEN_PERMISSION_COMPONENT
          && currentComponentRef.current !== WEBCAM_PERMISSION_COMPONENT
          && currentComponentRef.current !== 'end') {
          setIsRejected(true);
        }
        stopScreenCapture();
      }
    };
    const attachEndedHandler = (stream: MediaStream | null) => {
      stream?.getTracks().forEach((track) => track.addEventListener('ended', stopOnEnded));
    };
    const stopAcquiredStreams = () => {
      [micStream, webcamStream, screenStream].forEach(stopMediaTracks);
      if (screenMediaStream.current === screenStream) screenMediaStream.current = null;
      if (webcamMediaStream.current === webcamStream) webcamMediaStream.current = null;
      if (audioMediaStream.current === micStream) audioMediaStream.current = null;
    };

    document.title = includeScreen ? `RECORD THIS TAB: ${pageTitle}` : pageTitle;

    try {
      setRecordingError(null);
      setAudioRecordingError(null);

      if (includeScreen && requireEntireScreen
        && typeof navigator.mediaDevices?.getDisplayMedia !== 'function') {
        setScreenCaptureVerificationError('This browser does not support whole-monitor sharing. Please use a supported browser to continue.');
        setRecordingError('Whole-monitor sharing is not supported in this browser');
        return;
      }

      screenStream = includeScreen ? await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: requireEntireScreen ? 'monitor' : 'browser', ...(recordScreenFPS ? { frameRate: { ideal: recordScreenFPS } } : {}) },
        audio: false,
        // @ts-expect-error: experimental (selfBrowserSurface and preferCurrentTab are not yet standardized)
        // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia#selfbrowsersurface
        selfBrowserSurface: requireEntireScreen ? 'exclude' : 'include',
        preferCurrentTab: !requireEntireScreen,
      }) : null;
      if (includeScreen && requireEntireScreen) {
        const displaySurface = screenStream?.getVideoTracks()[0]?.getSettings().displaySurface;
        if (displaySurface !== 'monitor') {
          stopMediaTracks(screenStream);
          screenStream = null;
          setScreenCaptureVerificationError(displaySurface
            ? 'Please share an entire monitor. Tab and window sharing cannot be used for this study.'
            : 'This browser cannot verify whole-monitor sharing. Please use a supported browser to continue.');
          setRecordingError('Whole-monitor sharing could not be verified');
          return;
        }
        if (!isCurrentAttempt()) {
          stopAcquiredStreams();
          return;
        }
        if (!hasLiveTracks(screenStream)) {
          stopAcquiredStreams();
          setScreenCaptureVerificationError('The selected monitor share has already ended. Please share your monitor again.');
          setRecordingError('The selected monitor share has ended');
          return;
        }
      }
      setScreenCaptureVerificationError(null);
      attachEndedHandler(screenStream);
      if (!isCurrentAttempt() || (includeScreen && !hasLiveTracks(screenStream))) {
        stopAcquiredStreams();
        return;
      }
      screenMediaStream.current = screenStream;
      attachScreenPreview();

      webcamStream = includeWebcam ? await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      }) : null;
      attachEndedHandler(webcamStream);
      if (!isCurrentAttempt() || (includeWebcam && !hasLiveTracks(webcamStream))) {
        stopAcquiredStreams();
        return;
      }
      webcamMediaStream.current = webcamStream;
      attachWebcamPreview();

      if (includeAudio) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
        } catch (err) {
          console.error('Error accessing microphone:', err);
          setAudioRecordingError('Microphone permission denied');
          throw err;
        }
      }
      attachEndedHandler(micStream);
      if (!isCurrentAttempt() || (includeAudio && !hasLiveTracks(micStream))) {
        stopAcquiredStreams();
        return;
      }
      audioMediaStream.current = micStream;
      micStream?.getAudioTracks().forEach((track) => {
        track.enabled = !currentComponentHasClickToRecord;
      });

      const analysisTrack = micStream?.getAudioTracks()[0]?.clone();
      if (analysisTrack) {
        analysisAudioStream.current = new MediaStream([analysisTrack]);
        setAnalysisStreamReady(true);
      }

      if (recordVideoRef.current) {
        if (recordVideoRef.current.srcObject !== screenStream) {
          recordVideoRef.current.srcObject = screenStream;
          if (screenStream) Promise.resolve(recordVideoRef.current.play()).catch(() => undefined);
        }
      }
      if (webcamVideoRef.current) {
        if (webcamVideoRef.current.srcObject !== webcamStream) {
          webcamVideoRef.current.srcObject = webcamStream;
          if (webcamStream) Promise.resolve(webcamVideoRef.current.play()).catch(() => undefined);
        }
      }

      setIsScreenCapturing(!!screenStream);
      setIsWebcamCapturing(!!webcamStream);
      setIsAudioCapturing(!!micStream);
      setIsMediaCapturing(!!(screenStream || webcamStream || micStream));
      setMediaCaptureStarted(true);
      setScreenWithAudioRecording(!!(screenStream && micStream && recordAudio));
      setIsRejected(false);
    } catch (err) {
      console.error('Error accessing recording media:', err);
      if (isCurrentAttempt()) {
        setRecordingError('Recording permission denied');
      }
      stopAcquiredStreams();
      stopScreenCapture();
    } finally {
      if (captureAttempt.current === attempt) {
        isStartingCapture.current = false;
      }
      document.title = pageTitle;
    }
  }, [attachScreenPreview, attachWebcamPreview, currentComponentHasClickToRecord, dataCollectionEnabled, pageTitle, recordAudio, recordScreenFPS, requireEntireScreen, stopScreenCapture]);

  const startScreenCapture = useCallback(() => {
    if (interruptedCapture.current && requireEntireScreen) {
      rotateTrialAssetIdentifier();
      interruptedCapture.current = false;
    }
    startMediaCapture({
      includeScreen: studyHasScreenRecording,
      includeAudio: studyHasAudioRecording,
      includeWebcam: studyHasWebcamRecording,
    });
  }, [requireEntireScreen, rotateTrialAssetIdentifier, startMediaCapture, studyHasAudioRecording, studyHasScreenRecording, studyHasWebcamRecording]);

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
    isMounted.current = true;

    return () => {
      isMounted.current = false;
      stopScreenCapture();
    };
  }, [stopScreenCapture]);

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
    attachScreenPreview,
    webcamVideoRef,
    attachWebcamPreview,
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
    screenCaptureVerificationError,
    requireEntireScreen,
    hasActiveVerifiedScreenCapture,
    getScreenCaptureRevision,
    getRecordingChunkKeys,
    subscribeToRecordingChunkUpdates,
    getScreenRecordingStartTime,
    getRecordingStopTime,
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

export function useOptionalRecordingContext() {
  return useContext(RecordingContext);
}
