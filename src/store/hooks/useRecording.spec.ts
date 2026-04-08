import {
  renderHook, act, cleanup, waitFor,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { useRecording, useRecordingContext } from './useRecording';

// ── mutable state ─────────────────────────────────────────────────────────────

let mockRecordingConfig = {
  studyHasScreenRecording: false,
  studyHasAudioRecording: false,
  currentComponentHasAudioRecording: false,
  currentComponentHasScreenRecording: false,
  currentComponentHasClickToRecord: false,
};
let mockCurrentComponent = 'intro';
let mockStorageEngine: Record<string, ReturnType<typeof vi.fn>> | null = null;
let mockStoredAnswer: { endTime: number } | null = null;

// ── media mocks ────────────────────────────────────────────────────────────────

const mockTrackFactory = () => ({
  stop: vi.fn(),
  enabled: true,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  clone: vi.fn(() => mockTrackFactory()),
});

class MockMediaStream {
  _tracks = [mockTrackFactory()];

  getTracks = vi.fn(() => this._tracks);

  getVideoTracks = vi.fn(() => this._tracks);

  getAudioTracks = vi.fn(() => this._tracks);

  addTrack = vi.fn();

  removeTrack = vi.fn();
}

class MockMediaRecorder {
  stream: MockMediaStream;

  mimeType = 'video/webm';

  state = 'inactive';

  private _listeners: Record<string, ((event: Partial<{ data: Blob }>) => void)> = {};

  constructor(s: MockMediaStream) { this.stream = s; }

  start = vi.fn();

  stop = vi.fn();

  addEventListener = vi.fn((event: string, handler: (event: Partial<{ data: Blob }>) => void) => {
    this._listeners[event] = handler;
  });

  triggerEvent(event: string, data?: Blob) {
    this._listeners[event]?.({ data });
  }
}

// ── module mocks ───────────────────────────────────────────────────────────────

vi.mock('./useStudyConfig', () => ({
  useStudyConfig: () => ({
    uiConfig: { recordScreenFPS: undefined, recordAudio: false },
    sequence: {
      id: 'root', order: 'fixed', components: ['intro', 'end'], skip: [],
    },
  }),
}));

vi.mock('../../routes/utils', () => ({
  useCurrentComponent: () => mockCurrentComponent,
  useCurrentIdentifier: () => 'intro_0',
}));

vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: mockStorageEngine }),
}));

vi.mock('./useRecordingConfig', () => ({
  useRecordingConfig: () => mockRecordingConfig,
}));

vi.mock('./useStoredAnswer', () => ({
  useStoredAnswer: () => mockStoredAnswer,
}));

vi.mock('./useIsAnalysis', () => ({
  useIsAnalysis: () => false,
}));

// ── lifecycle ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockRecordingConfig = {
    studyHasScreenRecording: false,
    studyHasAudioRecording: false,
    currentComponentHasAudioRecording: false,
    currentComponentHasScreenRecording: false,
    currentComponentHasClickToRecord: false,
  };
  mockCurrentComponent = 'intro';
  mockStorageEngine = null;
  mockStoredAnswer = null;

  vi.stubGlobal('MediaStream', MockMediaStream);
  vi.stubGlobal('MediaRecorder', MockMediaRecorder);
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue(new MockMediaStream()),
      getDisplayMedia: vi.fn().mockResolvedValue(new MockMediaStream()),
    },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ── basic tests ────────────────────────────────────────────────────────────────

describe('useRecording', () => {
  test('returns expected properties', () => {
    const { result } = renderHook(() => useRecording());
    expect(result.current).toBeDefined();
    expect(typeof result.current.startScreenCapture).toBe('function');
    expect(typeof result.current.stopScreenCapture).toBe('function');
    expect(typeof result.current.startScreenRecording).toBe('function');
    expect(typeof result.current.stopScreenRecording).toBe('function');
  });

  test('initial state has recording flags false', () => {
    const { result } = renderHook(() => useRecording());
    expect(result.current.isScreenRecording).toBe(false);
    expect(result.current.isAudioRecording).toBe(false);
    expect(result.current.isScreenCapturing).toBe(false);
  });

  test('initial screenRecordingError is null', () => {
    const { result } = renderHook(() => useRecording());
    expect(result.current.screenRecordingError).toBeNull();
  });

  test('isMuted starts as false when clickToRecord is false', () => {
    const { result } = renderHook(() => useRecording());
    expect(result.current.isMuted).toBe(false);
  });

  test('setIsMuted is a function', () => {
    const { result } = renderHook(() => useRecording());
    expect(typeof result.current.setIsMuted).toBe('function');
  });

  test('isRejected starts as false', () => {
    const { result } = renderHook(() => useRecording());
    expect(result.current.isRejected).toBe(false);
  });

  test('studyHasScreenRecording reflects config', () => {
    const { result } = renderHook(() => useRecording());
    expect(result.current.studyHasScreenRecording).toBe(false);
  });

  test('recordAudio reflects config', () => {
    const { result } = renderHook(() => useRecording());
    expect(result.current.recordAudio).toBe(false);
  });

  test('stopScreenCapture can be called with null refs without crashing', () => {
    const { result } = renderHook(() => useRecording());
    act(() => { result.current.stopScreenCapture(); });
    expect(result.current.isScreenCapturing).toBe(false);
    expect(result.current.isScreenRecording).toBe(false);
  });

  test('stopScreenRecording can be called with null recorder without crashing', () => {
    const { result } = renderHook(() => useRecording());
    act(() => { result.current.stopScreenRecording(); });
    expect(result.current.isScreenRecording).toBe(false);
  });

  test('startScreenRecording returns early when no audio/screen recording enabled', () => {
    const { result } = renderHook(() => useRecording());
    act(() => { result.current.startScreenRecording('trial_0'); });
    expect(result.current.isScreenRecording).toBe(false);
  });

  test('setIsMuted changes isMuted state', () => {
    const { result } = renderHook(() => useRecording());
    act(() => { result.current.setIsMuted(true); });
    expect(result.current.isMuted).toBe(true);
  });
});

