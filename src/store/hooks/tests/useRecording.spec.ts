import React from 'react';
import {
  renderHook, act, cleanup, waitFor, render, screen, fireEvent,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { MantineProvider } from '@mantine/core';
import * as recordingHooks from '../useRecording';
import { RecordingContext, useRecording, useRecordingContext } from '../useRecording';
import type { StoreState } from '../../types';
import ScreenRecordingPermission from '../../../public/libraries/screen-recording/assets/ScreenRecording';
import WebcamRecordingPermission from '../../../public/libraries/webcam-recording/assets/WebcamRecording';

const mockAssetOwner = vi.hoisted(() => ({ trialAssetEntry: undefined as { identifier: string; studyId: string; key: string; segments?: string[] } | undefined }));

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
let mockRequireEntireScreen = false;
let mockIdentifier = 'intro_0';
let mockStudyId = 'study';
let mockGlobalStoreEnabled = false;
let mockCompleted = false;
let mockGlobalRevision = 0;
let mockGlobalStoreSubmitting = false;
let mockGlobalStorePendingRevision = 0;
let mockStorageEngine: Record<string, ReturnType<typeof vi.fn>> | null = null;
let mockStoredAnswer: { endTime: number } | null = null;
let mockModes = { dataCollectionEnabled: true, developmentModeEnabled: false, dataSharingEnabled: false };
const mockRecorderStartAudioStates: boolean[][] = [];
type TrackEventListener = (event?: Event) => void;

// ── media mocks ────────────────────────────────────────────────────────────────

const mockTrackFactory = (displaySurface: string | null = 'browser', readyState = 'live') => {
  const settings = displaySurface === null ? {} : { displaySurface };
  const listeners = new Map<string, TrackEventListener>();
  return {
    readyState,
    getSettings: vi.fn(() => settings),
    stop: vi.fn(),
    enabled: true,
    addEventListener: vi.fn((event: string, listener: (event?: Event) => void) => listeners.set(event, listener)),
    removeEventListener: vi.fn((event: string) => listeners.delete(event)),
    triggerEnded: () => listeners.get('ended')?.(new Event('ended')),
    clone: vi.fn(() => mockTrackFactory()),
  };
};

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
  static instances: MockMediaRecorder[] = [];

  stream: MockMediaStream;

  mimeType = 'video/webm';

  state = 'inactive';

  private _listeners: Record<string, ((event: Partial<{ data: Blob }>) => void)> = {};

  constructor(s: MockMediaStream) {
    this.stream = s;
    MockMediaRecorder.instances.push(this);
  }

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

vi.hoisted(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

function renderWithMantine(ui: React.ReactElement) {
  return render(React.createElement(MantineProvider, null, ui));
}

// ── module mocks ───────────────────────────────────────────────────────────────

vi.mock('../useStudyConfig', () => ({
  useStudyConfig: () => ({
    globalVariables: mockGlobalStoreEnabled ? { budget: { initialValue: 100 } } : undefined,
    uiConfig: {
      recordScreenFPS: undefined,
      recordAudio: false,
      recordWebcam: false,
      requireEntireScreen: mockRequireEntireScreen,
      recordScreen: true,
    },
    sequence: {
      id: 'root', order: 'fixed', components: ['intro', 'end'], skip: [],
    },
  }),
}));

vi.mock('../../../routes/utils', () => ({
  useCurrentComponent: () => mockCurrentComponent,
  useCurrentIdentifier: () => mockIdentifier,
  useStudyId: () => mockStudyId,
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

vi.mock('../../store', async () => ({
  StudyStoreContext: (await vi.importActual<typeof React>('react')).createContext(mockAssetOwner),
  useStoreSelector: (selector: (s: StoreState) => unknown) => selector({
    modes: mockModes,
    completed: mockCompleted,
    globalStoreRevision: mockGlobalRevision,
    globalStoreSubmitting: mockGlobalStoreSubmitting,
    globalStorePendingRevision: mockGlobalStorePendingRevision,
  } as StoreState),
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
  mockRequireEntireScreen = false;
  mockIdentifier = 'intro_0';
  mockStudyId = 'study';
  mockGlobalStoreEnabled = false;
  mockAssetOwner.trialAssetEntry = undefined;
  mockCompleted = false;
  mockGlobalRevision = 0;
  mockGlobalStoreSubmitting = false;
  mockGlobalStorePendingRevision = 0;
  mockStorageEngine = null;
  mockStoredAnswer = null;
  mockModes = { dataCollectionEnabled: true, developmentModeEnabled: false, dataSharingEnabled: false };
  mockRecorderStartAudioStates.length = 0;
  MockMediaRecorder.instances.length = 0;

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
  test('shows the verified monitor preview while another required permission is still pending', async () => {
    mockRequireEntireScreen = true;
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      studyHasWebcamRecording: true,
    };
    const monitorStream = new MockMediaStream([mockTrackFactory('monitor')]);
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockResolvedValue(monitorStream as unknown as MediaStream);
    let resolveWebcam!: (stream: MediaStream) => void;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementationOnce(() => new Promise((resolve) => {
      resolveWebcam = resolve as (stream: MediaStream) => void;
    }));
    const { result } = renderHook(() => useRecording());
    const play = vi.fn(() => Promise.resolve());
    const preview = { srcObject: null as MediaStream | null, play };
    result.current.recordVideoRef.current = preview as unknown as HTMLVideoElement;

    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => expect(resolveWebcam).toBeTypeOf('function'));

    expect(preview.srcObject).toBe(monitorStream);
    expect(play).toHaveBeenCalledOnce();
    expect(result.current.hasActiveVerifiedScreenCapture()).toBe(false);

    await act(async () => { resolveWebcam(new MockMediaStream() as unknown as MediaStream); });
  });

  test('waits for final chunk and recording uploads when stopping a task recorder', async () => {
    mockRequireEntireScreen = true;
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      currentComponentHasScreenRecording: true,
    };
    const resolveWrites: Array<() => void> = [];
    mockStorageEngine = {
      saveScreenRecording: vi.fn(() => new Promise<void>((resolve) => { resolveWrites.push(resolve); })),
    };
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockResolvedValue(
      new MockMediaStream([mockTrackFactory('monitor')]) as unknown as MediaStream,
    );
    const hook = renderHook(() => useRecording());
    act(() => { hook.result.current.startScreenCapture(); });
    await waitFor(() => expect(hook.result.current.isScreenRecording).toBe(true));
    MockMediaRecorder.instances[0].triggerEvent('dataavailable', new Blob(['last chunk'], { type: 'video/webm' }));

    let stopped = false;
    let stopping!: Promise<void>;
    act(() => {
      stopping = hook.result.current.stopScreenRecording().then(() => { stopped = true; });
    });
    await waitFor(() => expect(resolveWrites).toHaveLength(2));
    expect(stopped).toBe(false);
    const actualStopTime = hook.result.current.getRecordingStopTime(mockAssetOwner.trialAssetEntry!.key);
    expect(actualStopTime).toBeTypeOf('number');

    await act(async () => {
      resolveWrites.splice(0).forEach((resolve) => resolve());
      await stopping;
    });
    expect(stopped).toBe(true);
    expect(hook.result.current.getRecordingStopTime(mockAssetOwner.trialAssetEntry!.key)).toBe(actualStopTime);
  });

  test('keeps screen capture unready until required media permissions and task recorders are ready', async () => {
    mockRequireEntireScreen = true;
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      studyHasWebcamRecording: true,
      currentComponentHasScreenRecording: true,
      currentComponentHasWebcamRecording: true,
    };
    mockStorageEngine = {
      saveScreenRecording: vi.fn(async () => {}),
      saveWebcamRecording: vi.fn(async () => {}),
    };
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockResolvedValue(
      new MockMediaStream([mockTrackFactory('monitor')]) as unknown as MediaStream,
    );
    let resolveWebcam!: (stream: MediaStream) => void;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementationOnce(() => new Promise((resolve) => {
      resolveWebcam = resolve as (stream: MediaStream) => void;
    }));
    const hook = renderHook(() => useRecording());

    act(() => { hook.result.current.startScreenCapture(); });
    await waitFor(() => expect(resolveWebcam).toBeTypeOf('function'));
    expect(hook.result.current.hasActiveVerifiedScreenCapture()).toBe(false);

    await act(async () => {
      resolveWebcam(new MockMediaStream() as unknown as MediaStream);
    });
    await waitFor(() => expect(hook.result.current.isScreenRecording && hook.result.current.isWebcamRecording).toBe(true));
    expect(hook.result.current.hasActiveVerifiedScreenCapture()).toBe(true);
  });

  test('persists screen recording chunks during capture for reload recovery', async () => {
    mockRequireEntireScreen = true;
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      currentComponentHasScreenRecording: true,
    };
    mockStorageEngine = { saveScreenRecording: vi.fn(async () => {}) };
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockResolvedValue(
      new MockMediaStream([mockTrackFactory('monitor')]) as unknown as MediaStream,
    );
    const { result } = renderHook(() => useRecording());
    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => expect(result.current.isScreenRecording).toBe(true));
    const screenRecorder = MockMediaRecorder.instances[0];
    act(() => { screenRecorder.triggerEvent('dataavailable', new Blob(['chunk-one'], { type: 'video/webm' })); });

    await waitFor(() => expect(mockStorageEngine!.saveScreenRecording).toHaveBeenCalledWith(
      expect.any(Blob),
      `${mockAssetOwner.trialAssetEntry!.key}__chunk_0`,
    ));
    expect(result.current.getRecordingChunkKeys(mockAssetOwner.trialAssetEntry!.key)).toEqual([
      `${mockAssetOwner.trialAssetEntry!.key}__chunk_0`,
    ]);
  });

  test('keeps only the contiguous prefix of successfully uploaded chunks in the recovery manifest', async () => {
    mockRequireEntireScreen = true;
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      currentComponentHasScreenRecording: true,
    };
    const saveScreenRecording = vi.fn(async () => {})
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('upload failed'))
      .mockResolvedValueOnce(undefined);
    mockStorageEngine = { saveScreenRecording };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.sessionStorage.clear();
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockResolvedValue(
      new MockMediaStream([mockTrackFactory('monitor')]) as unknown as MediaStream,
    );
    const { result } = renderHook(() => useRecording());
    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => expect(result.current.isScreenRecording).toBe(true));
    const screenRecorder = MockMediaRecorder.instances[0];
    act(() => {
      screenRecorder.triggerEvent('dataavailable', new Blob(['chunk-zero'], { type: 'video/webm' }));
      screenRecorder.triggerEvent('dataavailable', new Blob(['chunk-one'], { type: 'video/webm' }));
      screenRecorder.triggerEvent('dataavailable', new Blob(['chunk-two'], { type: 'video/webm' }));
    });

    await waitFor(() => expect(saveScreenRecording).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.getRecordingChunkKeys(mockAssetOwner.trialAssetEntry!.key)).toEqual([
      `${mockAssetOwner.trialAssetEntry!.key}__chunk_0`,
    ]));
  });

  test('adds a retried chunk to the recovery manifest and restores it after reload', async () => {
    mockRequireEntireScreen = true;
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      currentComponentHasScreenRecording: true,
    };
    window.sessionStorage.clear();
    let uploadSuccessListener: ((assetKey: string) => void) | undefined;
    const saveScreenRecording = vi.fn()
      .mockRejectedValueOnce(new Error('upload failed'))
      .mockResolvedValue(undefined);
    const retryFailedWrites = vi.fn(async () => {
      uploadSuccessListener?.(`screenRecording/${mockAssetOwner.trialAssetEntry!.key}__chunk_0`);
    });
    mockStorageEngine = {
      saveScreenRecording,
      retryFailedWrites,
      subscribeToAssetUploadSuccess: vi.fn((listener: (assetKey: string) => void) => {
        uploadSuccessListener = listener;
        return () => { uploadSuccessListener = undefined; };
      }),
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockResolvedValue(
      new MockMediaStream([mockTrackFactory('monitor')]) as unknown as MediaStream,
    );
    const hook = renderHook(() => useRecording());
    act(() => { hook.result.current.startScreenCapture(); });
    await waitFor(() => expect(hook.result.current.isScreenRecording).toBe(true));
    const segmentKey = mockAssetOwner.trialAssetEntry!.key;
    act(() => {
      MockMediaRecorder.instances[0].triggerEvent('dataavailable', new Blob(['chunk-zero'], { type: 'video/webm' }));
    });
    await waitFor(() => expect(saveScreenRecording).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(hook.result.current.getRecordingChunkKeys(segmentKey)).toEqual([]));

    await act(async () => { await retryFailedWrites(); });

    const expectedManifest = [`${segmentKey}__chunk_0`];
    expect(hook.result.current.getRecordingChunkKeys(segmentKey)).toEqual(expectedManifest);
    hook.unmount();
    const reloadedHook = renderHook(() => useRecording());
    expect(reloadedHook.result.current.getRecordingChunkKeys(segmentKey)).toEqual(expectedManifest);
  });

  test('waits for chunk uploads after capture shutdown has cleared recorder refs', async () => {
    mockRequireEntireScreen = true;
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      currentComponentHasScreenRecording: true,
    };
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockResolvedValue(
      new MockMediaStream([mockTrackFactory('monitor')]) as unknown as MediaStream,
    );
    let finishChunkUpload!: () => void;
    const saveScreenRecording = vi.fn((_blob: Blob, identifier: string) => (
      identifier.includes('__chunk_')
        ? new Promise<void>((resolve) => { finishChunkUpload = resolve; })
        : Promise.resolve()
    ));
    mockStorageEngine = { saveScreenRecording };
    const { result } = renderHook(() => useRecording());
    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => expect(result.current.isScreenRecording).toBe(true));
    act(() => {
      MockMediaRecorder.instances[0].triggerEvent('dataavailable', new Blob(['chunk'], { type: 'video/webm' }));
    });
    await waitFor(() => expect(saveScreenRecording).toHaveBeenCalledWith(expect.any(Blob), expect.stringContaining('__chunk_0')));

    act(() => { result.current.stopScreenCapture(); });
    let stopped = false;
    const pendingStop = result.current.stopScreenRecording().then(() => { stopped = true; });
    await act(async () => { await Promise.resolve(); });
    expect(stopped).toBe(false);

    await act(async () => {
      finishChunkUpload();
      await pendingStop;
    });
    expect(stopped).toBe(true);
  });

  test('does not read chunk manifests from another study', () => {
    window.sessionStorage.setItem('revisit-recording-chunks:study-one:anonymous:segment', JSON.stringify(['segment__chunk_0']));
    mockStudyId = 'study-two';

    const { result } = renderHook(() => useRecording());

    expect(result.current.getRecordingChunkKeys('segment')).toEqual([]);
  });

  test('does not upload per-second chunks for ordinary screen recording', async () => {
    mockRequireEntireScreen = false;
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      currentComponentHasScreenRecording: true,
    };
    mockStorageEngine = { saveScreenRecording: vi.fn(async () => {}) };
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockResolvedValue(
      new MockMediaStream([mockTrackFactory('browser')]) as unknown as MediaStream,
    );
    const { result } = renderHook(() => useRecording());
    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => expect(result.current.isScreenRecording).toBe(true));
    act(() => { MockMediaRecorder.instances[0].triggerEvent('dataavailable', new Blob(['chunk-one'], { type: 'video/webm' })); });
    expect(mockStorageEngine.saveScreenRecording).not.toHaveBeenCalled();
  });

  test.each([
    ['window', 'window', 'Please share an entire monitor. Tab and window sharing cannot be used for this study.'],
    ['tab', 'browser', 'Please share an entire monitor. Tab and window sharing cannot be used for this study.'],
    ['missing metadata', null, 'This browser cannot verify whole-monitor sharing. Please use a supported browser to continue.'],
  ])('rejects %s capture for requireEntireScreen', async (_name, displaySurface, message) => {
    mockRequireEntireScreen = true;
    mockRecordingConfig = { ...mockRecordingConfig, studyHasScreenRecording: true };
    const invalidStream = new MockMediaStream([mockTrackFactory(displaySurface as string | null)]);
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockResolvedValue(invalidStream as unknown as MediaStream);
    const { result } = renderHook(() => useRecording());
    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => expect(result.current.screenCaptureVerificationError).toBe(message));
    expect(result.current.isScreenCapturing).toBe(false);
    expect(invalidStream.getTracks()[0].stop).toHaveBeenCalledOnce();
  });

  test('accepts a live monitor capture when requireEntireScreen is enabled', async () => {
    mockRequireEntireScreen = true;
    mockRecordingConfig = { ...mockRecordingConfig, studyHasScreenRecording: true };
    const monitorStream = new MockMediaStream([mockTrackFactory('monitor')]);
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockResolvedValue(monitorStream as unknown as MediaStream);
    const { result } = renderHook(() => useRecording());
    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => expect(result.current.isScreenCapturing).toBe(true));
    expect(result.current.screenCaptureVerificationError).toBeNull();
  });

  test('does not reject when a share started on the introduction ends on the permission step', async () => {
    mockRequireEntireScreen = true;
    mockRecordingConfig = { ...mockRecordingConfig, studyHasScreenRecording: true };
    mockCurrentComponent = 'introduction';
    const monitorTrack = mockTrackFactory('monitor');
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockResolvedValue(
      new MockMediaStream([monitorTrack]) as unknown as MediaStream,
    );
    const hook = renderHook(() => useRecording());

    act(() => { hook.result.current.startScreenCapture(); });
    await waitFor(() => expect(hook.result.current.isScreenCapturing).toBe(true));
    mockCurrentComponent = '$screen-recording.components.screenRecordingPermission';
    hook.rerender();

    act(() => { monitorTrack.triggerEnded(); });

    await waitFor(() => expect(hook.result.current.isScreenCapturing).toBe(false));
    expect(hook.result.current.isRejected).toBe(false);
  });

  test('rejects an already-ended monitor share with a clear retry message', async () => {
    mockRequireEntireScreen = true;
    mockRecordingConfig = { ...mockRecordingConfig, studyHasScreenRecording: true };
    const endedTrack = mockTrackFactory('monitor', 'ended');
    const monitorStream = new MockMediaStream([endedTrack]);
    const retryStream = new MockMediaStream([mockTrackFactory('monitor')]);
    vi.mocked(navigator.mediaDevices.getDisplayMedia)
      .mockResolvedValueOnce(monitorStream as unknown as MediaStream)
      .mockResolvedValueOnce(retryStream as unknown as MediaStream);
    const { result } = renderHook(() => useRecording());

    act(() => { result.current.startScreenCapture(); });

    await waitFor(() => expect(result.current.screenCaptureVerificationError).toBe(
      'The selected monitor share has already ended. Please share your monitor again.',
    ));
    expect(result.current.isRejected).toBe(false);
    expect(result.current.isScreenCapturing).toBe(false);
    expect(endedTrack.stop).toHaveBeenCalledOnce();

    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => expect(result.current.isScreenCapturing).toBe(true));
    expect(result.current.screenCaptureVerificationError).toBeNull();
  });

  test('explains unsupported screen capture for requireEntireScreen', async () => {
    mockRequireEntireScreen = true;
    mockRecordingConfig = { ...mockRecordingConfig, studyHasScreenRecording: true };
    vi.stubGlobal('navigator', {});

    const { result } = renderHook(() => useRecording());
    act(() => { result.current.startScreenCapture(); });

    await waitFor(() => expect(result.current.screenCaptureVerificationError).toBe(
      'This browser does not support whole-monitor sharing. Please use a supported browser to continue.',
    ));
    expect(result.current.screenRecordingError).toBe('Whole-monitor sharing is not supported in this browser');
    expect(result.current.isScreenCapturing).toBe(false);
  });

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

  test('does not stop the persistent microphone track when audio is disabled on one screen trial', async () => {
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      studyHasAudioRecording: true,
      currentComponentHasScreenRecording: true,
      currentComponentHasAudioRecording: true,
    };
    const micStream = new MockMediaStream();
    mockStorageEngine = { saveScreenRecording: vi.fn(async () => {}), saveAudioRecording: vi.fn(async () => {}) };
    vi.mocked(navigator.mediaDevices.getUserMedia)
      .mockResolvedValueOnce(micStream as unknown as MediaStream);
    const { result, rerender } = renderHook(() => useRecording());

    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => expect(result.current.isMediaCapturing).toBe(true));
    await waitFor(() => expect(result.current.isAudioRecording).toBe(true));

    mockCurrentComponent = 'audio-disabled';
    mockRecordingConfig = {
      ...mockRecordingConfig,
      currentComponentHasAudioRecording: false,
      currentComponentHasScreenRecording: true,
    };
    act(() => { rerender(); });

    expect(micStream.getTracks()[0].stop).not.toHaveBeenCalled();
  });

  test('restores capture after Strict Mode effect replay', async () => {
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
    };
    const wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(
      React.StrictMode,
      null,
      children,
    );
    const { result } = renderHook(() => useRecording(), { wrapper });

    act(() => { result.current.startScreenCapture(); });

    await waitFor(() => expect(result.current.isScreenCapturing).toBe(true));
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
    const screenStream = new MockMediaStream([mockTrackFactory('monitor')]);
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockResolvedValue(screenStream as unknown as MediaStream);
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(new Error('denied'));
    const { result } = renderHook(() => useRecording());

    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => expect(result.current.screenRecordingError).toBe('Recording permission denied'));
    expect(screenStream.getTracks()[0].stop).toHaveBeenCalled();
  });

  test('stops an acquired screen stream when webcam permission is still pending', async () => {
    mockRequireEntireScreen = true;
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      studyHasWebcamRecording: true,
    };
    const screenStream = new MockMediaStream([mockTrackFactory('monitor')]);
    let resolveWebcam: ((stream: MediaStream) => void) | undefined;
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockResolvedValue(screenStream as unknown as MediaStream);
    vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementationOnce(() => new Promise<MediaStream>((resolve) => {
      resolveWebcam = resolve;
    }));
    const { result } = renderHook(() => useRecording());

    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => expect(screenStream.getTracks()[0].addEventListener).toHaveBeenCalledWith('ended', expect.any(Function)));

    const endedHandler = screenStream.getTracks()[0].addEventListener.mock.calls[0][1] as () => void;
    act(() => { endedHandler(); });
    resolveWebcam?.(new MockMediaStream() as unknown as MediaStream);

    await waitFor(() => expect(result.current.isScreenCapturing).toBe(false));
    expect(screenStream.getTracks()[0].stop).toHaveBeenCalled();
    expect(result.current.isRejected).toBe(true);
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
      currentComponentHasClickToRecord: false,
    };
    const micStream = new MockMediaStream();
    mockStorageEngine = {
      saveScreenRecording: vi.fn(async () => {}),
      saveAudioRecording: vi.fn(async () => {}),
      saveWebcamRecording: vi.fn(async () => {}),
    };
    vi.mocked(navigator.mediaDevices.getUserMedia)
      .mockResolvedValueOnce(new MockMediaStream() as unknown as MediaStream)
      .mockResolvedValueOnce(micStream as unknown as MediaStream);
    const { result } = renderHook(() => useRecording());

    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => expect(result.current.isMediaCapturing).toBe(true));
    await waitFor(() => {
      expect(result.current.isScreenRecording).toBe(true);
      expect(result.current.isWebcamRecording).toBe(true);
      expect(result.current.isAudioRecording).toBe(true);
    });
    expect(micStream.getAudioTracks()[0].enabled).toBe(true);
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
  test('records an accepted non-global audio task again when full-screen capture is required', async () => {
    mockRequireEntireScreen = true;
    mockStoredAnswer = { endTime: 100 };
    mockRecordingConfig = { ...mockRecordingConfig, studyHasAudioRecording: true, currentComponentHasAudioRecording: true };
    mockStorageEngine = { saveAudioRecording: vi.fn(async () => {}) };

    const { result } = renderHook(() => useRecording());

    await waitFor(() => expect(result.current.isAudioRecording).toBe(true));
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledOnce();
  });

  test('audio finalization waits for the blob save and exposes the recorder start time', async () => {
    let resolveSave!: () => void;
    const saveAudioRecording = vi.fn(() => new Promise<void>((resolve) => { resolveSave = resolve; }));
    mockRecordingConfig = { ...mockRecordingConfig, studyHasAudioRecording: true, currentComponentHasAudioRecording: true };
    mockStorageEngine = { saveAudioRecording };
    const { result } = renderHook(() => useRecording());

    await waitFor(() => expect(result.current.isAudioRecording).toBe(true));
    const recorder = MockMediaRecorder.instances[0];
    const recorderStartTime = result.current.getScreenRecordingStartTime(mockAssetOwner.trialAssetEntry?.key ?? 'intro_0');
    expect(recorderStartTime).toEqual(expect.any(Number));
    act(() => recorder.triggerEvent('dataavailable', new Blob(['audio'])));

    let finalized = false;
    let stopPromise!: Promise<void>;
    act(() => {
      stopPromise = result.current.stopScreenRecording().then(() => { finalized = true; });
    });
    await waitFor(() => expect(saveAudioRecording).toHaveBeenCalledOnce());
    expect(finalized).toBe(false);

    await act(async () => { resolveSave(); await stopPromise; });
    expect(finalized).toBe(true);
  });

  test('releases the standalone microphone stream after finalization cleared its recorder ref', async () => {
    mockRecordingConfig = { ...mockRecordingConfig, studyHasAudioRecording: true, currentComponentHasAudioRecording: true };
    mockStorageEngine = { saveAudioRecording: vi.fn(async () => {}) };
    const stream = new MockMediaStream();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(stream as unknown as MediaStream);
    const { result, rerender } = renderHook(() => useRecording());

    await waitFor(() => expect(result.current.isAudioRecording).toBe(true));
    await act(async () => result.current.stopScreenRecording());
    expect(stream.getTracks()[0].stop).not.toHaveBeenCalled();

    mockCurrentComponent = 'end';
    mockIdentifier = 'end_0';
    mockRecordingConfig = { ...mockRecordingConfig, currentComponentHasAudioRecording: false };
    await act(async () => rerender());

    expect(stream.getTracks()[0].stop).toHaveBeenCalledOnce();
    expect(result.current.audioMediaStream.current).toBeNull();
  });

  test('a completed global-store session cannot restart audio on an earlier answered trial', async () => {
    mockGlobalStoreEnabled = true;
    mockCompleted = true;
    mockStoredAnswer = { endTime: 100 };
    mockRecordingConfig = { ...mockRecordingConfig, studyHasAudioRecording: true, currentComponentHasAudioRecording: true };
    mockStorageEngine = { saveAudioRecording: vi.fn(async () => {}) };
    const { result } = renderHook(() => useRecording());
    await act(async () => {});
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(result.current.isAudioRecording).toBe(false);
  });

  test.each([false, true])('completion stops active audio or discards a pending microphone request (pending=%s)', async (pending) => {
    mockGlobalStoreEnabled = true;
    mockRecordingConfig = { ...mockRecordingConfig, studyHasAudioRecording: true, currentComponentHasAudioRecording: true };
    mockStorageEngine = { saveAudioRecording: vi.fn(async () => {}) };
    const stream = new MockMediaStream();
    let resolve!: (value: MediaStream) => void;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValue(new Promise((done) => { resolve = done; }));
    const { result, rerender } = renderHook(() => useRecording());
    if (!pending) await act(async () => { resolve(stream as unknown as MediaStream); });
    mockCompleted = true;
    rerender();
    if (pending) await act(async () => { resolve(stream as unknown as MediaStream); });
    expect(stream.getTracks()[0].stop).toHaveBeenCalled();
    expect(result.current.isAudioRecording).toBe(false);
    if (pending) expect(mockRecorderStartAudioStates).toHaveLength(0);
  });

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

  test.each([false, true])('completion stops active or pending persistent screen capture (pending=%s)', async (pending) => {
    mockGlobalStoreEnabled = true;
    mockRecordingConfig = { ...mockRecordingConfig, studyHasScreenRecording: true, currentComponentHasScreenRecording: true };
    mockStorageEngine = { saveScreenRecording: vi.fn(async () => {}) };
    const stream = new MockMediaStream();
    let resolve!: (value: MediaStream) => void;
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockReturnValue(new Promise((done) => { resolve = done; }));
    const { result, rerender } = renderHook(() => useRecording());
    act(() => { result.current.startScreenCapture(); });
    if (!pending) await act(async () => { resolve(stream as unknown as MediaStream); });
    mockCompleted = true;
    rerender();
    if (pending) await act(async () => { resolve(stream as unknown as MediaStream); });
    expect(stream.getTracks()[0].stop).toHaveBeenCalled();
    expect(result.current.isScreenCapturing).toBe(false);
    expect(result.current.isScreenRecording).toBe(false);
    const requests = vi.mocked(navigator.mediaDevices.getDisplayMedia).mock.calls.length;
    act(() => { result.current.startScreenCapture(); });
    expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalledTimes(requests);
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

  test('starts exactly one recorder when the current task receives a fresh segment key', async () => {
    mockRequireEntireScreen = true;
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      currentComponentHasScreenRecording: true,
    };
    mockStorageEngine = { saveScreenRecording: vi.fn(async () => {}) };
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockResolvedValue(
      new MockMediaStream([mockTrackFactory('monitor')]) as unknown as MediaStream,
    );
    const hook = renderHook(() => useRecording());
    act(() => { hook.result.current.startScreenCapture(); });
    await waitFor(() => expect(hook.result.current.isScreenRecording).toBe(true));
    const firstSegment = mockAssetOwner.trialAssetEntry?.key;
    const firstRecorder = MockMediaRecorder.instances[0];

    act(() => {
      mockAssetOwner.trialAssetEntry = {
        identifier: mockIdentifier,
        studyId: mockStudyId,
        key: 'intro_0__screen_retry',
        segments: [firstSegment ?? '', 'intro_0__screen_retry'],
      };
      hook.rerender();
    });

    await waitFor(() => expect(MockMediaRecorder.instances).toHaveLength(2));
    expect(firstRecorder.stop).toHaveBeenCalledOnce();
    expect(MockMediaRecorder.instances[1].start).toHaveBeenCalledOnce();
    expect(hook.result.current.isScreenRecording).toBe(true);
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

  test('stops the departing recorder before skipping an accepted non-global task', async () => {
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      currentComponentHasScreenRecording: true,
    };
    mockStorageEngine = { saveScreenRecording: vi.fn(async () => {}) };
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockResolvedValue(
      new MockMediaStream([mockTrackFactory('monitor')]) as unknown as MediaStream,
    );
    const hook = renderHook(() => useRecording());
    act(() => { hook.result.current.startScreenCapture(); });
    await waitFor(() => expect(hook.result.current.isScreenRecording).toBe(true));
    const departingRecorder = MockMediaRecorder.instances[0];

    act(() => {
      mockIdentifier = 'next_1';
      mockStoredAnswer = { endTime: 100 };
      hook.rerender();
    });

    expect(departingRecorder.state).toBe('inactive');
    expect(departingRecorder.stop).toHaveBeenCalledTimes(1);
  });

  test('records a completed non-global revisit when each visit has a fresh full-screen asset key', async () => {
    mockRequireEntireScreen = true;
    mockStoredAnswer = { endTime: 100 };
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      currentComponentHasScreenRecording: true,
    };
    mockStorageEngine = { saveScreenRecording: vi.fn(async () => {}) };
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockResolvedValue(
      new MockMediaStream([mockTrackFactory('monitor')]) as unknown as MediaStream,
    );
    const hook = renderHook(() => useRecording());
    act(() => { hook.result.current.startScreenCapture(); });
    await waitFor(() => expect(hook.result.current.isScreenRecording).toBe(true));
    expect(mockAssetOwner.trialAssetEntry?.key).toMatch(/^intro_0__screen_/);
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

// ── DataCollection disabled tests ────────────────────────────────────────────────────────

describe('useRecording with data collection disabled', () => {
  test('does not call getUserMedia/recorder/storage via audio recording', async () => {
    mockModes = { ...mockModes, dataCollectionEnabled: false };
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasAudioRecording: true,
      currentComponentHasAudioRecording: true,
    };
    mockStorageEngine = {
      saveAudioRecording: vi.fn(async () => {}),
      saveScreenRecording: vi.fn(async () => {}),
    };

    const { result } = renderHook(() => useRecording());
    await act(async () => { /* let effects settle */ });

    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(mockStorageEngine.saveAudioRecording).not.toHaveBeenCalled();
    expect(result.current.isAudioRecording).toBe(false);
  });

  test('does not call getUserMedia/getDisplayMedia/recorder/storage via startScreenCapture', async () => {
    mockModes = { ...mockModes, dataCollectionEnabled: false };
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      studyHasAudioRecording: true,
      currentComponentHasScreenRecording: true,
      currentComponentHasAudioRecording: true,
    };
    mockStorageEngine = {
      saveAudioRecording: vi.fn(async () => {}),
      saveScreenRecording: vi.fn(async () => {}),
    };

    const MediaRecorderSpy = vi.spyOn(globalThis as never, 'MediaRecorder');
    const originalTitle = document.title;
    const { result, rerender } = renderHook(() => useRecording());

    act(() => { result.current.startScreenCapture(); });
    await act(async () => { /* noop */ });

    expect(navigator.mediaDevices.getDisplayMedia).not.toHaveBeenCalled();
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();

    expect(MediaRecorderSpy).not.toHaveBeenCalled();

    expect(mockStorageEngine.saveAudioRecording).not.toHaveBeenCalled();
    expect(mockStorageEngine.saveScreenRecording).not.toHaveBeenCalled();

    expect(result.current.isScreenCapturing).toBe(false);
    expect(result.current.isAudioCapturing).toBe(false);
    expect(result.current.isMediaCapturing).toBe(false);

    expect(document.title).toBe(originalTitle);

    mockCurrentComponent = 'end';
    rerender();
    expect(result.current.isRejected).toBe(false);
  });

  test('startScreenCapture is a no-op when dataCollectionEnabled is false (does not change title, capturing flags, or set isRejected)', async () => {
    mockModes = { ...mockModes, dataCollectionEnabled: false };
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      studyHasAudioRecording: true,
      currentComponentHasScreenRecording: true,
      currentComponentHasAudioRecording: true,
    };
    mockStorageEngine = {
      saveAudioRecording: vi.fn(async () => {}),
      saveScreenRecording: vi.fn(async () => {}),
    };

    const originalTitle = document.title;
    const { result, rerender } = renderHook(() => useRecording());

    act(() => { result.current.startScreenCapture(); });
    await act(async () => { /* noop */ });

    expect(navigator.mediaDevices.getDisplayMedia).not.toHaveBeenCalled();
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();

    expect(result.current.isScreenCapturing).toBe(false);
    expect(result.current.isAudioCapturing).toBe(false);
    expect(result.current.isMediaCapturing).toBe(false);

    expect(document.title).toBe(originalTitle);

    mockCurrentComponent = 'end';
    rerender();
    expect(result.current.isRejected).toBe(false);
  });
});

