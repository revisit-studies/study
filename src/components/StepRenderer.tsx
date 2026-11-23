import {
  ActionIcon, AppShell, Button, Flex, Menu, Text, useComputedColorScheme,
} from '@mantine/core';
import { Outlet } from 'react-router';
import {
  useCallback, useEffect, useMemo, useRef,
  useState,
} from 'react';
import type { CSSProperties } from 'react';
import debounce from 'lodash.debounce';
import { IconArrowLeft, IconDotsVertical } from '@tabler/icons-react';
import { useStartupInteractionBlocked } from './StartupContext';
import { GlobalStoreHistory } from './interface/GlobalStoreHistory';
import { AppAside } from './interface/AppAside';
import { AppHeader } from './interface/AppHeader';
import { AppNavBar } from './interface/AppNavBar';
import { TrialProvenanceBoundary } from '../store/hooks/useTrialProvenance';
import { HelpModal } from './interface/HelpModal';
import { AlertModal, STORAGE_RETRY_SUCCESS_EVENT } from './interface/AlertModal';
import { ConfigVersionWarningModal } from './interface/ConfigVersionWarningModal';
import { EventType, StoredAnswer } from '../store/types';
import { useStudyConfig } from '../store/hooks/useStudyConfig';
import { WindowEventsContext, type WindowEventsRef } from '../store/hooks/useWindowEvents';
import { useStoreSelector, useStoreDispatch, useStoreActions } from '../store/store';
import { AnalysisFooter } from './interface/AnalysisFooter';
import { useIsAnalysis } from '../store/hooks/useIsAnalysis';
import { studyComponentToIndividualComponent } from '../utils/handleComponentInheritance';
import { useCurrentComponent, useCurrentIdentifier } from '../routes/utils';
import { useFetchStylesheet } from '../utils/fetchStylesheet';
import { getDisplayStatus } from '../utils/recordingEvents';
import { RecordingContext, useRecording } from '../store/hooks/useRecording';
import { useGamepad } from '../store/hooks/useGamepad';
import { ScreenRecordingRejection } from './interface/ScreenRecordingRejection';
import { ReplayContext, useReplay } from '../store/hooks/useReplay';
import { DeviceWarning } from './interface/DeviceWarning';
import { handleBeforeUnload, shouldConfirmTabClose } from '../utils/closeTabConfirmation';
import { useStorageEngine } from '../storage/storageEngineHooks';
import {
  buildPdfFilename, getPdfExportUnsupportedReason, saveElementAsPdf, waitForNextPaint,
} from '../utils/pdfExport';
import { hideNotification, showNotification } from '../utils/notifications';
import { PdfExportMenuItem } from './interface/PdfExportMenuItem';
import { getStudyLogoUrl } from '../utils/studyLogo';
import { useRotateTrialAssetIdentifier, useTrialAssetSegments } from '../store/hooks/useTrialAssetIdentifier';

const STUDY_BROWSER_WIDTH = 360;

function pushWindowEvent(windowEvents: WindowEventsRef, event: EventType) {
  if (windowEvents.submissionFinalizing) {
    (windowEvents.submissionDeferredEvents ??= []).push(event);
  } else {
    windowEvents.current.push(event);
  }
}

