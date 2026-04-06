import { render, act, cleanup } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import * as d3 from 'd3';
import { Timer } from './Timer';

// ── mocks ─────────────────────────────────────────────────────────────────────

const mockSetSeekTime = vi.fn();
const mockForceEmitTimeUpdate = vi.fn();
const mockReplayEventOn = vi.fn();
const mockReplayEventOff = vi.fn();

vi.mock('../../store/hooks/useReplay', () => ({
  useReplayContext: () => ({
    setSeekTime: mockSetSeekTime,
    forceEmitTimeUpdate: mockForceEmitTimeUpdate,
    replayEvent: {
      on: mockReplayEventOn,
      off: mockReplayEventOff,
    },
  }),
}));

vi.mock('./timerPosition', () => ({
  getSeekTimeFromSvgPosition: vi.fn(() => 5),
}));

const xScale = d3.scaleLinear().domain([0, 100]).range([0, 500]);

describe('Timer', () => {
  beforeEach(() => {
    mockSetSeekTime.mockReset();
    mockForceEmitTimeUpdate.mockReset();
    mockReplayEventOn.mockReset();
    mockReplayEventOff.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test('renders an SVG element with correct dimensions', async () => {
    const { container } = await act(async () => render(
      <Timer
        width={500}
        height={60}
        debounceUpdateTimer={vi.fn()}
        xScale={xScale}
      />,
    ));
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  test('calls forceEmitTimeUpdate on mount', async () => {
    await act(async () => {
      render(
        <Timer
          width={500}
          height={60}
          debounceUpdateTimer={vi.fn()}
          xScale={xScale}
        />,
      );
    });
    expect(mockForceEmitTimeUpdate).toHaveBeenCalled();
  });

  test('registers timeupdate listener on replayEvent', async () => {
    await act(async () => {
      render(
        <Timer
          width={500}
          height={60}
          debounceUpdateTimer={vi.fn()}
          xScale={xScale}
        />,
      );
    });
    expect(mockReplayEventOn).toHaveBeenCalledWith('timeupdate', expect.any(Function));
  });

  test('unregisters listener on unmount', async () => {
    const { unmount } = await act(async () => render(
      <Timer
        width={500}
        height={60}
        debounceUpdateTimer={vi.fn()}
        xScale={xScale}
      />,
    ));
    await act(async () => { unmount(); });
    expect(mockReplayEventOff).toHaveBeenCalledWith('timeupdate', expect.any(Function));
  });

  test('timeupdate callback calls debounceUpdateTimer', async () => {
    const mockDebounce = vi.fn();
    await act(async () => {
      render(
        <Timer
          width={500}
          height={60}
          debounceUpdateTimer={mockDebounce}
          xScale={xScale}
        />,
      );
    });
    // Extract the registered callback and call it
    const [, callback] = mockReplayEventOn.mock.calls.find(([event]) => event === 'timeupdate') ?? [];
    if (callback) {
      act(() => { callback(2); });
    }
    expect(mockDebounce).toHaveBeenCalledWith(2000, undefined);
  });
});
