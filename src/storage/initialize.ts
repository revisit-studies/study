import { LocalStorageEngine } from './engines/LocalStorageEngine';
import { FirebaseStorageEngine } from './engines/FirebaseStorageEngine';
import { SupabaseStorageEngine } from './engines/SupabaseStorageEngine';
import { StorageEngine } from './engines/types';
import { isCloudStorageEngine } from './engines/utils/storageEngineHelpers';

async function connectStorageEngine(storageEngine: StorageEngine, storageEngineName: string) {
  try {
    await storageEngine.connect();
  } catch (error) {
    console.warn(`Failed to connect to ${storageEngineName} storage engine`, error);
  }
}

export async function initializeStorageEngine() {
  let storageEngine: StorageEngine | undefined;
  let fallback = false;

  const storageEngineName: string = import.meta.env.VITE_STORAGE_ENGINE;

  if (storageEngineName === 'supabase') {
    const supabaseStorageEngine = new SupabaseStorageEngine();
    await connectStorageEngine(supabaseStorageEngine, storageEngineName);

    if (supabaseStorageEngine.isConnected()) {
      storageEngine = supabaseStorageEngine;
    } else if (import.meta.env.PROD) {
      storageEngine = supabaseStorageEngine;
    } else {
      fallback = true;
    }
  }

  if (storageEngineName === 'firebase') {
    const firebaseStorageEngine = new FirebaseStorageEngine();
    await connectStorageEngine(firebaseStorageEngine, storageEngineName);

    if (firebaseStorageEngine.isConnected()) {
      storageEngine = firebaseStorageEngine;
    } else if (import.meta.env.PROD) {
      storageEngine = firebaseStorageEngine;
    } else {
      fallback = true;
    }
  }

  if (storageEngineName === 'localStorage' || fallback) {
    const localStorageEngine = new LocalStorageEngine();
    await localStorageEngine.connect();

    storageEngine = localStorageEngine;
  }

  return storageEngine!;
}

async function hasInProgressSession(engine: StorageEngine, studyId: string) {
  const participantId = await engine.peekCurrentParticipantId(studyId);
  if (!participantId) return false;
  const assignments = await engine.getAllSequenceAssignments(studyId);
  const assignment = assignments.find((item) => item.participantId === participantId);
  return !assignment || assignment.completed === null;
}

export async function selectStudyStorageEngine(configured: StorageEngine, studyId: string, participantRoute: boolean) {
  if (!isCloudStorageEngine(configured)) return configured;

  const disconnected = await configured.getStorageDisconnected(studyId);
  if (!participantRoute && !disconnected) return configured;

  const local = new LocalStorageEngine();
  await local.connect();
  if (!participantRoute) return disconnected ? local : configured;

  const [cloudSession, localSession] = await Promise.all([
    hasInProgressSession(configured, studyId),
    hasInProgressSession(local, studyId),
  ]);
  const sessionKey = `revisit-storage-${studyId}`;
  const previousEngine = window.sessionStorage.getItem(sessionKey);
  const useLocal = cloudSession && localSession
    ? previousEngine === 'localStorage' || (previousEngine !== configured.getEngine() && disconnected)
    : localSession || (!cloudSession && disconnected);

  const active = useLocal ? local : configured;
  window.sessionStorage.setItem(sessionKey, active.getEngine());
  return active;
}