describe('ScreenRecordingPermission component', () => {
  test('binds already-active screen and webcam streams when combined permission previews mount later', async () => {
    mockRequireEntireScreen = true;
    mockRecordingConfig = {
      ...mockRecordingConfig,
      studyHasScreenRecording: true,
      studyHasWebcamRecording: true,
    };
    const monitorStream = new MockMediaStream([mockTrackFactory('monitor')]);
    const webcamStream = new MockMediaStream();
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockResolvedValue(monitorStream as unknown as MediaStream);
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(webcamStream as unknown as MediaStream);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    const { result } = renderHook(() => useRecording());

    act(() => { result.current.startScreenCapture(); });
    await waitFor(() => expect(result.current.isScreenCapturing && result.current.isWebcamCapturing).toBe(true));
    expect(result.current.recordVideoRef.current).toBeNull();
    expect(result.current.webcamVideoRef.current).toBeNull();
    const attachPreview = vi.spyOn(result.current, 'attachScreenPreview');
    const attachWebcam = vi.spyOn(result.current, 'attachWebcamPreview');

    renderWithMantine(
      React.createElement(
        RecordingContext.Provider,
        { value: result.current },
        React.createElement(
          ScreenRecordingPermission,
          {
            setAnswer: vi.fn(),
            parameters: undefined,
            answers: {},
            useTrrack: vi.fn(),
            globalVariables: {},
            registerGlobalStoreUpdater: () => () => undefined,
          } as React.ComponentProps<typeof ScreenRecordingPermission>,
        ),
      ),
    );

    const preview = screen.getByText('Screen Preview').closest('div')?.querySelector('video');
    const webcamPreview = screen.getByText('Webcam Preview').closest('div')?.querySelector('video');
    expect(preview).not.toBeNull();
    expect(webcamPreview).not.toBeNull();
    expect(attachPreview).toHaveBeenCalled();
    expect(attachWebcam).toHaveBeenCalled();
    Object.defineProperty(preview!, 'srcObject', { configurable: true, writable: true, value: null });
    Object.defineProperty(preview!, 'play', { configurable: true, value: vi.fn(() => Promise.resolve()) });
    Object.defineProperty(webcamPreview!, 'srcObject', { configurable: true, writable: true, value: null });
    Object.defineProperty(webcamPreview!, 'play', { configurable: true, value: vi.fn(() => Promise.resolve()) });
    attachPreview.mockRestore();
    attachWebcam.mockRestore();
    act(() => {
      result.current.attachScreenPreview();
      result.current.attachWebcamPreview();
    });
    expect(preview!.srcObject).toBe(monitorStream);
    expect(webcamPreview!.srcObject).toBe(webcamStream);
  });

  test.each([
    { requireEntireScreen: true, expected: 'correct monitor', unexpected: 'correct tab or window' },
    { requireEntireScreen: false, expected: 'correct tab or window', unexpected: 'correct monitor' },
  ])('uses capture-mode-specific instructions when requireEntireScreen=$requireEntireScreen', ({
    requireEntireScreen, expected, unexpected,
  }) => {
    vi.spyOn(recordingHooks, 'useRecordingContext').mockReturnValue({
      studyHasAudioRecording: false,
      studyHasWebcamRecording: false,
      recordVideoRef: { current: null },
      attachScreenPreview: vi.fn(),
      webcamVideoRef: { current: null },
      attachWebcamPreview: vi.fn(),
      startScreenCapture: vi.fn(),
      stopScreenCapture: vi.fn(),
      isScreenCapturing: false,
      isAudioCapturing: false,
      isWebcamCapturing: false,
      isMediaCapturing: false,
      screenRecordingError: null,
      screenCaptureVerificationError: null,
      requireEntireScreen,
      audioRecordingError: null,
      audioMediaStream: { current: null },
    } as unknown as ReturnType<typeof recordingHooks.useRecordingContext>);

    renderWithMantine(
      React.createElement(ScreenRecordingPermission, {
        setAnswer: vi.fn(),
        parameters: undefined,
        answers: {},
        useTrrack: vi.fn(),
        globalVariables: {},
        registerGlobalStoreUpdater: () => () => undefined,
      } as React.ComponentProps<typeof ScreenRecordingPermission>),
    );

    expect(screen.getByText(new RegExp(expected))).toBeDefined();
    expect(screen.queryByText(new RegExp(unexpected))).toBeNull();
  });

  test('screen-only button is disabled when data collection is off', () => {
    mockModes = { ...mockModes, dataCollectionEnabled: false };
    const startScreenCapture = vi.fn();
    const stopScreenCapture = vi.fn();
    vi.spyOn(recordingHooks, 'useRecordingContext').mockReturnValue({
      studyHasAudioRecording: false,
      recordVideoRef: { current: null },
      attachScreenPreview: vi.fn(),
      attachWebcamPreview: vi.fn(),
      startScreenCapture,
      stopScreenCapture,
      isScreenCapturing: false,
      isAudioCapturing: false,
      audioMediaStream: { current: null },
    } as unknown as ReturnType<typeof recordingHooks.useRecordingContext>);

    renderWithMantine(
      React.createElement(ScreenRecordingPermission, {
        setAnswer: vi.fn(),
        parameters: undefined,
        answers: {},
        useTrrack: vi.fn(),
        globalVariables: {},
        registerGlobalStoreUpdater: () => () => undefined,
      } as React.ComponentProps<typeof ScreenRecordingPermission>),
    );

    const button = screen.getByRole('button', { name: 'Start Recording' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(startScreenCapture).not.toHaveBeenCalled();
    expect(stopScreenCapture).not.toHaveBeenCalled();
  });

  test('combined screen-and-audio button is disabled when data collection is off', () => {
    mockModes = { ...mockModes, dataCollectionEnabled: false };
    const startScreenCapture = vi.fn();
    const stopScreenCapture = vi.fn();
    vi.spyOn(recordingHooks, 'useRecordingContext').mockReturnValue({
      studyHasAudioRecording: true,
      recordVideoRef: { current: null },
      attachScreenPreview: vi.fn(),
      attachWebcamPreview: vi.fn(),
      startScreenCapture,
      stopScreenCapture,
      isScreenCapturing: false,
      isAudioCapturing: false,
      audioMediaStream: { current: null },
    } as unknown as ReturnType<typeof recordingHooks.useRecordingContext>);

    renderWithMantine(
      React.createElement(ScreenRecordingPermission, {
        setAnswer: vi.fn(),
        parameters: undefined,
        answers: {},
        useTrrack: vi.fn(),
        globalVariables: {},
        registerGlobalStoreUpdater: () => () => undefined,
      } as React.ComponentProps<typeof ScreenRecordingPermission>),
    );

    const button = screen.getByRole('button', { name: 'Start Recording' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(startScreenCapture).not.toHaveBeenCalled();
    expect(stopScreenCapture).not.toHaveBeenCalled();
  });
});

describe('WebcamRecordingPermission component', () => {
  test('auto-completes and disables capture when data collection is off', () => {
    mockModes = { ...mockModes, dataCollectionEnabled: false };
    const startWebcamCapture = vi.fn();
    const stopScreenCapture = vi.fn();
    const setAnswer = vi.fn();
    vi.spyOn(recordingHooks, 'useRecordingContext').mockReturnValue({
      studyHasAudioRecording: false,
      webcamVideoRef: { current: null },
      startWebcamCapture,
      stopScreenCapture,
      isWebcamCapturing: false,
      isAudioCapturing: false,
      audioMediaStream: { current: null },
    } as unknown as ReturnType<typeof recordingHooks.useRecordingContext>);

    renderWithMantine(
      React.createElement(WebcamRecordingPermission, {
        setAnswer,
        parameters: undefined,
        answers: {},
        useTrrack: vi.fn(),
        globalVariables: {},
        registerGlobalStoreUpdater: () => () => undefined,
      } as React.ComponentProps<typeof WebcamRecordingPermission>),
    );

    expect(setAnswer).toHaveBeenCalledWith(expect.objectContaining({
      status: true,
      answers: { webcamRecordingPermission: true },
    }));
    const button = screen.getByRole('button', { name: 'Start Recording' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(startWebcamCapture).not.toHaveBeenCalled();
    expect(stopScreenCapture).not.toHaveBeenCalled();
  });
});

test('a previously accepted global-store trial records its revision under a separate media key', async () => {
  mockGlobalStoreEnabled = true;
  mockGlobalRevision = 7;
  mockStoredAnswer = { endTime: 100 };
  mockRecordingConfig = { ...mockRecordingConfig, studyHasScreenRecording: true, currentComponentHasScreenRecording: true };
  mockStorageEngine = { saveScreenRecording: vi.fn(async () => {}) };
  const { result } = renderHook(() => useRecording());
  act(() => { result.current.startScreenCapture(); });
  await waitFor(() => expect(result.current.isScreenRecording).toBe(true));
  act(() => { result.current.stopScreenRecording(); });
  await waitFor(() => expect(mockStorageEngine!.saveScreenRecording).toHaveBeenCalledWith(expect.any(Blob), mockAssetOwner.trialAssetEntry!.key));
  expect(mockAssetOwner.trialAssetEntry!.key).toMatch(/^intro_0__global_/);
});

test('destination audio waits for acceptance and saves under the shared visit key', async () => {
  mockGlobalStoreEnabled = true;
  mockRecordingConfig = { ...mockRecordingConfig, studyHasAudioRecording: true, currentComponentHasAudioRecording: true };
  mockStorageEngine = { saveAudioRecording: vi.fn(async () => {}) };
  const hook = renderHook(useRecording);
  await waitFor(() => expect(hook.result.current.isAudioRecording).toBe(true));
  act(() => {
    mockGlobalStoreSubmitting = true;
    mockCurrentComponent = 'next';
    mockIdentifier = 'next_1';
    hook.rerender();
  });
  expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  expect(hook.result.current.isAudioRecording).toBe(false);
  await act(async () => { mockGlobalRevision = 1; hook.rerender(); });
  await waitFor(() => expect(hook.result.current.isAudioRecording).toBe(true));
  const { key } = mockAssetOwner.trialAssetEntry!;
  act(() => {
    mockCurrentComponent = 'end';
    mockIdentifier = 'end_2';
    mockRecordingConfig.currentComponentHasAudioRecording = false;
    hook.rerender();
  });
  expect(mockStorageEngine.saveAudioRecording).toHaveBeenLastCalledWith(expect.any(Blob), key);
});