export function StepRenderer() {
  const windowEvents = useRef<EventType[]>([]) as WindowEventsRef;
  const flushDebouncedEvents = useRef<Array<() => void>>([]);
  const dispatch = useStoreDispatch();
  const { toggleStudyBrowser, setAlertModal, saveTrialAnswer } = useStoreActions();
  const { storageEngine } = useStorageEngine();

  const isAnalysis = useIsAnalysis();
  const startupInteractionBlocked = useStartupInteractionBlocked();
  const studyConfig = useStudyConfig();
  const studyColorMode = useComputedColorScheme('light');
  const currentComponent = useCurrentComponent();
  const currentIdentifier = useCurrentIdentifier();
  const assetSegments = useTrialAssetSegments();
  const rotateTrialAssetIdentifier = useRotateTrialAssetIdentifier();
  const [, refreshAfterRecordingRotation] = useState(0);
  const assetIdentifier = assetSegments[assetSegments.length - 1];
  const recordingVisitStartRef = useRef({ assetIdentifier, time: Date.now() });
  if (recordingVisitStartRef.current.assetIdentifier !== assetIdentifier) {
    recordingVisitStartRef.current = { assetIdentifier, time: Date.now() };
  }

  const componentConfig = useMemo(() => studyComponentToIndividualComponent(studyConfig.components[currentComponent] || {}, studyConfig), [currentComponent, studyConfig]);

  const windowEventDebounceTime = useMemo(() => componentConfig.windowEventDebounceTime ?? studyConfig.uiConfig.windowEventDebounceTime ?? 100, [componentConfig, studyConfig]);

  const captureGamepad = useMemo(() => componentConfig.captureGamepad ?? studyConfig.uiConfig.captureGamepad ?? false, [componentConfig, studyConfig]);
  const requireEntireScreen = studyConfig.uiConfig.requireEntireScreen ?? false;
  const globalStoreEnabled = studyConfig.globalVariables !== undefined;
  const [multipleDisplaysDetected, setMultipleDisplaysDetected] = useState(false);
  const [isVisitFinalizing, setIsVisitFinalizing] = useState(false);
  const [interruptionSaved, setInterruptionSaved] = useState(false);

  useFetchStylesheet(studyConfig?.uiConfig.stylesheetPath);

  const showStudyBrowser = useStoreSelector((state) => state.showStudyBrowser);
  const modes = useStoreSelector((state) => state.modes);
  const answers = useStoreSelector((state) => state.answers);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const currentIdentifierRef = useRef(currentIdentifier);
  currentIdentifierRef.current = currentIdentifier;
  const currentAssetIdentifierRef = useRef(assetIdentifier);
  currentAssetIdentifierRef.current = assetIdentifier;
  const isCompleted = useStoreSelector((state) => state.completed);
  const isSubmittingFinal = useStoreSelector((state) => state.isSubmittingFinal);

  const screenRecording = useRecording();
  const replay = useReplay();

  const { isRejected: isScreenRecordingUserRejected } = screenRecording;
  const {
    getRecordingChunkKeys,
    getScreenRecordingStartTime,
    getRecordingStopTime,
    stopScreenRecording,
    subscribeToRecordingChunkUpdates,
  } = screenRecording;
  const isScreenRecordingPermission = currentComponent === '$screen-recording.components.screenRecordingPermission'
    || currentComponent === '$webcam-recording.components.webcamRecordingPermission';
  const recordsScreen = componentConfig.recordScreen ?? studyConfig.uiConfig.recordScreen ?? false;
  const recordsAudio = componentConfig.recordAudio ?? studyConfig.uiConfig.recordAudio ?? false;
  const recordsWebcam = componentConfig.recordWebcam ?? studyConfig.uiConfig.recordWebcam ?? false;
  const isEntireScreenRecordingVisit = !isAnalysis
    && modes.dataCollectionEnabled
    && requireEntireScreen
    && currentComponent !== 'end'
    && !isCompleted
    && !isScreenRecordingPermission
    && (recordsScreen || recordsAudio || recordsWebcam);
  const hasActiveVerifiedScreenCapture = screenRecording.hasActiveVerifiedScreenCapture();
  const isEntireScreenTaskBlocked = !isAnalysis
    && modes.dataCollectionEnabled
    && requireEntireScreen
    && currentComponent !== 'end'
    && !isCompleted
    && !isScreenRecordingPermission
    && (recordsScreen || recordsAudio || recordsWebcam)
    && !windowEvents.visitFinalizing
    && !hasActiveVerifiedScreenCapture;
  const isEntireScreenVisitInterrupted = isEntireScreenRecordingVisit && !hasActiveVerifiedScreenCapture;
  const persistedInterruptedTask = useRef<string | null>(null);
  const retryInterruptedRecordingSave = useRef<(() => Promise<void>) | null>(null);
  const recordingAnswersBySegment = useRef(new Map<string, { identifier: string; segments: string[]; answer: StoredAnswer }>());
  const recordingAnswerPersistence = useRef(Promise.resolve(true));

  const persistRecordingChunkManifest = useCallback((
    recording: { identifier: string; segments: string[]; answer: StoredAnswer },
    force = false,
    flushParticipantData = false,
  ) => {
    const nextPersistence = recordingAnswerPersistence.current.catch(() => false).then(async () => {
      const currentAnswer = force ? recording.answer : answersRef.current[recording.identifier] ?? recording.answer;
      const recordingChunkKeys = {
        ...(recording.answer.recordingChunkKeys ?? {}),
        ...(currentAnswer.recordingChunkKeys ?? {}),
      };
      let changed = force;
      recording.segments.forEach((segment) => {
        const chunkKeys = getRecordingChunkKeys(segment);
        if (chunkKeys.length === 0) return;
        const mergedChunkKeys = Array.from(new Set([...(recordingChunkKeys[segment] ?? []), ...chunkKeys]));
        if (mergedChunkKeys.length !== (recordingChunkKeys[segment] ?? []).length) changed = true;
        recordingChunkKeys[segment] = mergedChunkKeys;
      });
      if (!changed) return true;
      if (!storageEngine) return false;

      const updatedAnswer = { ...currentAnswer, recordingChunkKeys };
      recording.answer = updatedAnswer;
      dispatch(saveTrialAnswer(updatedAnswer));
      try {
        await storageEngine.saveAnswers({ ...answersRef.current, [recording.identifier]: updatedAnswer });
        if (flushParticipantData) await storageEngine.flushPendingParticipantData();
        return true;
      } catch (error) {
        console.error('Failed to save interrupted screen recording observations', error);
        dispatch(setAlertModal({
          show: true,
          message: 'The interrupted task observations could not be saved. Please check your connection.',
          title: 'Failed to Save Response',
        }));
        return false;
      }
    });
    recordingAnswerPersistence.current = nextPersistence;
    return nextPersistence;
  }, [dispatch, getRecordingChunkKeys, saveTrialAnswer, setAlertModal, storageEngine]);

  useEffect(() => {
    if (!storageEngine) return undefined;
    return storageEngine.registerParticipantFinalizationBarrier(async () => {
      await stopScreenRecording();
      try {
        await storageEngine.flushPendingAssetUploads();
      } catch {
        // Let finalizeParticipant return its structured non-retryable asset error.
      }
      if (!(await recordingAnswerPersistence.current)) {
        throw new Error('Recording chunk metadata could not be saved before participant finalization.');
      }
      await storageEngine.flushPendingParticipantData();
    });
  }, [stopScreenRecording, storageEngine]);

  useEffect(() => {
    const retryInterruptedSave = () => {
      retryInterruptedRecordingSave.current?.().catch((error) => {
        console.error('Failed to finish saving the interrupted screen recording', error);
        dispatch(setAlertModal({
          show: true,
          message: 'The interrupted recording could not be fully saved. Please check your connection and retry.',
          title: 'Failed to Save Response',
        }));
      });
    };
    window.addEventListener(STORAGE_RETRY_SUCCESS_EVENT, retryInterruptedSave);
    return () => window.removeEventListener(STORAGE_RETRY_SUCCESS_EVENT, retryInterruptedSave);
  }, [dispatch, setAlertModal]);

  useEffect(() => subscribeToRecordingChunkUpdates((segment) => {
    let recording = recordingAnswersBySegment.current.get(segment);
    if (!recording) {
      const matchingAnswer = Object.entries(answersRef.current).find(([, answer]) => (
        answer.assetIdentifier === segment || answer.recordingSegments?.includes(segment)
      ));
      if (!matchingAnswer) return;
      const [identifier, answer] = matchingAnswer;
      recording = { identifier, segments: answer.recordingSegments ?? [segment], answer };
      recording.segments.forEach((recordingSegment) => recordingAnswersBySegment.current.set(recordingSegment, recording!));
    }
    persistRecordingChunkManifest(recording).catch(() => undefined);
  }), [persistRecordingChunkManifest, subscribeToRecordingChunkUpdates]);

  const analysisHasScreenRecording = useStoreSelector((state) => state.analysisHasScreenRecording);
  const analysisHasWebcamRecording = useStoreSelector((state) => state.analysisHasWebcamRecording);
  const analysisCanPlayScreenRecording = useStoreSelector((state) => state.analysisCanPlayScreenRecording);

  useEffect(() => {
    if (!isScreenRecordingUserRejected || !isEntireScreenVisitInterrupted || !storageEngine || !assetIdentifier
      || persistedInterruptedTask.current === `${currentIdentifier}:${assetIdentifier}`) return;
    const currentAnswer = answersRef.current[currentIdentifier];
    if (!currentAnswer) return;

    persistedInterruptedTask.current = `${currentIdentifier}:${assetIdentifier}`;
    pushWindowEvent(windowEvents, [Date.now(), 'captureinterrupted', 'screen']);
    windowEvents.flushPending?.();
    const outgoingIdentifier = currentIdentifier;
    const outgoingAssetIdentifier = assetIdentifier;
    const visitStartTime = recordingVisitStartRef.current.time;
    const observedEvents = windowEvents.current.splice(0);
    setInterruptionSaved(false);
    (async () => {
      await stopScreenRecording();
      const latestAnswer = answersRef.current[outgoingIdentifier] ?? currentAnswer;
      const recordingEndTime = getRecordingStopTime(outgoingAssetIdentifier) ?? Date.now();
      const acceptedAnswer = latestAnswer.endTime > 0;
      const acceptedGlobalStoreAnswer = acceptedAnswer && globalStoreEnabled;
      const interruptedAnswer: StoredAnswer = {
        ...latestAnswer,
        identifier: outgoingIdentifier,
        assetIdentifier: acceptedGlobalStoreAnswer ? latestAnswer.assetIdentifier : outgoingAssetIdentifier,
        answer: acceptedAnswer ? latestAnswer.answer : {},
        startTime: acceptedAnswer ? latestAnswer.startTime : latestAnswer.startTime || observedEvents[0]?.[0] || Date.now(),
        endTime: acceptedAnswer ? latestAnswer.endTime : -1,
        recordingStartTime: latestAnswer.recordingStartTime ?? (latestAnswer.startTime > 0 ? latestAnswer.startTime : observedEvents[0]?.[0] ?? recordingEndTime),
        recordingEndTime: Math.max(latestAnswer.recordingEndTime ?? 0, recordingEndTime),
        recordingSegmentTimes: {
          ...(latestAnswer.recordingSegmentTimes ?? {}),
          [outgoingAssetIdentifier]: {
            startTime: getScreenRecordingStartTime(outgoingAssetIdentifier)
              ?? latestAnswer.recordingSegmentTimes?.[outgoingAssetIdentifier]?.startTime
              ?? visitStartTime,
            endTime: recordingEndTime,
          },
        },
        windowEvents: [...(latestAnswer.windowEvents ?? []), ...observedEvents],
        recordingSegments: Array.from(new Set([
          ...(latestAnswer.recordingSegments ?? []),
          ...(latestAnswer.assetIdentifier ? [latestAnswer.assetIdentifier] : []),
          ...assetSegments,
          outgoingAssetIdentifier,
        ])),
        recordingSegmentRanges: (() => {
          const ranges = latestAnswer.recordingSegmentRanges ?? [];
          const actualStartTime = getScreenRecordingStartTime(outgoingAssetIdentifier);
          const startTime = actualStartTime
            ?? (latestAnswer.assetIdentifier === outgoingAssetIdentifier
              ? (ranges.find((range) => range.assetIdentifier === outgoingAssetIdentifier)?.startTime ?? latestAnswer.startTime ?? recordingEndTime)
              : (observedEvents[0]?.[0] ?? latestAnswer.recordingEndTime ?? recordingEndTime));
          const existing = ranges.find((range) => range.assetIdentifier === outgoingAssetIdentifier);
          return existing
            ? ranges.map((range) => (range.assetIdentifier === outgoingAssetIdentifier
              ? {
                ...range,
                startTime: actualStartTime ?? range.startTime,
                endTime: recordingEndTime,
                visitStartTime,
              }
              : range))
            : actualStartTime === undefined ? ranges : [...ranges, {
              assetIdentifier: outgoingAssetIdentifier,
              startTime,
              endTime: recordingEndTime,
              visitStartTime,
            }];
        })(),
      };
      const interrupted = { identifier: outgoingIdentifier, segments: interruptedAnswer.recordingSegments ?? [outgoingAssetIdentifier], answer: interruptedAnswer };
      interrupted.segments.forEach((segment) => recordingAnswersBySegment.current.set(segment, interrupted));
      retryInterruptedRecordingSave.current = async () => {
        await storageEngine.flushPendingAssetUploads();
        const saved = await persistRecordingChunkManifest(interrupted, true, true);
        if (saved) {
          retryInterruptedRecordingSave.current = null;
          setInterruptionSaved(true);
        }
      };
      await retryInterruptedRecordingSave.current();
    })().catch((error) => {
      console.error('Failed to stop the interrupted screen recording', error);
      dispatch(setAlertModal({
        show: true,
        message: 'The interrupted task observations could not be saved. Please check your connection.',
        title: 'Failed to Save Response',
      }));
    });
  }, [assetIdentifier, assetSegments, currentIdentifier, dispatch, getScreenRecordingStartTime, getRecordingStopTime, globalStoreEnabled, isEntireScreenVisitInterrupted, isScreenRecordingUserRejected, persistRecordingChunkManifest, saveTrialAnswer, setAlertModal, stopScreenRecording, storageEngine]);

  const recordingCheckpointInFlight = useRef(false);
  const initialCheckpointedAsset = useRef<string | null>(null);
  useEffect(() => {
    if (!requireEntireScreen || !modes.dataCollectionEnabled || isAnalysis || isCompleted
      || currentComponent === 'end' || isScreenRecordingPermission
      || !(recordsScreen || recordsAudio || recordsWebcam)
      || !storageEngine || !assetIdentifier) return undefined;
    const currentAssetIdentifier = assetIdentifier;

    const checkpoint = (force = false): Promise<boolean> => {
      if (recordingCheckpointInFlight.current) {
        return (windowEvents.checkpointPending ?? Promise.resolve(false)).then(() => checkpoint(force));
      }
      if (windowEvents.submissionPending
        || (!force && isEntireScreenTaskBlocked)
        || currentIdentifierRef.current !== currentIdentifier
        || currentAssetIdentifierRef.current !== currentAssetIdentifier) return Promise.resolve(false);
      const currentAnswers = answersRef.current;
      const currentAnswer = currentAnswers[currentIdentifier];
      const acceptedAnswer = currentAnswer?.endTime > 0;
      const acceptedGlobalStoreAnswer = acceptedAnswer && globalStoreEnabled;
      if (!currentAnswer) return Promise.resolve(false);
      windowEvents.flushPending?.();
      const pendingEventCount = windowEvents.current.length;
      const newEvents = windowEvents.current.slice(0, pendingEventCount);
      const recordingEndTime = getRecordingStopTime(currentAssetIdentifier) ?? Date.now();
      const checkpointAnswer = {
        ...currentAnswer,
        identifier: currentIdentifier,
        assetIdentifier: acceptedGlobalStoreAnswer ? currentAnswer.assetIdentifier : currentAssetIdentifier,
        answer: currentAnswer.answer ?? {},
        startTime: acceptedAnswer ? currentAnswer.startTime : currentAnswer.startTime || newEvents[0]?.[0] || recordingEndTime,
        endTime: acceptedAnswer ? currentAnswer.endTime : -1,
        recordingStartTime: currentAnswer.recordingStartTime ?? (currentAnswer.startTime > 0 ? currentAnswer.startTime : newEvents[0]?.[0] ?? recordingEndTime),
        recordingEndTime: Math.max(currentAnswer.recordingEndTime ?? 0, recordingEndTime),
        recordingSegmentTimes: {
          ...(currentAnswer.recordingSegmentTimes ?? {}),
          [currentAssetIdentifier]: {
            startTime: getScreenRecordingStartTime(currentAssetIdentifier)
              ?? currentAnswer.recordingSegmentTimes?.[currentAssetIdentifier]?.startTime
              ?? recordingVisitStartRef.current.time,
            endTime: recordingEndTime,
          },
        },
        recordingChunkKeys: {
          ...(currentAnswer.recordingChunkKeys ?? {}),
          ...Object.fromEntries(assetSegments.flatMap((segment) => {
            const chunkKeys = getRecordingChunkKeys(segment);
            return chunkKeys.length > 0 ? [[segment, chunkKeys]] : [];
          })),
        },
        windowEvents: [...(currentAnswer.windowEvents ?? []), ...newEvents],
        recordingSegments: Array.from(new Set([
          ...(currentAnswer.recordingSegments ?? []),
          ...(currentAnswer.assetIdentifier ? [currentAnswer.assetIdentifier] : []),
          ...assetSegments,
          currentAssetIdentifier,
        ])),
        recordingSegmentRanges: (() => {
          const ranges = currentAnswer.recordingSegmentRanges ?? [];
          if (!recordsScreen) return ranges;
          const existing = ranges.find((range) => range.assetIdentifier === currentAssetIdentifier);
          const actualStartTime = getScreenRecordingStartTime(currentAssetIdentifier);
          const startTime = actualStartTime
            ?? (currentAnswer.assetIdentifier === currentAssetIdentifier
              ? (existing?.startTime ?? currentAnswer.startTime ?? recordingEndTime)
              : (newEvents[0]?.[0] ?? currentAnswer.recordingEndTime ?? recordingEndTime));
          return existing
            ? ranges.map((range) => (range.assetIdentifier === currentAssetIdentifier
              ? {
                ...range,
                startTime: actualStartTime ?? range.startTime,
                endTime: recordingEndTime,
                visitStartTime: recordingVisitStartRef.current.time,
              }
              : range))
            : actualStartTime === undefined ? ranges : [...ranges, {
              assetIdentifier: currentAssetIdentifier,
              startTime,
              endTime: recordingEndTime,
              visitStartTime: recordingVisitStartRef.current.time,
            }];
        })(),
      };
      const answersToSave = { ...currentAnswers, [currentIdentifier]: checkpointAnswer };
      recordingCheckpointInFlight.current = true;
      const checkpointPending = storageEngine.saveAnswers(answersToSave).then(async () => {
        if (currentIdentifierRef.current === currentIdentifier
          && currentAssetIdentifierRef.current === currentAssetIdentifier) {
          const latestAnswer = answersRef.current[currentIdentifier];
          const rangesByAsset = new Map((checkpointAnswer.recordingSegmentRanges ?? []).map((range) => [range.assetIdentifier, range]));
          (latestAnswer?.recordingSegmentRanges ?? []).forEach((range) => {
            const checkpointRange = rangesByAsset.get(range.assetIdentifier);
            if (!checkpointRange || range.endTime >= checkpointRange.endTime) rangesByAsset.set(range.assetIdentifier, range);
          });
          const chunkKeys = { ...checkpointAnswer.recordingChunkKeys, ...latestAnswer?.recordingChunkKeys };
          Object.keys(chunkKeys).forEach((segment) => {
            chunkKeys[segment] = Array.from(new Set([
              ...(checkpointAnswer.recordingChunkKeys?.[segment] ?? []),
              ...(latestAnswer?.recordingChunkKeys?.[segment] ?? []),
            ]));
          });
          const mergedAnswer = latestAnswer === currentAnswer ? checkpointAnswer : {
            ...checkpointAnswer,
            ...latestAnswer,
            assetIdentifier: checkpointAnswer.assetIdentifier,
            windowEvents: [...(latestAnswer.windowEvents ?? []), ...newEvents.filter((event) => !(latestAnswer.windowEvents ?? []).some((saved) => saved[0] === event[0] && saved[1] === event[1] && saved[2] === event[2]))],
            recordingSegments: Array.from(new Set([...(checkpointAnswer.recordingSegments ?? []), ...(latestAnswer.recordingSegments ?? [])])),
            recordingSegmentRanges: Array.from(rangesByAsset.values()),
            recordingChunkKeys: chunkKeys,
            recordingEndTime: Math.max(checkpointAnswer.recordingEndTime ?? 0, latestAnswer.recordingEndTime ?? 0),
            recordingSegmentTimes: Array.from(new Set([
              ...Object.keys(checkpointAnswer.recordingSegmentTimes ?? {}),
              ...Object.keys(latestAnswer.recordingSegmentTimes ?? {}),
            ])).reduce<Record<string, { startTime: number; endTime: number }>>((times, segment) => {
              const checkpointTime = checkpointAnswer.recordingSegmentTimes?.[segment];
              const latestTime = latestAnswer.recordingSegmentTimes?.[segment];
              const newestTime = !checkpointTime || (latestTime && latestTime.endTime > checkpointTime.endTime) ? latestTime : checkpointTime;
              if (newestTime) times[segment] = newestTime;
              return times;
            }, {}),
          };
          if (mergedAnswer !== checkpointAnswer) {
            await storageEngine.saveAnswers({ ...answersRef.current, [currentIdentifier]: mergedAnswer });
          }
          dispatch(saveTrialAnswer(mergedAnswer));
          newEvents.forEach((event) => {
            const eventIndex = windowEvents.current.indexOf(event);
            if (eventIndex !== -1) windowEvents.current.splice(eventIndex, 1);
          });
          return true;
        }
        // The checkpoint snapshot may have finished after navigation; restore the latest accepted answer state.
        await storageEngine.saveAnswers(answersRef.current);
        return false;
      }).catch((error) => {
        console.error('Failed to checkpoint screen recording observations', error);
        return false;
      }).finally(() => {
        recordingCheckpointInFlight.current = false;
        if (windowEvents.checkpointPending === checkpointPending) windowEvents.checkpointPending = undefined;
      });
      windowEvents.checkpointPending = checkpointPending;
      return checkpointPending;
    };

    const finalizeVisit = async (beforeComplete?: () => Promise<void>) => {
      windowEvents.flushPending?.();
      windowEvents.visitFinalizing = true;
      windowEvents.submissionFinalizing = true;
      setIsVisitFinalizing(true);
      let saved = false;
      const saveAndDrainDeferredEvents = async (): Promise<boolean> => {
        const deferredEvents = windowEvents.submissionDeferredEvents ?? [];
        if (deferredEvents.length > 0) windowEvents.current.push(...deferredEvents.splice(0));
        const checkpointSaved = await checkpoint(true);
        if (!checkpointSaved) return false;
        return (windowEvents.submissionDeferredEvents ?? []).length > 0
          ? saveAndDrainDeferredEvents()
          : true;
      };
      try {
        await stopScreenRecording();
        try {
          await storageEngine.flushPendingAssetUploads();
        } catch (error) {
          dispatch(setAlertModal({
            show: true,
            message: 'The current recording could not be fully saved. Check your connection and retry before navigating away.',
            title: 'Failed to Save Response',
          }));
          throw error;
        }
        saved = await saveAndDrainDeferredEvents();
        if (!saved) return false;
        await beforeComplete?.();
        return true;
      } catch (error) {
        console.error('Failed to finalize the current screen recording visit', error);
        saved = false;
        return false;
      } finally {
        if (!saved && windowEvents.submissionDeferredEvents?.length) {
          windowEvents.current.push(...windowEvents.submissionDeferredEvents);
        }
        windowEvents.submissionDeferredEvents = [];
        windowEvents.submissionFinalizing = false;
        windowEvents.visitFinalizing = false;
        setIsVisitFinalizing(false);
        if (!saved) {
          const freshAssetIdentifier = rotateTrialAssetIdentifier();
          if (freshAssetIdentifier) refreshAfterRecordingRotation((revision) => revision + 1);
        }
      }
    };
    windowEvents.finalizeVisit = finalizeVisit;
    const runCheckpoint = () => { checkpoint(); };

    if (initialCheckpointedAsset.current !== currentAssetIdentifier && !isEntireScreenTaskBlocked) {
      initialCheckpointedAsset.current = currentAssetIdentifier;
      runCheckpoint();
    }
    const interval = window.setInterval(runCheckpoint, 4000);
    window.addEventListener('pagehide', runCheckpoint);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('pagehide', runCheckpoint);
      if (windowEvents.finalizeVisit === finalizeVisit) windowEvents.finalizeVisit = undefined;
    };
  }, [assetIdentifier, assetSegments, componentConfig.recordAudio, componentConfig.recordScreen, componentConfig.recordWebcam, currentComponent, currentIdentifier, dispatch, getRecordingChunkKeys, getRecordingStopTime, getScreenRecordingStartTime, globalStoreEnabled, isAnalysis, isCompleted, isEntireScreenTaskBlocked, isScreenRecordingPermission, modes.dataCollectionEnabled, recordsAudio, recordsScreen, recordsWebcam, refreshAfterRecordingRotation, requireEntireScreen, rotateTrialAssetIdentifier, saveTrialAnswer, setAlertModal, stopScreenRecording, storageEngine, studyConfig.uiConfig.recordAudio, studyConfig.uiConfig.recordScreen, studyConfig.uiConfig.recordWebcam, windowEvents]);

  useEffect(() => {
    if (!storageEngine) {
      return undefined;
    }

    return storageEngine.subscribeToParticipantDataWriteErrors((error) => {
      console.error('Failed to save participant response data', error);
      dispatch(setAlertModal({
        show: true,
        message: 'Your response could not be saved because the connection to the server was interrupted. Please check your internet connection, then click Retry. You can continue once your response is fully saved.',
        title: 'Failed to Save Response',
      }));
    });
  }, [dispatch, setAlertModal, storageEngine]);

  // Attach event listeners
  useEffect(() => {
    if (!requireEntireScreen || !(recordsScreen || recordsAudio || recordsWebcam)) return undefined;

    const push = (event: EventType) => pushWindowEvent(windowEvents, event);
    const pointerOut = (event: PointerEvent) => {
      if (!event.relatedTarget) push([Date.now(), 'studyactivity', 'pointer-left']);
    };
    const pointerOver = (event: PointerEvent) => {
      if (!event.relatedTarget) push([Date.now(), 'studyactivity', 'pointer-entered']);
    };
    let pageLostFocus = false;
    const focus = () => {
      if (pageLostFocus && document.hasFocus()) {
        pageLostFocus = false;
        push([Date.now(), 'studyactivity', 'focus-regained']);
      }
    };
    const blur = () => {
      if (!document.hasFocus()) {
        pageLostFocus = true;
        push([Date.now(), 'studyactivity', 'focus-lost']);
      }
    };
    const visibility = () => push([Date.now(), 'studyactivity', document.visibilityState === 'hidden' ? 'hidden' : 'visible']);
    window.addEventListener('pointerout', pointerOut);
    window.addEventListener('pointerover', pointerOver);
    window.addEventListener('focus', focus);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);

    const displayStatus = getDisplayStatus();
    setMultipleDisplaysDetected(displayStatus === 'multiple');
    push([Date.now(), 'displaystatus', displayStatus]);

    return () => {
      window.removeEventListener('pointerout', pointerOut);
      window.removeEventListener('pointerover', pointerOver);
      window.removeEventListener('focus', focus);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [currentComponent, currentIdentifier, recordsAudio, recordsScreen, recordsWebcam, requireEntireScreen]);

  useEffect(() => {
    // Focus
    const focusListener = debounce((e: FocusEvent) => {
      pushWindowEvent(windowEvents, [Date.now(), 'focus', e.target instanceof HTMLElement ? e.target.tagName : '']);
    }, windowEventDebounceTime, { maxWait: windowEventDebounceTime });

    // Inputs
    const inputListener = debounce((e: InputEvent) => {
      pushWindowEvent(windowEvents, [Date.now(), 'input', e.data ?? '']);
    }, windowEventDebounceTime, { maxWait: windowEventDebounceTime });

    // Keyboard
    const keydownListener = debounce((e: KeyboardEvent) => {
      pushWindowEvent(windowEvents, [Date.now(), 'keydown', e.key]);
    }, windowEventDebounceTime, { maxWait: windowEventDebounceTime });
    const keyupListener = debounce((e: KeyboardEvent) => {
      pushWindowEvent(windowEvents, [Date.now(), 'keyup', e.key]);
    }, windowEventDebounceTime, { maxWait: windowEventDebounceTime });

    // Mouse/Pointer/Touch
    const mouseDownListener = debounce((e: MouseEvent) => {
      pushWindowEvent(windowEvents, [Date.now(), 'mousedown', [e.clientX, e.clientY]]);
    }, windowEventDebounceTime, { maxWait: windowEventDebounceTime });

    const mouseUpListener = debounce((e: MouseEvent) => {
      pushWindowEvent(windowEvents, [Date.now(), 'mouseup', [e.clientX, e.clientY]]);
    }, windowEventDebounceTime, { maxWait: windowEventDebounceTime });

    // Window resizing
    const resizeListener = debounce(() => {
      pushWindowEvent(windowEvents, [Date.now(), 'resize', [window.innerWidth, window.innerHeight]]);
    }, windowEventDebounceTime, { maxWait: windowEventDebounceTime });

    // Mouse movement
    const mouseMoveListener = debounce((e: MouseEvent) => {
      pushWindowEvent(windowEvents, [Date.now(), 'mousemove', [e.clientX, e.clientY]]);
    }, windowEventDebounceTime, { maxWait: windowEventDebounceTime });

    // Scroll
    const scrollListener = debounce(() => {
      pushWindowEvent(windowEvents, [Date.now(), 'scroll', [window.scrollX, window.scrollY]]);
    }, windowEventDebounceTime, { maxWait: windowEventDebounceTime });

    // Visibility change
    const visibilityListener = debounce(() => {
      pushWindowEvent(windowEvents, [Date.now(), 'visibility', document.visibilityState]);
    }, windowEventDebounceTime, { maxWait: windowEventDebounceTime });
    const debouncedListeners = [
      focusListener,
      inputListener,
      keydownListener,
      keyupListener,
      mouseDownListener,
      mouseUpListener,
      resizeListener,
      mouseMoveListener,
      scrollListener,
      visibilityListener,
    ];
    flushDebouncedEvents.current = debouncedListeners.map((listener) => () => { listener.flush(); });

    window.addEventListener('focus', focusListener, true);
    window.addEventListener('input', inputListener as () => void);
    // Record shortcuts even when response controls stop propagation.
    window.addEventListener('keydown', keydownListener, true);
    window.addEventListener('keyup', keyupListener);
    window.addEventListener('mousedown', mouseDownListener);
    window.addEventListener('mouseup', mouseUpListener);
    window.addEventListener('resize', resizeListener);
    window.addEventListener('mousemove', mouseMoveListener);
    window.addEventListener('scroll', scrollListener);
    document.addEventListener('visibilitychange', visibilityListener);

    return () => {
      debouncedListeners.forEach((listener) => listener.cancel());
      flushDebouncedEvents.current = [];
      window.removeEventListener('focus', focusListener, true);
      window.removeEventListener('input', inputListener as () => void);
      window.removeEventListener('keydown', keydownListener, true);
      window.removeEventListener('keyup', keyupListener);
      window.removeEventListener('mousedown', mouseDownListener);
      window.removeEventListener('mouseup', mouseUpListener);
      window.removeEventListener('resize', resizeListener);
      window.removeEventListener('mousemove', mouseMoveListener);
      window.removeEventListener('scroll', scrollListener);
      document.removeEventListener('visibilitychange', visibilityListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the last axis sample in each interval, including when the stick returns
  // to rest. Flush it before saving the step so it belongs to the right trial.
  const pendingAxis = useRef<Extract<EventType, [number, 'gamepadaxis', number[]]> | null>(null);
  const lastRecordedAxes = useRef<number[]>([]);
  const axisTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordAxis = useCallback((event: Extract<EventType, [number, 'gamepadaxis', number[]]>) => {
    pushWindowEvent(windowEvents, event);
    lastRecordedAxes.current = event[2];
  }, [windowEvents]);
  const flushPendingAxis = useCallback(() => {
    if (axisTimer.current !== null) {
      clearTimeout(axisTimer.current);
      axisTimer.current = null;
    }
    if (pendingAxis.current) {
      recordAxis(pendingAxis.current);
      pendingAxis.current = null;
    }
  }, [recordAxis]);
  useEffect(() => {
    windowEvents.flushPending = () => {
      flushDebouncedEvents.current.forEach((flush) => flush());
      flushPendingAxis();
    };
    return () => {
      windowEvents.flushPending = undefined;
      if (axisTimer.current !== null) clearTimeout(axisTimer.current);
    };
  }, [flushPendingAxis, windowEvents]);
  useGamepad({
    onConnectionChange: (device, timestamp) => {
      pushWindowEvent(windowEvents, [timestamp, 'gamepadconnection', device ? `connected:${device.id}:${device.mapping || 'nonstandard'}` : 'disconnected']);
    },
    onButtonDown: (button, index, timestamp) => {
      pushWindowEvent(windowEvents, [timestamp, 'gamepadbuttondown', button]);
    },
    onButtonUp: (button, index, timestamp) => {
      pushWindowEvent(windowEvents, [timestamp, 'gamepadbuttonup', button]);
    },
    onAxes: (axes, timestamp) => {
      const event: Extract<EventType, [number, 'gamepadaxis', number[]]> = [timestamp, 'gamepadaxis', axes.map((value) => Math.round(value * 1000) / 1000)];
      if (axisTimer.current === null) {
        recordAxis(event);
        axisTimer.current = setTimeout(flushPendingAxis, windowEventDebounceTime);
      } else {
        const pending = pendingAxis.current;
        if (pending) {
          const distance = (values: number[]) => Math.hypot(...values.map((value, index) => value - (lastRecordedAxes.current[index] ?? 0)));
          if (distance(event[2]) < distance(pending[2])) recordAxis(pending);
        }
        pendingAxis.current = event;
      }
    },
    enabled: captureGamepad,
  });

  const { developmentModeEnabled, dataCollectionEnabled } = useMemo(() => modes, [modes]);

  // No default value for withSidebar since it's a required field in uiConfig
  const sidebarOpen = useMemo(() => ((((analysisHasScreenRecording || analysisHasWebcamRecording) && analysisCanPlayScreenRecording) || currentComponent === 'end' || (isCompleted && !isAnalysis)) ? false : (componentConfig.withSidebar ?? studyConfig.uiConfig.withSidebar)), [analysisHasScreenRecording, analysisHasWebcamRecording, analysisCanPlayScreenRecording, currentComponent, componentConfig.withSidebar, studyConfig.uiConfig.withSidebar, isCompleted, isAnalysis]);
  const sidebarWidth = useMemo(() => componentConfig?.sidebarWidth ?? studyConfig.uiConfig.sidebarWidth ?? 300, [componentConfig, studyConfig]);
  const showTitleBar = useMemo(() => componentConfig.showTitleBar ?? studyConfig.uiConfig.showTitleBar ?? true, [componentConfig, studyConfig]);

  const asideOpen = useMemo(() => developmentModeEnabled && showStudyBrowser, [developmentModeEnabled, showStudyBrowser]);
  const rowMaxWidth = useMemo(() => (asideOpen ? `max(0px, calc(100% - ${STUDY_BROWSER_WIDTH}px))` : '100%'), [asideOpen]);
  const shouldConfirmClose = useMemo(
    () => shouldConfirmTabClose(
      isAnalysis,
      currentComponent,
      developmentModeEnabled,
      isCompleted,
      dataCollectionEnabled,
      isSubmittingFinal,
    ),
    [isAnalysis, currentComponent, developmentModeEnabled, isCompleted, dataCollectionEnabled, isSubmittingFinal],
  );

  const [hasAudio, setHasAudio] = useState<boolean>();
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const exportInProgressRef = useRef(false);
  const pdfExportRootRef = useRef<HTMLDivElement>(null);

  const exportCurrentComponent = useCallback(async () => {
    if (exportInProgressRef.current) {
      return;
    }

    const exportRoot = pdfExportRootRef.current;
    if (!exportRoot) {
      showNotification({
        title: 'PDF export failed',
        message: 'The current study page is not available to export.',
        color: 'red',
      });
      return;
    }

    const unsupportedReason = getPdfExportUnsupportedReason(exportRoot);
    if (unsupportedReason) {
      showNotification({
        title: 'PDF export unavailable',
        message: unsupportedReason,
        color: 'red',
      });
      return;
    }

    exportInProgressRef.current = true;
    setIsExportingPdf(true);
    const notificationId = showNotification({
      title: 'Preparing PDF',
      message: 'Your download will begin when the PDF is ready.',
      animated: false,
      autoClose: false,
    });
    const wasInert = exportRoot.inert === true;
    const previousAriaBusy = exportRoot.getAttribute('aria-busy');
    exportRoot.inert = true;
    exportRoot.setAttribute('aria-busy', 'true');

    try {
      await waitForNextPaint();
      await saveElementAsPdf(exportRoot, buildPdfFilename(currentComponent));
      hideNotification(notificationId);
      showNotification({
        title: 'PDF exported',
        message: 'The current study page was downloaded.',
        color: 'green',
      });
    } catch (error) {
      console.error('Failed to export study page as PDF', error);
      hideNotification(notificationId);
      showNotification({
        title: 'PDF export failed',
        message: 'The current study page could not be exported. Please try again.',
        color: 'red',
      });
    } finally {
      exportRoot.inert = wasInert;
      if (previousAriaBusy === null) {
        exportRoot.removeAttribute('aria-busy');
      } else {
        exportRoot.setAttribute('aria-busy', previousAriaBusy);
      }
      exportInProgressRef.current = false;
      setIsExportingPdf(false);
    }
  }, [currentComponent]);

  useEffect(() => {
    if (!shouldConfirmClose) {
      return undefined;
    }

    const beforeUnloadListener = (event: BeforeUnloadEvent) => {
      handleBeforeUnload(event);
    };

    window.addEventListener('beforeunload', beforeUnloadListener);
    return () => {
      window.removeEventListener('beforeunload', beforeUnloadListener);
    };
  }, [shouldConfirmClose]);

  return (
    <WindowEventsContext.Provider value={windowEvents}>
      <RecordingContext.Provider value={screenRecording}>
        <ReplayContext.Provider value={replay}>
          <AppShell
            padding="md"
            header={{ height: showTitleBar ? 70 : 0 }}
            aside={{ width: STUDY_BROWSER_WIDTH, breakpoint: 'xs', collapsed: { desktop: !asideOpen, mobile: !asideOpen } }}
            footer={{ height: isAnalysis ? 125 + (hasAudio ? 55 : 0) : 0 }}
            style={{ '--app-shell-aside-offset': '0rem' } as CSSProperties}
          >
            {showTitleBar && (
            <AppHeader
              developmentModeEnabled={developmentModeEnabled}
              dataCollectionEnabled={dataCollectionEnabled}
              isExportingPdf={isExportingPdf}
              onExportPdf={exportCurrentComponent}
            />
            )}
            {!showTitleBar && (
              <Menu position="bottom-end" withinPortal>
                <Menu.Target>
                  <ActionIcon
                    data-html2canvas-ignore
                    aria-label="Study actions"
                    size="lg"
                    variant="subtle"
                    color="gray"
                    style={{
                      position: 'fixed', right: 10, top: 10, zIndex: 100,
                    }}
                  >
                    <IconDotsVertical />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <PdfExportMenuItem
                    isExportingPdf={isExportingPdf}
                    onExportPdf={exportCurrentComponent}
                  />
                </Menu.Dropdown>
              </Menu>
            )}
            <DeviceWarning developmentModeEnabled={developmentModeEnabled} />
            {isScreenRecordingUserRejected && <ScreenRecordingRejection saving={isEntireScreenVisitInterrupted && !interruptionSaved} />}
            <HelpModal />
            <AlertModal />
            <ConfigVersionWarningModal />
            <Flex
              ref={pdfExportRootRef}
              data-pdf-export-root
              direction="row"
              gap="xs"
              style={{
                alignItems: 'stretch', width: '100%', maxWidth: rowMaxWidth,
              }}
            >
              <header
                data-pdf-export-header
                style={{
                  alignItems: 'center',
                  borderBottom: '1px solid var(--mantine-color-default-border)',
                  display: 'none',
                  gap: 12,
                  marginBottom: 20,
                  paddingBottom: 16,
                  width: '100%',
                }}
              >
                {studyConfig.uiConfig.logoPath && (
                  <img
                    alt="Study logo"
                    src={getStudyLogoUrl(studyConfig.uiConfig.logoPath, studyColorMode)}
                    style={{ height: 40, maxWidth: 120, objectFit: 'contain' }}
                  />
                )}
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>
                    {studyConfig.studyMetadata.title}
                  </div>
                  <div style={{ color: 'var(--mantine-color-dimmed)', fontSize: 12 }}>
                    {currentComponent}
                  </div>
                </div>
              </header>
              <TrialProvenanceBoundary>
                {!startupInteractionBlocked && !isEntireScreenTaskBlocked && (
                <AppNavBar
                  width={sidebarWidth}
                  top={showTitleBar ? 70 : 0}
                  bottom={isAnalysis ? 125 + (hasAudio ? 55 : 0) : 0}
                  sidebarOpen={sidebarOpen}
                  inert={isVisitFinalizing}
                />
                )}
                {/* 10px is the gap between the sidebar and the main content */}
                <AppShell.Main
                  className="main"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                  w={sidebarOpen ? `calc(100% - ${sidebarWidth}px - 10px)` : '100%'}
                >
                  {!showTitleBar && !showStudyBrowser && developmentModeEnabled && (
                  <Button
                    data-html2canvas-ignore
                    variant="subtle"
                    leftSection={<IconArrowLeft size={14} />}
                    onClick={() => dispatch(toggleStudyBrowser())}
                    size="xs"
                    style={{ position: 'fixed', top: '10px', right: '50px' }}
                  >
                    Study Browser
                  </Button>
                  )}
                  <div
                    className="study-content"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      flexGrow: 1,
                      minWidth: 0,
                    }}
                    inert={isVisitFinalizing}
                    aria-busy={isVisitFinalizing}
                  >
                    {!startupInteractionBlocked && isAnalysis && <GlobalStoreHistory />}
                    {!startupInteractionBlocked && requireEntireScreen && multipleDisplaysDetected && !isAnalysis && (
                      <Text c="orange" role="status" ta="center" p="xs">
                        Multiple displays detected. Disconnect extra displays for the most reliable screen recording.
                      </Text>
                    )}
                    {!startupInteractionBlocked && (isEntireScreenTaskBlocked
                      ? (
                        <Flex direction="column" align="center" justify="center" gap="sm" p="xl" role="alert">
                          <Text>This recorded task is locked until you share an entire monitor.</Text>
                          <Button onClick={screenRecording.startScreenCapture}>Share entire monitor</Button>
                          {screenRecording.screenCaptureVerificationError && <Text c="red">{screenRecording.screenCaptureVerificationError}</Text>}
                          {screenRecording.screenRecordingError && <Text c="red">{screenRecording.screenRecordingError}</Text>}
                        </Flex>
                      ) : (
                        <Outlet />
                      ))}
                  </div>
                </AppShell.Main>
              </TrialProvenanceBoundary>
            </Flex>
            {asideOpen && <AppAside />}
            {!startupInteractionBlocked && isAnalysis && (
            <AnalysisFooter setHasAudio={setHasAudio} key={currentComponent} />
            )}
          </AppShell>
        </ReplayContext.Provider>
      </RecordingContext.Provider>
    </WindowEventsContext.Provider>
  );
}