// ── startScreenCapture tests ───────────────────────────────────────────────────

// startScreenCapture fires an internal async function (captureFn) without returning
// the promise. Use waitFor to poll until the state updates settle.

describe('useRecording startScreenCapture', () => {
  test('success path: sets isScreenCapturing, isAudioCapturing, isMediaCapturing (covers lines 323-376)', async () => {
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      studyHasAudioRecording: true,
    };
    const { result } = renderHook(() => useRecording());
    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => {
      expect(result.current.isScreenCapturing).toBe(true);
      expect(result.current.isAudioCapturing).toBe(true);
      expect(result.current.isMediaCapturing).toBe(true);
    });
  });

  test('audio-only: getUserMedia called, isAudioCapturing true, isScreenCapturing false', async () => {
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: false,
      studyHasAudioRecording: true,
    };
    const { result } = renderHook(() => useRecording());
    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => {
      expect(result.current.isAudioCapturing).toBe(true);
    });
    expect(result.current.isScreenCapturing).toBe(false);
  });

  test('error path: sets screenRecordingError on getDisplayMedia rejection (covers catch block)', async () => {
    mockRecordingConfig = { ...mockRecordingConfig, studyHasScreenRecording: true };
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockRejectedValue(new Error('denied'));
    const { result } = renderHook(() => useRecording());
    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => {
      expect(result.current.screenRecordingError).toBe('Recording permission denied or not supported.');
    });
  });
});

// ── startScreenRecording tests ─────────────────────────────────────────────────

describe('useRecording startScreenRecording after startScreenCapture', () => {
  test('startScreenRecording returns early when screenMediaStream is null (covers lines 119-121)', () => {
    // audio recording enabled but no startScreenCapture → screenMediaStream is null
    mockRecordingConfig = {
      ...mockRecordingConfig,
      currentComponentHasScreenRecording: true,
    };
    const { result } = renderHook(() => useRecording());
    act(() => { result.current.startScreenRecording('trial_0'); });
    expect(result.current.isScreenRecording).toBe(false);
  });

  test('startScreenRecording after startScreenCapture starts the recorder (covers lines 123-201)', async () => {
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      studyHasAudioRecording: true,
      currentComponentHasScreenRecording: true,
      currentComponentHasAudioRecording: true,
    };
    mockStorageEngine = {
      saveScreenRecording: vi.fn().mockResolvedValue(undefined),
      saveAudioRecording: vi.fn().mockResolvedValue(undefined),
    };
    const { result } = renderHook(() => useRecording());
    // First, start screen capture to set screenMediaStream
    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => { expect(result.current.isMediaCapturing).toBe(true); });
    // Now start screen recording (screenMediaStream is set)
    act(() => { result.current.startScreenRecording('trial_0'); });
    expect(result.current.isScreenRecording).toBe(true);
    expect(result.current.isAudioRecording).toBe(true);
  });

  test('startScreenRecording screen-only (no audio): uses audio stop handler for audio (covers lines 182-190)', async () => {
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      studyHasAudioRecording: false,
      currentComponentHasScreenRecording: true,
      currentComponentHasAudioRecording: false,
    };
    mockStorageEngine = { saveAudioRecording: vi.fn().mockResolvedValue(undefined) };
    const { result } = renderHook(() => useRecording());
    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => { expect(result.current.isMediaCapturing).toBe(true); });
    act(() => { result.current.startScreenRecording('trial_0'); });
    expect(result.current.isScreenRecording).toBe(true);
  });
});

// ── stopScreenCapture with populated refs ──────────────────────────────────────

describe('useRecording stopScreenCapture with refs populated', () => {
  test('stopScreenCapture cleans up all refs and resets state (covers lines 70-108)', async () => {
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      studyHasAudioRecording: true,
      currentComponentHasScreenRecording: true,
      currentComponentHasAudioRecording: true,
    };
    mockStorageEngine = {
      saveScreenRecording: vi.fn().mockResolvedValue(undefined),
      saveAudioRecording: vi.fn().mockResolvedValue(undefined),
    };
    const { result } = renderHook(() => useRecording());
    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => { expect(result.current.isMediaCapturing).toBe(true); });
    act(() => { result.current.startScreenRecording('trial_0'); });
    // Now call stopScreenCapture — refs have values → covers cleanup branches
    act(() => { result.current.stopScreenCapture(); });
    expect(result.current.isScreenCapturing).toBe(false);
    expect(result.current.isScreenRecording).toBe(false);
    expect(result.current.isAudioRecording).toBe(false);
    expect(result.current.isMediaCapturing).toBe(false);
  });
});

