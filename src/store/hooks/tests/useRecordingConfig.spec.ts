import { renderHook } from '@testing-library/react';
import {
  afterEach, describe, expect, test, vi,
} from 'vitest';

import { useStudyConfig } from '../useStudyConfig';
import { useRecordingConfig } from '../useRecordingConfig';
import { makeStudyConfig } from '../../../tests/utils';

const mockStoreState = vi.hoisted(() => ({
  sequence: {
    order: 'fixed' as const,
    orderPath: 'root',
    components: ['trial1'] as (string | { order: 'dynamic', id: string, components: [] })[],
    skip: [],
  },
  funcSequence: {} as Record<string, string[]>,
}));

vi.mock('../useStudyConfig', () => ({
  useStudyConfig: vi.fn(() => ({
    uiConfig: {
      recordScreen: false, recordAudio: false, recordWebcam: false, clickToRecord: false,
    },
    components: {},
  })),
}));

vi.mock('../../../routes/utils', () => ({
  useCurrentComponent: vi.fn(() => 'trial1'),
}));

vi.mock('../../store', () => ({
  useStoreSelector: (selector: (state: typeof mockStoreState) => unknown) => selector(mockStoreState),
}));

afterEach(() => {
  mockStoreState.sequence.components = ['trial1'];
  mockStoreState.funcSequence = {};
  vi.restoreAllMocks();
});

describe('useRecordingConfig', () => {
  test('returns all false when uiConfig has no recording options', () => {
    const { result } = renderHook(() => useRecordingConfig());
    expect(result.current.studyHasScreenRecording).toBe(false);
    expect(result.current.studyHasAudioRecording).toBe(false);
    expect(result.current.studyHasWebcamRecording).toBe(false);
    expect(result.current.currentComponentHasScreenRecording).toBe(false);
    expect(result.current.currentComponentHasAudioRecording).toBe(false);
    expect(result.current.currentComponentHasWebcamRecording).toBe(false);
    expect(result.current.currentComponentHasClickToRecord).toBe(false);
  });

  test('studyHasScreenRecording is true when uiConfig.recordScreen is set', () => {
    vi.mocked(useStudyConfig).mockReturnValueOnce(makeStudyConfig({ uiConfig: { recordScreen: true } }));
    const { result } = renderHook(() => useRecordingConfig());
    expect(result.current.studyHasScreenRecording).toBe(true);
  });

  test('resolves recording options inherited by a component', () => {
    vi.mocked(useStudyConfig).mockReturnValueOnce(
      makeStudyConfig({
        uiConfig: { clickToRecord: true },
        baseComponents: { recorded: { recordScreen: true, recordWebcam: true } },
        components: { trial1: { baseComponent: 'recorded', clickToRecord: false } },
      }),
    );
    const { result } = renderHook(() => useRecordingConfig());
    expect(result.current.studyHasScreenRecording).toBe(true);
    expect(result.current.studyHasWebcamRecording).toBe(true);
    expect(result.current.currentComponentHasScreenRecording).toBe(true);
    expect(result.current.currentComponentHasWebcamRecording).toBe(true);
    expect(result.current.currentComponentHasClickToRecord).toBe(false);
  });

  test('studyHasAudioRecording is true when uiConfig.recordAudio is set', () => {
    vi.mocked(useStudyConfig).mockReturnValueOnce(makeStudyConfig({ uiConfig: { recordAudio: true } }));
    const { result } = renderHook(() => useRecordingConfig());
    expect(result.current.studyHasAudioRecording).toBe(true);
  });

  test('webcam recording can be enabled globally', () => {
    vi.mocked(useStudyConfig).mockReturnValueOnce(makeStudyConfig({ uiConfig: { recordWebcam: true } }));
    const { result } = renderHook(() => useRecordingConfig());
    expect(result.current.studyHasWebcamRecording).toBe(true);
    expect(result.current.currentComponentHasWebcamRecording).toBe(true);
  });

  test('finds recording options on components inside dynamic blocks', () => {
    mockStoreState.sequence.components = [{ order: 'dynamic', id: 'dynamicBlock', components: [] }];
    mockStoreState.funcSequence = { dynamicBlock: ['dynamicTrial'] };
    vi.mocked(useStudyConfig).mockReturnValueOnce(
      makeStudyConfig({ components: { dynamicTrial: { recordAudio: true } } }),
    );
    const { result } = renderHook(() => useRecordingConfig());
    expect(result.current.studyHasAudioRecording).toBe(true);
  });

  test('ignores recording options on components outside the assigned sequence', () => {
    mockStoreState.sequence.components = ['webcamTrial'];
    vi.mocked(useStudyConfig).mockReturnValueOnce(
      makeStudyConfig({
        components: {
          webcamTrial: { recordWebcam: true },
          screenTrial: { recordScreen: true },
        },
        sequence: {
          order: 'fixed', orderPath: 'root', components: ['webcamTrial'], skip: [],
        },
      }),
    );
    const { result } = renderHook(() => useRecordingConfig());
    expect(result.current.studyHasWebcamRecording).toBe(true);
    expect(result.current.studyHasScreenRecording).toBe(false);
  });
});
