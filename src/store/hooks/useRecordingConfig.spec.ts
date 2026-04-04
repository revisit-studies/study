import { renderHook } from '@testing-library/react';
import {
  afterEach, describe, expect, test, vi,
} from 'vitest';

import type { StudyConfig } from '../../parser/types';
import { useStudyConfig } from './useStudyConfig';
import { useFlatSequence } from '../store';
import { useRecordingConfig } from './useRecordingConfig';

// Minimal StudyConfig factory — only the fields useRecordingConfig cares about
const makeConfig = (
  uiConfig: Partial<StudyConfig['uiConfig']> = {},
  components: Record<string, object> = {},
): StudyConfig => ({
  $schema: '',
  studyMetadata: {} as StudyConfig['studyMetadata'],
  sequence: { order: 'fixed', components: [] } as StudyConfig['sequence'],
  uiConfig: {
    logoPath: '',
    contactEmail: '',
    withProgressBar: false,
    withSidebar: false,
    ...uiConfig,
  },
  components: components as StudyConfig['components'],
});

vi.mock('./useStudyConfig', () => ({
  useStudyConfig: vi.fn(() => ({
    uiConfig: { recordScreen: false, recordAudio: false, clickToRecord: false },
    components: {},
  })),
}));

vi.mock('../store', () => ({
  useFlatSequence: vi.fn(() => []),
}));

vi.mock('../../routes/utils', () => ({
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
    vi.mocked(useStudyConfig).mockReturnValueOnce(makeConfig({ recordScreen: true }));
    const { result } = renderHook(() => useRecordingConfig());
    expect(result.current.studyHasScreenRecording).toBe(true);
  });

  test('studyHasScreenRecording is true when a participant sequence component has recordScreen', () => {
    vi.mocked(useStudyConfig).mockReturnValueOnce(
      makeConfig({}, { trial1: { recordScreen: true } }),
    );
    vi.mocked(useFlatSequence).mockReturnValueOnce(['trial1']);
    const { result } = renderHook(() => useRecordingConfig());
    expect(result.current.studyHasScreenRecording).toBe(true);
  });

  test('studyHasAudioRecording is true when uiConfig.recordAudio is set', () => {
    vi.mocked(useStudyConfig).mockReturnValueOnce(makeConfig({ recordAudio: true }));
    const { result } = renderHook(() => useRecordingConfig());
    expect(result.current.studyHasAudioRecording).toBe(true);
  });
});
