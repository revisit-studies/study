import { describe, expect, test } from 'vitest';
import {
  getInitialStartupAlert,
  getScreenOrientationType,
  getStartupErrorMessage,
  isStorageStartupFailure,
} from './Shell.utils';

describe('Shell utilities', () => {
  test('returns an empty orientation when screen.orientation is unavailable', () => {
    const mockScreen = {
      orientation: undefined,
    } as unknown as Screen;

    expect(getScreenOrientationType(mockScreen)).toBe('');
  });

  test('detects storage startup failures from connectivity', () => {
    const mockStorageEngine = {
      getEngine: () => 'supabase' as const,
      isConnected: () => false,
    };

    expect(isStorageStartupFailure(mockStorageEngine, 'supabase')).toBe(true);
  });

  test('detects storage startup failures from engine mismatch', () => {
    const mockStorageEngine = {
      getEngine: () => 'localStorage' as const,
      isConnected: () => true,
    };

    expect(isStorageStartupFailure(mockStorageEngine, 'supabase')).toBe(true);
  });

  test('detects cloud storage startup failures from thrown storage operations', () => {
    const mockStorageEngine = {
      getEngine: () => 'supabase' as const,
      isConnected: () => true,
    };

    expect(isStorageStartupFailure(mockStorageEngine, 'supabase', true)).toBe(true);
  });

  test('does not treat local storage startup errors as connectivity failures', () => {
    const mockStorageEngine = {
      getEngine: () => 'localStorage' as const,
      isConnected: () => true,
    };

    expect(isStorageStartupFailure(mockStorageEngine, 'localStorage', true)).toBe(false);
  });

  test('uses the caught error message in development mode', () => {
    expect(getInitialStartupAlert(new Error('Bad startup state'), true, null)).toEqual({
      show: true,
      title: 'Problem loading the study',
      message: 'Bad startup state',
    });
  });

  test('uses resume copy outside development mode when resuming a participant', () => {
    expect(getInitialStartupAlert(new Error('ignored'), false, 'abc123')).toEqual({
      show: true,
      title: 'Problem loading the study',
      message: 'This study session could not be resumed.',
    });
  });

  test('falls back to the generic startup message for empty errors', () => {
    expect(getStartupErrorMessage('')).toBe('There was a problem loading the study.');
  });
});
