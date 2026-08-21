import { renderHook, waitFor } from '@testing-library/react';
import {
  afterEach, describe, expect, test, vi,
} from 'vitest';

import { useStudyRecordings } from '../useStudyRecordings';
import { makeStudyConfig } from '../../tests/utils';

vi.mock('../handleComponentInheritance', () => ({
  studyComponentToIndividualComponent: vi.fn((comp: Record<string, boolean>) => comp),
}));

afterEach(() => vi.restoreAllMocks());

describe('useStudyRecordings', () => {
  test('both flags are false when studyConfig is undefined', async () => {
    const { result } = renderHook(() => useStudyRecordings(undefined));
    await waitFor(() => {
      expect(result.current.hasAudioRecording).toBe(false);
      expect(result.current.hasScreenRecording).toBe(false);
    });
  });

  test('hasScreenRecording is true when uiConfig.recordScreen is true', async () => {
    const config = makeStudyConfig({ uiConfig: { recordScreen: true } });
    const { result } = renderHook(() => useStudyRecordings(config));
    await waitFor(() => expect(result.current.hasScreenRecording).toBe(true));
    expect(result.current.hasAudioRecording).toBe(false);
  });

  test('hasAudioRecording is true when uiConfig.recordAudio is true', async () => {
    const config = makeStudyConfig({ uiConfig: { recordAudio: true } });
    const { result } = renderHook(() => useStudyRecordings(config));
    await waitFor(() => expect(result.current.hasAudioRecording).toBe(true));
  });

  test('hasScreenRecording is true when a component has recordScreen', async () => {
    const config = makeStudyConfig({ components: { trial1: { recordScreen: true } } });
    const { result } = renderHook(() => useStudyRecordings(config));
    await waitFor(() => expect(result.current.hasScreenRecording).toBe(true));
  });

  test('both flags are false when config has no recording options', async () => {
    const config = makeStudyConfig({ components: { trial1: { recordScreen: false } } });
    const { result } = renderHook(() => useStudyRecordings(config));
    await waitFor(() => {
      expect(result.current.hasScreenRecording).toBe(false);
      expect(result.current.hasAudioRecording).toBe(false);
    });
  });
});
