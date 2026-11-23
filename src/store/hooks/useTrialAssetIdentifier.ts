import { useCallback, useContext } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useCurrentIdentifier, useStudyId } from '../../routes/utils';
import { StudyStoreContext, useStoreSelector } from '../store';
import { useStudyConfig } from './useStudyConfig';
import { useGlobalStoreSavePending } from './useGlobalStoreSavePending';

/** Each recorded entry has its own asset key; accepted provenance retains the reference. */
export function useTrialAssetIdentifier() {
  const identifier = useCurrentIdentifier();
  const studyId = useStudyId();
  const context = useContext(StudyStoreContext);
  const studyConfig = useStudyConfig();
  const persistedAnswer = useStoreSelector((state) => state.answers?.[identifier]);
  const participantId = useStoreSelector((state) => state.participantId);
  const globalStoreEnabled = studyConfig.globalVariables !== undefined;
  const retainScreenSegments = studyConfig.uiConfig?.requireEntireScreen ?? false;
  const savePending = useGlobalStoreSavePending();
  if (!globalStoreEnabled && !retainScreenSegments) return identifier;
  // Recorder and submitter share one visit key, including through acceptance and delayed mounts.
  if (context.trialAssetEntry?.identifier === identifier && context.trialAssetEntry.studyId === studyId) return context.trialAssetEntry.key;
  if (globalStoreEnabled && savePending) {
    context.trialAssetEntry = undefined;
    return undefined;
  }
  const keyType = globalStoreEnabled ? 'global' : 'screen';
  const checkpointKey = retainScreenSegments && typeof window !== 'undefined'
    ? `revisit-recording-asset:${studyId}:${participantId ?? 'anonymous'}:${identifier}`
    : undefined;
  let checkpoint: { key: string; segments?: string[] } | null = null;
  if (checkpointKey) {
    try {
      const value = window.sessionStorage.getItem(checkpointKey);
      checkpoint = value ? JSON.parse(value) as { key: string; segments?: string[] } : null;
    } catch {
      // Continue with a fresh in-memory key if storage is unavailable.
    }
  }
  // A missing in-memory entry means this is a new recorder visit (including a
  // recreated study store); retain checkpointed segments but never reuse its key.
  const key = `${identifier}__${keyType}_${uuidv4()}`;
  const segments = retainScreenSegments
    ? Array.from(new Set([
      ...(persistedAnswer?.recordingSegments ?? []),
      ...(persistedAnswer?.assetIdentifier ? [persistedAnswer.assetIdentifier] : []),
      ...(checkpoint?.segments ?? []),
      ...(checkpoint?.key ? [checkpoint.key] : []),
      key,
    ]))
    : [key];
  if (checkpointKey) {
    try {
      window.sessionStorage.setItem(checkpointKey, JSON.stringify({ key, segments }));
    } catch {
      // The participant answer checkpoint remains the durable fallback.
    }
  }
  context.trialAssetEntry = {
    identifier, studyId, key, segments,
  };
  return key;
}

/** Returns every retained capture segment for the current task visit. */
export function useTrialAssetSegments() {
  const key = useTrialAssetIdentifier();
  const context = useContext(StudyStoreContext);
  const entry = context.trialAssetEntry;
  if (!key) return [];
  return entry?.key === key ? entry.segments ?? [key] : [key];
}

/** Allocate a distinct asset key after a whole-screen capture is interrupted. */
export function useRotateTrialAssetIdentifier() {
  const identifier = useCurrentIdentifier();
  const studyId = useStudyId();
  const context = useContext(StudyStoreContext);
  const studyConfig = useStudyConfig();
  const participantId = useStoreSelector((state) => state.participantId);
  return useCallback(() => {
    const entry = context.trialAssetEntry;
    if (!studyConfig.uiConfig?.requireEntireScreen) return entry?.key;
    if (!entry || entry.identifier !== identifier || entry.studyId !== studyId) return undefined;
    const key = `${identifier}__screen_${uuidv4()}`;
    const segments = Array.from(new Set([...(entry.segments ?? [entry.key]), key]));
    context.trialAssetEntry = {
      identifier, studyId, key, segments,
    };
    try {
      window.sessionStorage.setItem(
        `revisit-recording-asset:${studyId}:${participantId ?? 'anonymous'}:${identifier}`,
        JSON.stringify({ key, segments }),
      );
    } catch {
      // The in-memory entry remains available for this page visit.
    }
    return key;
  }, [context, identifier, participantId, studyId, studyConfig.uiConfig?.requireEntireScreen]);
}
