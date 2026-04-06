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
  useStoreSelector: (selector: (s: Record<string, unknown>) => unknown) => selector({
    analysisCanPlayScreenRecording: false,
  }),
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
    videoRef: { current: null },
    updateReplayRef: mockUpdateReplayRef,
    isPlaying: false,
  }),
}));

// ── tests ─────────────────────────────────────────────────────────────────────

describe('ScreenRecordingReplay', () => {
  beforeEach(() => {
    mockIsAnalysis = false;
    mockStorageEngine = null;
    mockSearchParams = new URLSearchParams();
    mockUpdateReplayRef = vi.fn();
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

  test('covers url truthy path (setAnalysisHasScreenRecording(true)) when participantId is provided', async () => {
    // isAnalysis=true, storageEngine returns a URL → covers line 54
    mockIsAnalysis = true;
    mockStorageEngine = {
      getScreenRecording: vi.fn().mockResolvedValue('http://example.com/video.mp4'),
    };
    mockSearchParams = new URLSearchParams({ participantId: 'p1' });
    await act(async () => { render(<ScreenRecordingReplay />); });
    expect(mockDispatch).toHaveBeenCalled();
  });
});
