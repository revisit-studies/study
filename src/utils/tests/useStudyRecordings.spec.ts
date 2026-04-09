import { renderHook, waitFor } from '@testing-library/react';
import {
  afterEach, describe, expect, test, vi,
} from 'vitest';

import type { StudyConfig } from '../../parser/types';
import { useStudyRecordings } from '../useStudyRecordings';

vi.mock('../handleComponentInheritance', () => ({
  studyComponentToIndividualComponent: vi.fn((comp: Record<string, boolean>) => comp),
}));

afterEach(() => vi.restoreAllMocks());

const makeStudyConfig = (
  uiOverrides: Record<string, boolean> = {},
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
    recordAudio: false,
    recordScreen: false,
    ...uiOverrides,
  },
  components: components as StudyConfig['components'],
});

describe('useStudyRecordings', () => {
  test('both flags are false when studyConfig is undefined', async () => {
    const { result } = renderHook(() => useStudyRecordings(undefined));
    await waitFor(() => {
      expect(result.current.hasAudioRecording).toBe(false);
      expect(result.current.hasScreenRecording).toBe(false);
    });
  });

  test('hasScreenRecording is true when uiConfig.recordScreen is true', async () => {
    const config = makeStudyConfig({ recordScreen: true });
    const { result } = renderHook(() => useStudyRecordings(config));
    await waitFor(() => expect(result.current.hasScreenRecording).toBe(true));
    expect(result.current.hasAudioRecording).toBe(false);
  });

  test('hasAudioRecording is true when uiConfig.recordAudio is true', async () => {
    const config = makeStudyConfig({ recordAudio: true });
    const { result } = renderHook(() => useStudyRecordings(config));
    await waitFor(() => expect(result.current.hasAudioRecording).toBe(true));
  });

  test('hasScreenRecording is true when a component has recordScreen', async () => {
    const config = makeStudyConfig({}, { trial1: { recordScreen: true } });
    const { result } = renderHook(() => useStudyRecordings(config));
    await waitFor(() => expect(result.current.hasScreenRecording).toBe(true));
  });

  test('both flags are false when config has no recording options', async () => {
    const config = makeStudyConfig({}, { trial1: { recordScreen: false } });
    const { result } = renderHook(() => useStudyRecordings(config));
    await waitFor(() => {
      expect(result.current.hasScreenRecording).toBe(false);
      expect(result.current.hasAudioRecording).toBe(false);
    });
  });
});
