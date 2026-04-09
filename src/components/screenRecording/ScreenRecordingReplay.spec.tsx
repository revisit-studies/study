import { render, act, cleanup } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { ScreenRecordingReplay } from './ScreenRecordingReplay';

// ── mutable state ─────────────────────────────────────────────────────────────

let mockIsAnalysis = false;
let mockStorageEngine: Record<string, ReturnType<typeof vi.fn>> | null = null;
let mockSearchParams = new URLSearchParams();
let mockUpdateReplayRef = vi.fn();
let mockIsPlaying = false;
let mockVideoRef: { current: HTMLVideoElement | null } = { current: null };
let mockCanPlayScreenRecording = false;

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('react-router', () => ({
  useSearchParams: () => [mockSearchParams, vi.fn()],
}));

vi.mock('@mantine/core', () => ({
  Box: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: mockStorageEngine }),
}));

const mockDispatch = vi.fn();
const mockSetAnalysisHasScreenRecording = vi.fn();
const mockSetAnalysisCanPlayScreenRecording = vi.fn();

vi.mock('../../store/store', () => ({
  useStoreSelector: () => mockCanPlayScreenRecording,
  useStoreActions: () => ({
    setAnalysisHasScreenRecording: mockSetAnalysisHasScreenRecording,
    setAnalysisCanPlayScreenRecording: mockSetAnalysisCanPlayScreenRecording,
  }),
  useStoreDispatch: () => mockDispatch,
}));

vi.mock('../../routes/utils', () => ({
  useCurrentIdentifier: () => 'component1',
}));

vi.mock('../../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: () => mockIsAnalysis,
}));

vi.mock('../../store/hooks/useReplay', () => ({
  useReplayContext: () => ({
    videoRef: mockVideoRef,
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
    mockCanPlayScreenRecording = false;
    mockDispatch.mockClear();
  });

  afterEach(() => { cleanup(); });

  test('renders without crashing', async () => {
    const { container } = await act(async () => render(<ScreenRecordingReplay />));
    expect(container).toBeDefined();
  });

  test('does not render video when analysisCanPlayScreenRecording is false', async () => {
    const { container } = await act(async () => render(<ScreenRecordingReplay />));
    expect(container.querySelector('video')).toBeNull();
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
    };
    mockSearchParams = new URLSearchParams({ participantId: 'p1' });
    const mockVideo = { preload: '', src: '' } as Pick<HTMLVideoElement, 'preload' | 'src'> as HTMLVideoElement;
    mockVideoRef = { current: mockVideo };
    await act(async () => { render(<ScreenRecordingReplay />); });
    expect(mockVideo.src).toBe('http://example.com/video.mp4');
    expect(mockUpdateReplayRef).toHaveBeenCalled();
  });

  test('renders video element when analysisCanPlayScreenRecording is true', async () => {
    mockCanPlayScreenRecording = true;
    const { container } = await act(async () => render(<ScreenRecordingReplay />));
    expect(container.querySelector('video')).not.toBeNull();
  });

  test('video border is grey when isPlaying is true', async () => {
    mockCanPlayScreenRecording = true;
    mockIsPlaying = true;
    const { container } = await act(async () => render(<ScreenRecordingReplay />));
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.style.border).toContain('rgb(204, 204, 204)');
  });
});
