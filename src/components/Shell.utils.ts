import type { StorageEngine } from '../storage/engines/types';
import type { AlertModalState } from '../store/types';

type StartupStorageStatus = Pick<StorageEngine, 'getEngine' | 'isConnected'>;

const GENERIC_STARTUP_ERROR = 'There was a problem loading the study.';
const RESUME_STARTUP_ERROR = 'This study session could not be resumed.';

export function getScreenOrientationType(screen: Screen) {
  return screen.orientation?.type ?? '';
}

export function isStorageStartupFailure(
  storageEngine: StartupStorageStatus,
  configuredEngine: string,
  storageOperationFailed: boolean = false,
) {
  if (!storageEngine.isConnected() || storageEngine.getEngine() !== configuredEngine) {
    return true;
  }

  return storageOperationFailed && configuredEngine !== 'localStorage';
}

export function getStartupErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  return GENERIC_STARTUP_ERROR;
}

export function getInitialStartupAlert(
  error: unknown,
  developmentModeEnabled: boolean,
  resumeParticipantId?: string | null,
): AlertModalState {
  return {
    show: true,
    title: 'Problem loading the study',
    message: developmentModeEnabled
      ? getStartupErrorMessage(error)
      : (resumeParticipantId ? RESUME_STARTUP_ERROR : GENERIC_STARTUP_ERROR),
  };
}
