import { FinalizeParticipantResult } from '../storage/engines/types';

export function getStudyEndFinalizeState(result: FinalizeParticipantResult) {
  if (result.status === 'complete') {
    return {
      completed: true,
      shouldRetry: false,
      error: null,
    };
  }

  if (result.status === 'error') {
    return {
      completed: false,
      shouldRetry: false,
      error: result.message || 'An error occurred while uploading your answers.',
    };
  }

  return {
    completed: false,
    shouldRetry: true,
    error: null,
  };
}
