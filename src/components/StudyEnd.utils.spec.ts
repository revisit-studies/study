import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import { FinalizeParticipantResult, StorageEngine } from '../storage/engines/types';
import {
  createStudyEndFinalizeLoop,
  DEFAULT_STUDY_END_FINALIZE_STATE,
} from './StudyEnd.utils';

function createDeferred<T>() {
  let resolve!: (value: T) => void;

  return {
    promise: new Promise<T>((res) => {
      resolve = res;
    }),
    resolve,
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('StudyEnd utils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('exports the default finalize loop state', () => {
    expect(DEFAULT_STUDY_END_FINALIZE_STATE).toEqual({
      error: null,
      failedAttemptCount: 0,
      isRetryingAutomatically: false,
      manualRetryRequired: false,
      retryAllowed: true,
      retryDelayMs: null,
    });
  });

  test('retries after an error with backoff and without starting overlapping finalize requests', async () => {
    const firstAttempt = createDeferred<FinalizeParticipantResult>();
    const finalizeParticipant = vi.fn()
      .mockImplementationOnce(() => firstAttempt.promise)
      .mockResolvedValueOnce({ status: 'complete' });
    const onComplete = vi.fn();
    const onStateChange = vi.fn();

    const finalizeLoop = createStudyEndFinalizeLoop({
      getStorageEngine: () => ({ finalizeParticipant } as unknown as StorageEngine),
      onComplete,
      onStateChange,
    });

    finalizeLoop.start();
    await flushPromises();

    expect(finalizeParticipant).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10000);
    await flushPromises();

    expect(finalizeParticipant).toHaveBeenCalledTimes(1);

    firstAttempt.resolve({ status: 'error', message: 'Temporary failure' });
    await flushPromises();

    expect(onStateChange).toHaveBeenLastCalledWith({
      error: 'Temporary failure',
      failedAttemptCount: 1,
      isRetryingAutomatically: true,
      manualRetryRequired: false,
      retryAllowed: true,
      retryDelayMs: 2000,
    });
    expect(finalizeParticipant).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1999);
    await flushPromises();

    expect(finalizeParticipant).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    await flushPromises();

    expect(finalizeParticipant).toHaveBeenCalledTimes(2);
    expect(onStateChange).toHaveBeenLastCalledWith({
      error: null,
      failedAttemptCount: 0,
      isRetryingAutomatically: false,
      manualRetryRequired: false,
      retryAllowed: true,
      retryDelayMs: null,
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('stops automatic retries after the third failed attempt until retryNow is called', async () => {
    const finalizeParticipant = vi.fn()
      .mockResolvedValueOnce({ status: 'error', message: 'First failure' })
      .mockResolvedValueOnce({ status: 'error', message: 'Second failure' })
      .mockResolvedValueOnce({ status: 'error', message: 'Third failure' })
      .mockResolvedValueOnce({ status: 'complete' });
    const onComplete = vi.fn();
    const onStateChange = vi.fn();

    const finalizeLoop = createStudyEndFinalizeLoop({
      getStorageEngine: () => ({ finalizeParticipant } as unknown as StorageEngine),
      onComplete,
      onStateChange,
    });

    finalizeLoop.start();
    await flushPromises();

    expect(onStateChange).toHaveBeenLastCalledWith({
      error: 'First failure',
      failedAttemptCount: 1,
      isRetryingAutomatically: true,
      manualRetryRequired: false,
      retryAllowed: true,
      retryDelayMs: 2000,
    });

    vi.advanceTimersByTime(2000);
    await flushPromises();

    expect(onStateChange).toHaveBeenLastCalledWith({
      error: 'Second failure',
      failedAttemptCount: 2,
      isRetryingAutomatically: true,
      manualRetryRequired: false,
      retryAllowed: true,
      retryDelayMs: 5000,
    });

    vi.advanceTimersByTime(5000);
    await flushPromises();

    expect(onStateChange).toHaveBeenLastCalledWith({
      error: 'Third failure',
      failedAttemptCount: 3,
      isRetryingAutomatically: false,
      manualRetryRequired: true,
      retryAllowed: true,
      retryDelayMs: null,
    });
    expect(finalizeParticipant).toHaveBeenCalledTimes(3);

    vi.advanceTimersByTime(30000);
    await flushPromises();

    expect(finalizeParticipant).toHaveBeenCalledTimes(3);

    finalizeLoop.retryNow();
    await flushPromises();

    expect(finalizeParticipant).toHaveBeenCalledTimes(4);
    expect(onStateChange).toHaveBeenLastCalledWith({
      error: null,
      failedAttemptCount: 0,
      isRetryingAutomatically: false,
      manualRetryRequired: false,
      retryAllowed: true,
      retryDelayMs: null,
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('treats retry as a neutral syncing state without consuming the failure budget', async () => {
    const finalizeParticipant = vi.fn()
      .mockResolvedValueOnce({ status: 'retry' })
      .mockResolvedValueOnce({ status: 'retry' })
      .mockResolvedValueOnce({ status: 'retry' })
      .mockResolvedValueOnce({ status: 'complete' });
    const onComplete = vi.fn();
    const onStateChange = vi.fn();

    const finalizeLoop = createStudyEndFinalizeLoop({
      getStorageEngine: () => ({ finalizeParticipant } as unknown as StorageEngine),
      onComplete,
      onStateChange,
    });

    finalizeLoop.start();
    await flushPromises();

    expect(onStateChange).toHaveBeenLastCalledWith({
      error: null,
      failedAttemptCount: 0,
      isRetryingAutomatically: true,
      manualRetryRequired: false,
      retryAllowed: true,
      retryDelayMs: 2000,
    });

    vi.advanceTimersByTime(2000);
    await flushPromises();

    expect(finalizeParticipant).toHaveBeenCalledTimes(2);
    expect(onStateChange).toHaveBeenLastCalledWith({
      error: null,
      failedAttemptCount: 0,
      isRetryingAutomatically: true,
      manualRetryRequired: false,
      retryAllowed: true,
      retryDelayMs: 2000,
    });

    vi.advanceTimersByTime(2000);
    await flushPromises();

    expect(finalizeParticipant).toHaveBeenCalledTimes(3);
    expect(onStateChange).toHaveBeenLastCalledWith({
      error: null,
      failedAttemptCount: 0,
      isRetryingAutomatically: true,
      manualRetryRequired: false,
      retryAllowed: true,
      retryDelayMs: 2000,
    });

    vi.advanceTimersByTime(2000);
    await flushPromises();

    expect(finalizeParticipant).toHaveBeenCalledTimes(4);
    expect(onStateChange).toHaveBeenLastCalledWith({
      error: null,
      failedAttemptCount: 0,
      isRetryingAutomatically: false,
      manualRetryRequired: false,
      retryAllowed: true,
      retryDelayMs: null,
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('stops immediately on a non-retryable finalize error', async () => {
    const finalizeParticipant = vi.fn()
      .mockResolvedValueOnce({
        status: 'error',
        message: 'Recorded media upload failed',
        retryable: false,
      } satisfies FinalizeParticipantResult);
    const onComplete = vi.fn();
    const onStateChange = vi.fn();

    const finalizeLoop = createStudyEndFinalizeLoop({
      getStorageEngine: () => ({ finalizeParticipant } as unknown as StorageEngine),
      onComplete,
      onStateChange,
    });

    finalizeLoop.start();
    await flushPromises();

    expect(onStateChange).toHaveBeenLastCalledWith({
      error: 'Recorded media upload failed',
      failedAttemptCount: 1,
      isRetryingAutomatically: false,
      manualRetryRequired: true,
      retryAllowed: false,
      retryDelayMs: null,
    });

    vi.advanceTimersByTime(30000);
    await flushPromises();

    expect(finalizeParticipant).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
