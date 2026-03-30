import {
  describe,
  expect,
  test,
} from 'vitest';
import { getStudyEndFinalizeState } from './StudyEnd.utils';

describe('StudyEnd utils', () => {
  test('maps retry responses to a retryable loading state', () => {
    expect(getStudyEndFinalizeState({ status: 'retry' })).toEqual({
      completed: false,
      shouldRetry: true,
      error: null,
    });
  });

  test('maps complete responses to a completed state', () => {
    expect(getStudyEndFinalizeState({ status: 'complete' })).toEqual({
      completed: true,
      shouldRetry: false,
      error: null,
    });
  });

  test('maps error responses to a terminal error state', () => {
    expect(getStudyEndFinalizeState({ status: 'error', message: 'Upload failed' })).toEqual({
      completed: false,
      shouldRetry: false,
      error: 'Upload failed',
    });
  });
});
