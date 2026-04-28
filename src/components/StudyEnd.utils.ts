import { StorageEngine } from '../storage/engines/types';

export type StudyEndFinalizeLoopState = {
  error: string | null;
  failedAttemptCount: number;
  isRetryingAutomatically: boolean;
  manualRetryRequired: boolean;
  retryAllowed: boolean;
  retryDelayMs: number | null;
};

type StudyEndFinalizeLoopOptions = {
  getStorageEngine: () => StorageEngine | undefined;
  onComplete: () => void;
  onStateChange: (state: StudyEndFinalizeLoopState) => void;
  onUnexpectedError?: (error: unknown) => void;
  maxAutomaticRetryAttempts?: number;
  getRetryDelayMs?: (failedAttemptCount: number) => number;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
};

export const DEFAULT_STUDY_END_FINALIZE_STATE: StudyEndFinalizeLoopState = {
  error: null,
  failedAttemptCount: 0,
  isRetryingAutomatically: false,
  manualRetryRequired: false,
  retryAllowed: true,
  retryDelayMs: null,
};

const DEFAULT_FINALIZE_ERROR_MESSAGE = 'An error occurred while uploading your answers.';

export function getStudyEndRetryDelayMs(failedAttemptCount: number) {
  if (failedAttemptCount <= 1) {
    return 2000;
  }

  if (failedAttemptCount === 2) {
    return 5000;
  }

  return 10000;
}

export function createStudyEndFinalizeLoop({
  getStorageEngine,
  onComplete,
  onStateChange,
  onUnexpectedError,
  maxAutomaticRetryAttempts = 3,
  getRetryDelayMs = getStudyEndRetryDelayMs,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
}: StudyEndFinalizeLoopOptions) {
  let cancelled = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let finalizeRequestInFlight = false;
  let loopState = DEFAULT_STUDY_END_FINALIZE_STATE;
  let verifyLoop: () => Promise<void>;

  const emitState = (nextState: StudyEndFinalizeLoopState) => {
    loopState = nextState;
    onStateChange(nextState);
  };

  const emitAutomaticRetryState = (retryDelayMs: number) => {
    emitState({
      error: null,
      failedAttemptCount: 0,
      isRetryingAutomatically: true,
      manualRetryRequired: false,
      retryAllowed: true,
      retryDelayMs,
    });
  };

  const scheduleRetry = (retryDelayMs: number) => {
    if (cancelled || timeoutId) {
      return;
    }

    timeoutId = setTimeoutFn(() => {
      timeoutId = null;
      verifyLoop();
    }, retryDelayMs);
  };

  const handleRetryableFailure = (error: string | null) => {
    const failedAttemptCount = loopState.failedAttemptCount + 1;

    if (failedAttemptCount >= maxAutomaticRetryAttempts) {
      emitState({
        error,
        failedAttemptCount,
        isRetryingAutomatically: false,
        manualRetryRequired: true,
        retryAllowed: true,
        retryDelayMs: null,
      });
      return;
    }

    const retryDelayMs = getRetryDelayMs(failedAttemptCount);
    emitState({
      error,
      failedAttemptCount,
      isRetryingAutomatically: true,
      manualRetryRequired: false,
      retryAllowed: true,
      retryDelayMs,
    });

    scheduleRetry(retryDelayMs);
  };

  const handleTerminalFailure = (error: string | null) => {
    emitState({
      error,
      failedAttemptCount: 1,
      isRetryingAutomatically: false,
      manualRetryRequired: true,
      retryAllowed: false,
      retryDelayMs: null,
    });
  };

  const handleRetryablePendingState = () => {
    const retryDelayMs = getRetryDelayMs(1);
    emitAutomaticRetryState(retryDelayMs);
    scheduleRetry(retryDelayMs);
  };

  verifyLoop = async () => {
    if (cancelled || finalizeRequestInFlight) {
      return;
    }

    const storageEngine = getStorageEngine();
    if (!storageEngine) {
      scheduleRetry(getStudyEndRetryDelayMs(1));
      return;
    }

    finalizeRequestInFlight = true;
    try {
      const result = await storageEngine.finalizeParticipant();
      if (cancelled) {
        return;
      }

      if (result.status === 'complete') {
        emitState(DEFAULT_STUDY_END_FINALIZE_STATE);
        onComplete();
        return;
      }

      if (result.status === 'retry') {
        handleRetryablePendingState();
        return;
      }

      if (result.retryable === false) {
        handleTerminalFailure(result.message || DEFAULT_FINALIZE_ERROR_MESSAGE);
        return;
      }

      handleRetryableFailure(result.message || DEFAULT_FINALIZE_ERROR_MESSAGE);
    } catch (error) {
      if (cancelled) {
        return;
      }

      onUnexpectedError?.(error);
      handleRetryableFailure(DEFAULT_FINALIZE_ERROR_MESSAGE);
    } finally {
      finalizeRequestInFlight = false;
    }
  };

  return {
    start() {
      verifyLoop();
    },
    retryNow() {
      if (cancelled || finalizeRequestInFlight) {
        return;
      }

      if (timeoutId) {
        clearTimeoutFn(timeoutId);
        timeoutId = null;
      }

      emitState(DEFAULT_STUDY_END_FINALIZE_STATE);
      verifyLoop();
    },
    cancel() {
      cancelled = true;

      if (timeoutId) {
        clearTimeoutFn(timeoutId);
        timeoutId = null;
      }
    },
  };
}
