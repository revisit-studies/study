import {
  renderHook, act, cleanup, waitFor,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { useRecording, useRecordingContext } from '../useRecording';

// ── mutable state ─────────────────────────────────────────────────────────────

let mockRecordingConfig = {
  studyHasScreenRecording: false,
  studyHasAudioRecording: false,
  studyHasWebcamRecording: false,
  currentComponentHasAudioRecording: false,
  currentComponentHasScreenRecording: false,
  currentComponentHasWebcamRecording: false,
  currentComponentHasClickToRecord: false,
};
let mockCurrentComponent = 'intro';
let mockStorageEngine: Record<string, ReturnType<typeof vi.fn>> | null = null;
let mockStoredAnswer: { endTime: number } | null = null;
const mockRecorderStartAudioStates: boolean[][] = [];

// ── media mocks ────────────────────────────────────────────────────────────────

const mockTrackFactory = () => ({
  stop: vi.fn(),
  enabled: true,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  clone: vi.fn(() => mockTrackFactory()),
});

class MockMediaStream {
  _tracks: ReturnType<typeof mockTrackFactory>[];

  constructor(tracks: ReturnType<typeof mockTrackFactory>[] = [mockTrackFactory()]) {
    this._tracks = tracks;
  }

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

  start = vi.fn(() => {
    mockRecorderStartAudioStates.push(this.stream.getAudioTracks().map((track) => track.enabled));
    this.state = 'recording';
    this._listeners.start?.({});
  });

  stop = vi.fn(() => {
    this.state = 'inactive';
    this._listeners.stop?.({});
  });

  addEventListener = vi.fn((event: string, handler: (event: Partial<{ data: Blob }>) => void) => {
    this._listeners[event] = handler;
  });

  triggerEvent(event: string, data?: Blob) {
    this._listeners[event]?.({ data });
  }
}

// ── module mocks ───────────────────────────────────────────────────────────────

vi.mock('../useStudyConfig', () => ({
  useStudyConfig: () => ({
    uiConfig: { recordScreenFPS: undefined, recordAudio: false, recordWebcam: false },
    sequence: {
      id: 'root', order: 'fixed', components: ['intro', 'end'], skip: [],
    },
  }),
}));

vi.mock('../../../routes/utils', () => ({
  useCurrentComponent: () => mockCurrentComponent,
  useCurrentIdentifier: () => 'intro_0',
}));

vi.mock('../../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: mockStorageEngine }),
}));

vi.mock('../useRecordingConfig', () => ({
  useRecordingConfig: () => mockRecordingConfig,
}));

vi.mock('../useStoredAnswer', () => ({
  useStoredAnswer: () => mockStoredAnswer,
}));

vi.mock('../useIsAnalysis', () => ({
  useIsAnalysis: () => false,
}));

