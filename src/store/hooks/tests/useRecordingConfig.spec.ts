import { renderHook } from '@testing-library/react';
import {
  afterEach, describe, expect, test, vi,
} from 'vitest';

import { useStudyConfig } from '../useStudyConfig';
import { useFlatSequence } from '../../store';
import { useRecordingConfig } from '../useRecordingConfig';
import { makeStudyConfig } from '../../../tests/utils';

vi.mock('../useStudyConfig', () => ({
  useStudyConfig: vi.fn(() => ({
    uiConfig: { recordScreen: false, recordAudio: false, clickToRecord: false },
    components: {},
  })),
}));

vi.mock('../../store', () => ({
  useFlatSequence: vi.fn(() => []),
}));

vi.mock('../../../routes/utils', () => ({
  useCurrentComponent: vi.fn(() => 'trial1'),
}));

afterEach(() => vi.restoreAllMocks());

describe('useRecordingConfig', () => {
  test('returns all false when uiConfig has no recording options', () => {
    const { result } = renderHook(() => useRecordingConfig());
    expect(result.current.studyHasScreenRecording).toBe(false);
    expect(result.current.studyHasAudioRecording).toBe(false);
    expect(result.current.currentComponentHasScreenRecording).toBe(false);
    expect(result.current.currentComponentHasAudioRecording).toBe(false);
    expect(result.current.currentComponentHasClickToRecord).toBe(false);
  });

  test('studyHasScreenRecording is true when uiConfig.recordScreen is set', () => {
    vi.mocked(useStudyConfig).mockReturnValueOnce(makeStudyConfig({ uiConfig: { recordScreen: true } }));
    const { result } = renderHook(() => useRecordingConfig());
    expect(result.current.studyHasScreenRecording).toBe(true);
  });

  test('studyHasScreenRecording is true when a participant sequence component has recordScreen', () => {
    vi.mocked(useStudyConfig).mockReturnValueOnce(
      makeStudyConfig({ components: { trial1: { recordScreen: true } } }),
    );
    vi.mocked(useFlatSequence).mockReturnValueOnce(['trial1']);
    const { result } = renderHook(() => useRecordingConfig());
    expect(result.current.studyHasScreenRecording).toBe(true);
  });

  test('studyHasAudioRecording is true when uiConfig.recordAudio is set', () => {
    vi.mocked(useStudyConfig).mockReturnValueOnce(makeStudyConfig({ uiConfig: { recordAudio: true } }));
    const { result } = renderHook(() => useRecordingConfig());
    expect(result.current.studyHasAudioRecording).toBe(true);
  });
});