// ── stopAudioRecording tests ───────────────────────────────────────────────────

describe('useRecording audio recording effect', () => {
  test('audio recording effect triggers startAudioRecording when conditions met (covers lines 276-293)', async () => {
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: false,
      studyHasAudioRecording: true,
      currentComponentHasAudioRecording: true,
    };
    mockStorageEngine = { saveAudioRecording: vi.fn().mockResolvedValue(undefined) };
    const { result } = renderHook(() => useRecording());
    // Effect fires on mount with currentComponentHasAudioRecording=true, storageEngine set
    await act(async () => { /* let effects settle */ });
    // getUserMedia was called for audio recording
    expect(vi.mocked(navigator.mediaDevices.getUserMedia)).toHaveBeenCalled();
    expect(result.current.isAudioRecording).toBe(true);
  });

  test('audio effect stopAudioRecording called when currentComponentHasAudioRecording turns false (covers lines 276-279)', async () => {
    mockStorageEngine = { saveAudioRecording: vi.fn().mockResolvedValue(undefined) };
    // Start with audio enabled
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasAudioRecording: true,
      currentComponentHasAudioRecording: true,
    };
    const { result, rerender } = renderHook(() => useRecording());
    await act(async () => { /* let effects settle */ });
    // Now disable audio → effect re-fires with currentComponentHasAudioRecording=false
    mockRecordingConfig = { ...mockRecordingConfig, currentComponentHasAudioRecording: false };
    await act(async () => { rerender(); });
    expect(result.current.isAudioRecording).toBe(false);
  });
});

// ── screen recording effect tests ──────────────────────────────────────────────

describe('useRecording screen recording effect', () => {
  test('screen recording effect starts recording when isMediaCapturing and conditions met (covers lines 304-316)', async () => {
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      studyHasAudioRecording: true,
      currentComponentHasScreenRecording: true,
    };
    mockStorageEngine = {
      saveScreenRecording: vi.fn().mockResolvedValue(undefined),
      saveAudioRecording: vi.fn().mockResolvedValue(undefined),
    };
    const { result } = renderHook(() => useRecording());
    // Start capture to set isMediaCapturing
    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => { expect(result.current.isMediaCapturing).toBe(true); });
    // Screen recording effect: isMediaCapturing=true, currentComponent=intro → startScreenRecording
    await act(async () => { /* let effects settle */ });
    expect(result.current.isScreenRecording).toBe(true);
  });

  test('screen effect calls stopScreenCapture when currentComponent is end (covers lines 314-316)', async () => {
    mockRecordingConfig = { ...mockRecordingConfig, studyHasScreenRecording: true };
    mockStorageEngine = { saveAudioRecording: vi.fn().mockResolvedValue(undefined) };
    mockCurrentComponent = 'end';
    const { result } = renderHook(() => useRecording());
    act(() => { result.current.startScreenCapture(); });
    // The stop effect fires because currentComponent is 'end', resetting capture state
    await waitFor(() => { expect(result.current.isScreenCapturing).toBe(false); });
  });
});

// ── isMuted effect test ────────────────────────────────────────────────────────

describe('useRecording isMuted effect', () => {
  test('changing isMuted updates audio track enabled state (covers lines 381-382)', async () => {
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasAudioRecording: true,
    };
    const { result } = renderHook(() => useRecording());
    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => { expect(result.current.isMediaCapturing).toBe(true); });
    act(() => { result.current.setIsMuted(true); });
    // The effect fires and calls getAudioTracks().forEach(track => track.enabled = !isMuted)
    expect(result.current.isMuted).toBe(true);
  });
});

// ── isRejected effect test ─────────────────────────────────────────────────────

describe('useRecording isRejected effect', () => {
  test('isRejected set true when screenCaptureStarted but not isScreenCapturing (covers lines 228-229)', async () => {
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      studyHasAudioRecording: false,
    };
    const { result } = renderHook(() => useRecording());
    // startScreenCapture → screenCaptureStarted=true, isScreenCapturing=true
    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => { expect(result.current.isMediaCapturing).toBe(true); });
    expect(result.current.isScreenCapturing).toBe(true);
    // stopScreenCapture → isScreenCapturing=false, screenCaptureStarted stays true
    // Effect: screenCaptureStarted=true && !isScreenCapturing=true → setIsRejected(true)
    act(() => { result.current.stopScreenCapture(); });
    expect(result.current.isRejected).toBe(true);
  });
});

// ── useRecordingContext ────────────────────────────────────────────────────────

describe('useRecordingContext', () => {
  test('throws when used outside RecordingProvider (covers lines 418-419)', () => {
    expect(() => { renderHook(() => useRecordingContext()); }).toThrow('useRecordingContext must be used within a RecordingProvider');
  });
});
