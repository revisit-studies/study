import { render, act, cleanup } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { RecordingAudioWaveform } from '../RecordingAudioWaveform';

// ── stubs for canvas / Web Audio API (not available in jsdom) ─────────────────

const mockCtx = {
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  putImageData: vi.fn(),
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
};

const mockAnalyser = {
  fftSize: 256,
  connect: vi.fn(),
  disconnect: vi.fn(),
  getByteTimeDomainData: vi.fn((arr: Uint8Array) => arr.fill(128)),
};

const mockSource = { connect: vi.fn(), disconnect: vi.fn() };

const mockClose = vi.fn().mockResolvedValue(undefined);
const mockGetUserMedia = vi.fn();

function makeMockAudioContext() {
  return {
    state: 'running' as AudioContextState,
    createMediaStreamSource: vi.fn(() => mockSource),
    createAnalyser: vi.fn(() => mockAnalyser),
    close: mockClose,
  };
}

vi.mock('@mantine/core', () => ({
  Flex: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('RecordingAudioWaveform', () => {
  beforeEach(() => {
    mockGetUserMedia.mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] });
    vi.stubGlobal('AudioContext', vi.fn(() => makeMockAudioContext()));
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    // Make canvas.getContext return a workable mock in jsdom
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as unknown as CanvasRenderingContext2D);

    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('renders a canvas element', async () => {
    const { container } = await act(async () => render(<RecordingAudioWaveform />));
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  test('calls getUserMedia with audio:true on mount', async () => {
    await act(async () => {
      render(<RecordingAudioWaveform width={60} height={36} fps={30} />);
    });
    expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
  });

  test('shows error message when getUserMedia throws an Error', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));
    const { container } = await act(async () => render(<RecordingAudioWaveform />));
    const p = container.querySelector('p');
    expect(p).not.toBeNull();
    expect(p?.textContent).toContain('Permission denied');
  });

  test('shows generic error when a non-Error is thrown', async () => {
    mockGetUserMedia.mockRejectedValue('unexpected string error');
    const { container } = await act(async () => render(<RecordingAudioWaveform />));
    const p = container.querySelector('p');
    expect(p?.textContent).toContain('unknown error');
  });

  test('closes AudioContext on unmount', async () => {
    const { unmount } = await act(async () => render(<RecordingAudioWaveform />));
    await act(async () => { unmount(); });
    expect(mockClose).toHaveBeenCalled();
  });

  test('draw callback executes waveform rendering when RAF fires', async () => {
    // Make RAF invoke the draw callback once with a timestamp > frameInterval
    let rafFired = false;
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => {
      if (!rafFired) {
        rafFired = true;
        cb(100);
      }
      return 1;
    }));

    await act(async () => render(<RecordingAudioWaveform width={60} height={36} fps={30} />));
    expect(mockCtx.stroke).toHaveBeenCalled();
  });

  test('setupAudio returns early when canvas context is null', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    // Should render without crashing even when context is unavailable
    const { container } = await act(async () => render(<RecordingAudioWaveform />));
    expect(container.querySelector('canvas')).not.toBeNull();
  });
});