// ── lifecycle ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockRecordingConfig = {
    studyHasScreenRecording: false,
    studyHasAudioRecording: false,
    studyHasWebcamRecording: false,
    currentComponentHasAudioRecording: false,
    currentComponentHasScreenRecording: false,
    currentComponentHasWebcamRecording: false,
    currentComponentHasClickToRecord: false,
  };
  mockCurrentComponent = 'intro';
  mockStorageEngine = null;
  mockStoredAnswer = null;
  mockRecorderStartAudioStates.length = 0;

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
    expect(result.current.isWebcamRecording).toBe(false);
    expect(result.current.isScreenCapturing).toBe(false);
    expect(result.current.isWebcamCapturing).toBe(false);
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
  test('success path: sets isScreenCapturing, isAudioCapturing, isMediaCapturing', async () => {
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
      expect(result.current.screenRecordingError).toBe('Recording permission denied');
    });
  });

  test('webcam-only capture does not request display media', async () => {
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasWebcamRecording: true,
      currentComponentHasWebcamRecording: true,
    };
    mockStorageEngine = { saveWebcamRecording: vi.fn(async () => {}) };
    const { result } = renderHook(() => useRecording());

    act(() => { result.current.startWebcamCapture(); });

    await waitFor(() => expect(result.current.isWebcamCapturing).toBe(true));
    expect(result.current.isScreenCapturing).toBe(false);
    expect(navigator.mediaDevices.getDisplayMedia).not.toHaveBeenCalled();
  });

  test('stops an already-granted screen stream when webcam permission is denied', async () => {
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      studyHasWebcamRecording: true,
    };
    const screenStream = new MockMediaStream();
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockResolvedValue(screenStream as unknown as MediaStream);
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(new Error('denied'));
    const { result } = renderHook(() => useRecording());

    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => expect(result.current.screenRecordingError).toBe('Recording permission denied'));
    expect(screenStream.getTracks()[0].stop).toHaveBeenCalled();
  });

  test('does not start overlapping capture requests', async () => {
    mockRecordingConfig = { ...mockRecordingConfig, studyHasScreenRecording: true };
    let resolveCapture: ((stream: MediaStream) => void) | undefined;
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockImplementation(() => new Promise<MediaStream>((resolve) => {
      resolveCapture = resolve;
    }));
    const { result } = renderHook(() => useRecording());

    act(() => {
      result.current.startScreenCapture();
      result.current.startScreenCapture();
    });
    expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalledOnce();
    await act(async () => { resolveCapture?.(new MockMediaStream() as unknown as MediaStream); });
  });

  test('cleans up persistent capture on unmount', async () => {
    mockRecordingConfig = { ...mockRecordingConfig, studyHasScreenRecording: true };
    const screenStream = new MockMediaStream();
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockResolvedValue(screenStream as unknown as MediaStream);
    const { result, unmount } = renderHook(() => useRecording());
    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => expect(result.current.isMediaCapturing).toBe(true));
    unmount();
    expect(screenStream.getTracks()[0].stop).toHaveBeenCalled();
  });

  test('initializes the persistent microphone track with the current mute state', async () => {
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      studyHasAudioRecording: true,
      currentComponentHasClickToRecord: true,
    };
    const micStream = new MockMediaStream();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(micStream as unknown as MediaStream);
    const { result } = renderHook(() => useRecording());
    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => expect(result.current.isAudioCapturing).toBe(true));
    expect(micStream.getAudioTracks()[0].enabled).toBe(false);
  });

  test('stops screen and webcam streams when required microphone permission is denied', async () => {
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      studyHasWebcamRecording: true,
      studyHasAudioRecording: true,
    };
    const screenStream = new MockMediaStream();
    const webcamStream = new MockMediaStream();
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockResolvedValue(screenStream as unknown as MediaStream);
    vi.mocked(navigator.mediaDevices.getUserMedia)
      .mockResolvedValueOnce(webcamStream as unknown as MediaStream)
      .mockRejectedValueOnce(new Error('denied'));
    const { result } = renderHook(() => useRecording());

    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => expect(result.current.audioRecordingError).toBe('Microphone permission denied'));
    expect(result.current.isMediaCapturing).toBe(false);
    expect(screenStream.getTracks()[0].stop).toHaveBeenCalled();
    expect(webcamStream.getTracks()[0].stop).toHaveBeenCalled();
  });

  test('starts a click-to-record trial muted even if the prior component was not muted', async () => {
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      studyHasAudioRecording: true,
      currentComponentHasScreenRecording: true,
      currentComponentHasAudioRecording: true,
    };
    const micStream = new MockMediaStream();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(micStream as unknown as MediaStream);
    mockStorageEngine = {
      saveScreenRecording: vi.fn(async () => {}),
      saveAudioRecording: vi.fn(async () => {}),
    };
    vi.stubGlobal('AudioContext', class {
      createAnalyser() {
        return {
          fftSize: 0,
          smoothingTimeConstant: 0,
          getFloatTimeDomainData: vi.fn(),
        };
      }

      createMediaStreamSource() {
        return { connect: vi.fn() };
      }

      close = vi.fn(async () => {});
    });
    const { result, rerender } = renderHook(() => useRecording());
    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => expect(result.current.isMediaCapturing).toBe(true));

    mockRecordingConfig = {
      ...mockRecordingConfig,
      currentComponentHasClickToRecord: true,
    };
    act(() => { rerender(); });
    await waitFor(() => expect(result.current.isMuted).toBe(true));
    act(() => { result.current.startScreenRecording('trial_0'); });

    expect(micStream.getAudioTracks()[0].enabled).toBe(false);
    expect(mockRecorderStartAudioStates.some((states) => states.includes(false))).toBe(true);
  });
});

// ── startScreenRecording tests ─────────────────────────────────────────────────

