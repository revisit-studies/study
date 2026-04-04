import { renderHook } from '@testing-library/react';
import React from 'react';
import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import { ReplayContext, useReplay, useReplayContext } from './useReplay';

vi.mock('react-router', () => ({
  useSearchParams: vi.fn(() => [new URLSearchParams()]),
}));

vi.mock('../../utils/syncReplay', () => ({
  syncChannel: { postMessage: vi.fn() },
  syncEmitter: {
    on: vi.fn(),
    off: vi.fn(),
  },
}));

const useSearchParamsMock = await import('react-router').then((m) => m.useSearchParams) as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  useSearchParamsMock.mockReturnValue([new URLSearchParams()]);
});

describe('useReplayContext', () => {
  test('throws when used outside a ReplayContext.Provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useReplayContext())).toThrow('useReplayContext must be used within a ReplayProvider');
    consoleSpy.mockRestore();
  });

  test('returns the context value when wrapped in a provider', () => {
    const fakeValue = { seekTime: 42 } as ReturnType<typeof useReplay>;
    const wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(
      ReplayContext.Provider,
      { value: fakeValue },
      children,
    );
    const { result } = renderHook(() => useReplayContext(), { wrapper });
    expect(result.current.seekTime).toBe(42);
  });
});

describe('useReplay — initialTimestamp from search params', () => {
  test('defaults to seekTime 0 when no t param is set', () => {
    const { result } = renderHook(() => useReplay());
    expect(result.current.seekTime).toBe(0);
  });

  test('parses a numeric millisecond t param (divided by 1000 → seconds)', () => {
    useSearchParamsMock.mockReturnValue([new URLSearchParams({ t: '5000' })]);
    const { result } = renderHook(() => useReplay());
    // 5000 ms → 5 seconds; seekTime is set to initialTimestamp on mount
    expect(result.current.seekTime).toBe(5);
  });

  test('parses an hms-format t param like 1h2m3s', () => {
    useSearchParamsMock.mockReturnValue([new URLSearchParams({ t: '1h2m3s' })]);
    const { result } = renderHook(() => useReplay());
    // 1*3600 + 2*60 + 3 = 3723 seconds
    expect(result.current.seekTime).toBe(3723);
  });

  test('parses a t param with only minutes and seconds (0m30s)', () => {
    useSearchParamsMock.mockReturnValue([new URLSearchParams({ t: '0m30s' })]);
    const { result } = renderHook(() => useReplay());
    expect(result.current.seekTime).toBe(30);
  });
});

describe('useReplay — returned state defaults', () => {
  test('starts with isPlaying false and duration 0', () => {
    const { result } = renderHook(() => useReplay());
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.duration).toBe(0);
  });

  test('starts with speed 1', () => {
    const { result } = renderHook(() => useReplay());
    expect(result.current.speed).toBe(1);
  });

  test('starts with hasEnded false', () => {
    const { result } = renderHook(() => useReplay());
    expect(result.current.hasEnded).toBe(false);
  });
});
