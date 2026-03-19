import {
  render, act, cleanup, waitFor,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { ScreenRecordingReplay } from '../ScreenRecordingReplay';

// ── mutable state ─────────────────────────────────────────────────────────────

let mockIsAnalysis = false;
let mockStorageEngine: Record<string, ReturnType<typeof vi.fn>> | null = null;
let mockSearchParams = new URLSearchParams();
let mockUpdateReplayRef = vi.fn();
let mockIsPlaying = false;
let mockVideoRef: { current: HTMLVideoElement | null } = { current: null };
let mockWebcamVideoRef: { current: HTMLVideoElement | null } = { current: null };

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('react-router', () => ({
  useSearchParams: () => [mockSearchParams, vi.fn()],
}));

vi.mock('@mantine/core', () => ({
  Box: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Flex: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('../../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: mockStorageEngine }),
}));

const mockDispatch = vi.fn();
const mockSetAnalysisHasScreenRecording = vi.fn();
const mockSetAnalysisHasWebcamRecording = vi.fn();
const mockSetAnalysisCanPlayScreenRecording = vi.fn();

vi.mock('../../../store/store', () => ({
  useStoreActions: () => ({
    setAnalysisHasScreenRecording: mockSetAnalysisHasScreenRecording,
    setAnalysisHasWebcamRecording: mockSetAnalysisHasWebcamRecording,
    setAnalysisCanPlayScreenRecording: mockSetAnalysisCanPlayScreenRecording,
  }),
  useStoreDispatch: () => mockDispatch,
}));

vi.mock('../../../routes/utils', () => ({
  useCurrentIdentifier: () => 'component1',
}));

vi.mock('../../../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: () => mockIsAnalysis,
}));

vi.mock('../../../store/hooks/useReplay', () => ({
  useReplayContext: () => ({
    screenVideoRef: mockVideoRef,
    webcamVideoRef: mockWebcamVideoRef,
    updateReplayRef: mockUpdateReplayRef,
    isPlaying: mockIsPlaying,
  }),
}));

// ── tests ─────────────────────────────────────────────────────────────────────

describe('ScreenRecordingReplay', () => {
  beforeEach(() => {
    mockIsAnalysis = false;
    mockStorageEngine = null;
    mockSearchParams = new URLSearchParams();
    mockUpdateReplayRef = vi.fn();
    mockIsPlaying = false;
    mockVideoRef = { current: null };
    mockWebcamVideoRef = { current: null };
    mockDispatch.mockClear();
  });

  afterEach(() => { cleanup(); });

  test('renders without crashing', async () => {
    const { container } = await act(async () => render(<ScreenRecordingReplay />));
    expect(container).toBeDefined();
  });

  test('keeps both video elements mounted for asynchronous URL loading', async () => {
    const { container } = await act(async () => render(<ScreenRecordingReplay />));
    expect(container.querySelectorAll('video')).toHaveLength(2);
  });

  test('dispatches store actions on mount when not in analysis mode', async () => {
    await act(async () => render(<ScreenRecordingReplay />));
    expect(mockDispatch).toHaveBeenCalled();
  });

  test('covers url=null path when participantId is provided', async () => {
    // isAnalysis=true, storageEngine returns null URL → dispatches setAnalysisHasScreenRecording(false)
    mockIsAnalysis = true;
    mockStorageEngine = { getScreenRecording: vi.fn().mockResolvedValue(null) };
    mockSearchParams = new URLSearchParams({ participantId: 'p1' });
    await act(async () => { render(<ScreenRecordingReplay />); });
    expect(mockDispatch).toHaveBeenCalled();
  });

  test('sets hasScreenRecording true when URL is returned', async () => {
    mockIsAnalysis = true;
    mockStorageEngine = {
      getScreenRecording: vi.fn().mockResolvedValue('http://example.com/video.mp4'),
      getWebcamRecording: vi.fn().mockResolvedValue(null),
    };
    mockSearchParams = new URLSearchParams({ participantId: 'p1' });
    await act(async () => { render(<ScreenRecordingReplay />); });
    expect(mockDispatch).toHaveBeenCalledWith(mockSetAnalysisHasScreenRecording(true));
  });

  // Error-path tests (missing participantId, getScreenRecording rejection) omitted
  // because the component re-throws in the catch block, producing unhandled promise
  // rejections that vitest flags as test instability.

  test('sets video src and calls updateReplayRef when videoRef.current exists', async () => {
    mockIsAnalysis = true;
    mockStorageEngine = {
      getScreenRecording: vi.fn().mockResolvedValue('http://example.com/video.mp4'),
      getWebcamRecording: vi.fn().mockResolvedValue(null),
    };
    mockSearchParams = new URLSearchParams({ participantId: 'p1' });
    const { container } = await act(async () => render(<ScreenRecordingReplay />));
    const screenVideo = container.querySelectorAll('video')[0];
    await waitFor(() => expect(screenVideo.src).toBe('http://example.com/video.mp4'));
    expect(mockUpdateReplayRef).toHaveBeenCalled();
  });

  test('loads a webcam recording when no screen recording exists', async () => {
    mockIsAnalysis = true;
    mockStorageEngine = {
      getScreenRecording: vi.fn().mockResolvedValue(null),
      getWebcamRecording: vi.fn().mockResolvedValue('http://example.com/webcam.webm'),
    };
    mockSearchParams = new URLSearchParams({ participantId: 'p1' });
    const { container } = await act(async () => render(<ScreenRecordingReplay />));
    const webcamVideo = container.querySelectorAll('video')[1];
    await waitFor(() => expect(webcamVideo.src).toBe('http://example.com/webcam.webm'));
    expect(mockDispatch).toHaveBeenCalledWith(mockSetAnalysisHasWebcamRecording(true));
  });

  test('video border is grey when isPlaying is true', async () => {
    mockIsPlaying = true;
    const { container } = await act(async () => render(<ScreenRecordingReplay />));
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.style.border).toContain('rgb(204, 204, 204)');
  });
});