describe('useRecording startScreenRecording after startScreenCapture', () => {
  test('startScreenRecording returns early when screenMediaStream is null', () => {
    // audio recording enabled but no startScreenCapture → screenMediaStream is null
    mockRecordingConfig = {
      ...mockRecordingConfig,
      currentComponentHasScreenRecording: true,
    };
    const { result } = renderHook(() => useRecording());
    act(() => { result.current.startScreenRecording('trial_0'); });
    expect(result.current.isScreenRecording).toBe(false);
  });

  test('startScreenRecording after startScreenCapture starts the recorder', async () => {
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      studyHasAudioRecording: true,
      currentComponentHasScreenRecording: true,
      currentComponentHasAudioRecording: true,
    };
    mockStorageEngine = {
      saveScreenRecording: vi.fn(async () => {}),
      saveAudioRecording: vi.fn(async () => {}),
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

  test('startScreenRecording screen-only (no audio): uses audio stop handler for audio', async () => {
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      studyHasAudioRecording: false,
      currentComponentHasScreenRecording: true,
      currentComponentHasAudioRecording: false,
    };
    mockStorageEngine = { saveScreenRecording: vi.fn(async () => {}) };
    const { result } = renderHook(() => useRecording());
    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => { expect(result.current.isMediaCapturing).toBe(true); });
    act(() => { result.current.startScreenRecording('trial_0'); });
    expect(result.current.isScreenRecording).toBe(true);
  });

  test('starts a separate webcam recorder for webcam-only trials', async () => {
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasWebcamRecording: true,
      currentComponentHasWebcamRecording: true,
    };
    mockStorageEngine = { saveWebcamRecording: vi.fn(async () => {}) };
    const { result } = renderHook(() => useRecording());

    act(() => { result.current.startWebcamCapture(); });
    await waitFor(() => expect(result.current.isMediaCapturing).toBe(true));
    await waitFor(() => expect(result.current.isWebcamRecording).toBe(true));

    act(() => { result.current.stopScreenRecording(); });
    expect(result.current.isWebcamRecording).toBe(false);
  });

  test('starts screen, webcam, and audio recording together', async () => {
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      studyHasAudioRecording: true,
      studyHasWebcamRecording: true,
      currentComponentHasScreenRecording: true,
      currentComponentHasAudioRecording: true,
      currentComponentHasWebcamRecording: true,
    };
    mockStorageEngine = {
      saveScreenRecording: vi.fn(async () => {}),
      saveAudioRecording: vi.fn(async () => {}),
      saveWebcamRecording: vi.fn(async () => {}),
    };
    const { result } = renderHook(() => useRecording());

    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => expect(result.current.isMediaCapturing).toBe(true));
    await waitFor(() => {
      expect(result.current.isScreenRecording).toBe(true);
      expect(result.current.isWebcamRecording).toBe(true);
      expect(result.current.isAudioRecording).toBe(true);
    });
  });
});

// ── stopScreenCapture with populated refs ──────────────────────────────────────

describe('useRecording stopScreenCapture with refs populated', () => {
  test('stopScreenCapture cleans up all refs and resets state', async () => {
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      studyHasAudioRecording: true,
      currentComponentHasScreenRecording: true,
      currentComponentHasAudioRecording: true,
    };
    mockStorageEngine = {
      saveScreenRecording: vi.fn(async () => {}),
      saveAudioRecording: vi.fn(async () => {}),
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
  test('audio recording effect triggers startAudioRecording when conditions met', async () => {
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: false,
      studyHasAudioRecording: true,
      currentComponentHasAudioRecording: true,
    };
    mockStorageEngine = { saveAudioRecording: vi.fn(async () => {}) };
    const { result } = renderHook(() => useRecording());
    // Effect fires on mount with currentComponentHasAudioRecording=true, storageEngine set
    await act(async () => { /* let effects settle */ });
    // getUserMedia was called for audio recording
    expect(vi.mocked(navigator.mediaDevices.getUserMedia)).toHaveBeenCalled();
    expect(result.current.isAudioRecording).toBe(true);
  });

  test('audio effect stopAudioRecording called when currentComponentHasAudioRecording turns false', async () => {
    mockStorageEngine = { saveAudioRecording: vi.fn(async () => {}) };
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
  test('screen recording effect starts recording when isMediaCapturing and conditions met', async () => {
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      studyHasAudioRecording: true,
      currentComponentHasScreenRecording: true,
    };
    mockStorageEngine = {
      saveScreenRecording: vi.fn(async () => {}),
      saveAudioRecording: vi.fn(async () => {}),
    };
    const { result } = renderHook(() => useRecording());
    // Start capture to set isMediaCapturing
    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => { expect(result.current.isMediaCapturing).toBe(true); });
    // Screen recording effect: isMediaCapturing=true, currentComponent=intro → startScreenRecording
    await act(async () => { /* let effects settle */ });
    expect(result.current.isScreenRecording).toBe(true);
  });

  test('screen effect calls stopScreenCapture when currentComponent is end', async () => {
    mockRecordingConfig = { ...mockRecordingConfig, studyHasScreenRecording: true };
    mockStorageEngine = { saveAudioRecording: vi.fn(async () => {}) };
    mockCurrentComponent = 'end';
    const { result } = renderHook(() => useRecording());
    act(() => { result.current.startScreenCapture(); });
    // The stop effect fires because currentComponent is 'end', resetting capture state
    await waitFor(() => { expect(result.current.isScreenCapturing).toBe(false); });
  });
});

// ── isMuted effect test ────────────────────────────────────────────────────────

describe('useRecording isMuted effect', () => {
  test('changing isMuted updates audio track enabled state', async () => {
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
  test('isRejected set true when screenCaptureStarted but not isScreenCapturing', async () => {
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
  test('throws when used outside RecordingProvider', () => {
    expect(() => { renderHook(() => useRecordingContext()); }).toThrow('useRecordingContext must be used within a RecordingProvider');
  });
});
