import { act, renderHook } from '@testing-library/react';
import {
  afterEach, describe, expect, test,
} from 'vitest';
import {
  isTabVisible, SHOW_TESTS_STORAGE_KEY, SHOW_TUTORIALS_STORAGE_KEY, useLandingPreferences,
} from '../landingPreferences';

afterEach(() => window.localStorage.clear());

describe('isTabVisible', () => {
  test.each([
    ['Tutorials', { showTutorials: false, showTests: true }, false],
    ['Tutorials', { showTutorials: true, showTests: false }, true],
    ['Tests', { showTutorials: true, showTests: false }, false],
    ['Tests', { showTutorials: false, showTests: true }, true],
    ['Snippets', { showTutorials: false, showTests: false }, true],
  ])('%s with %j is visible: %s', (label, preferences, expected) => {
    expect(isTabVisible(label, preferences)).toBe(expected);
  });
});

describe('useLandingPreferences', () => {
  test('defaults both preferences to off', () => {
    const { result } = renderHook(() => useLandingPreferences());
    expect(result.current.showTutorials).toBe(false);
    expect(result.current.showTests).toBe(false);
  });

  test('reads saved booleans and treats anything else as off', () => {
    window.localStorage.setItem(SHOW_TUTORIALS_STORAGE_KEY, 'true');
    window.localStorage.setItem(SHOW_TESTS_STORAGE_KEY, 'yes');
    const { result } = renderHook(() => useLandingPreferences());
    expect(result.current.showTutorials).toBe(true);
    expect(result.current.showTests).toBe(false);
  });

  test('saves changes and shares them with other hooks on the page', () => {
    const first = renderHook(() => useLandingPreferences());
    const second = renderHook(() => useLandingPreferences());

    act(() => first.result.current.setShowTests(true));

    expect(window.localStorage.getItem(SHOW_TESTS_STORAGE_KEY)).toBe('true');
    expect(second.result.current.showTests).toBe(true);
  });
});
