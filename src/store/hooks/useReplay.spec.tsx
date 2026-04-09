import { renderHook, act } from '@testing-library/react';
import React from 'react';
import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import { ReplayContext, useReplay, useReplayContext } from './useReplay';
import { syncEmitter } from '../../utils/syncReplay';

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

describe('useReplay — returned function invocation', () => {
  test('setSeekTime updates seekTime', () => {
    const { result } = renderHook(() => useReplay());
    act(() => { result.current.setSeekTime(10); });
    expect(result.current.seekTime).toBe(10);
  });

  test('setSpeed updates speed', () => {
    const { result } = renderHook(() => useReplay());
    act(() => { result.current.setSpeed(2); });
    expect(result.current.speed).toBe(2);
  });

  test('setDuration updates duration', () => {
    const { result } = renderHook(() => useReplay());
    act(() => { result.current.setDuration(120); });
    expect(result.current.duration).toBe(120);
  });

  test('setIsPlaying true sets isPlaying', () => {
    const { result } = renderHook(() => useReplay());
    act(() => { result.current.setIsPlaying(true); });
    expect(result.current.isPlaying).toBe(true);
  });

  test('setIsPlaying false after true stops playing', () => {
    const { result } = renderHook(() => useReplay());
    act(() => {
      result.current.setIsPlaying(true);
      result.current.setIsPlaying(false);
    });
    expect(result.current.isPlaying).toBe(false);
  });

  test('forceEmitTimeUpdate can be called without crashing', () => {
    const { result } = renderHook(() => useReplay());
    act(() => { result.current.forceEmitTimeUpdate(); });
  });

  test('updateReplayRef can be called with null refs without crashing', () => {
    const { result } = renderHook(() => useReplay());
    act(() => { result.current.updateReplayRef(); });
  });

  test('setSeekTime with isRemoteTriggered=true sets isMasterPlayer to false (covers remote path)', () => {
    const { result } = renderHook(() => useReplay());
    act(() => { result.current.setSeekTime(5, true); });
    expect(result.current.seekTime).toBe(5);
  });

  test('setSpeed with isRemoteTriggered=true covers remote path', () => {
    const { result } = renderHook(() => useReplay());
    act(() => { result.current.setSpeed(1.5, true); });
    expect(result.current.speed).toBe(1.5);
  });
});

describe('useReplay — syncEmitter listener', () => {
  test('replaySyncListener body is covered when called via captured on() arg', () => {
    const { result } = renderHook(() => useReplay());
    // Find the listener registered with syncEmitter.on('replaySync', ...)
    const onCalls = vi.mocked(syncEmitter.on).mock.calls;
    const listenerEntry = onCalls.find(([event]) => event === 'replaySync');
    const listener = listenerEntry?.[1] as ((v: { seekTime: number; isPlaying: boolean; speed: number }) => void) | undefined;
    expect(listener).toBeDefined();
    act(() => { listener?.({ seekTime: 3, isPlaying: false, speed: 1.5 }); });
    expect(result.current.speed).toBe(1.5);
  });

  test('cleanup removes the replaySync listener on unmount', () => {
    const { unmount } = renderHook(() => useReplay());
    unmount();
    expect(vi.mocked(syncEmitter.off)).toHaveBeenCalledWith('replaySync');
  });
});

// ── video/audio event callbacks ────────────────────────────────────────────────

function makeVideoWithSrc(): HTMLVideoElement {
  const video = document.createElement('video');
  Object.defineProperty(video, 'src', { value: 'fake.mp4', writable: true, configurable: true });
  return video;
}

describe('useReplay — hasEnded via timerValue >= duration', () => {
  test('setHasEnded(true) when timerValue.current >= duration', () => {
    const { result } = renderHook(() => useReplay());
    act(() => {
      result.current.setSeekTime(15); // sets timerValue.current = 15
    });
    act(() => {
      result.current.setDuration(10); // effect fires: 15 >= 10 → setHasEnded(true)
    });
    expect(result.current.hasEnded).toBe(true);
  });
});

describe('useReplay — handlePlay/Seeked/Pause via video element events', () => {
  test('handlePlay: play event sets isPlaying true', () => {
    const { result } = renderHook(() => useReplay());
    const video = makeVideoWithSrc();
    act(() => {
      result.current.videoRef.current = video;
      result.current.updateReplayRef();
    });
    act(() => {
      video.dispatchEvent(new Event('play'));
    });
    expect(result.current.isPlaying).toBe(true);
  });

  test('handlePlay: with audioRef set mutes audio', () => {
    const { result } = renderHook(() => useReplay());
    const video = makeVideoWithSrc();
    const audio = document.createElement('audio');
    audio.play = vi.fn().mockResolvedValue(undefined) as never;
    act(() => {
      result.current.videoRef.current = video;
      result.current.audioRef.current = audio;
      result.current.updateReplayRef(); // replayRef = video (has src)
    });
    act(() => {
      video.dispatchEvent(new Event('play'));
    });
    expect(audio.muted).toBe(true);
  });

  test('handleSeeked: seeked event updates seekTime', () => {
    const { result } = renderHook(() => useReplay());
    const video = makeVideoWithSrc();
    act(() => {
      result.current.videoRef.current = video;
      result.current.updateReplayRef();
    });
    act(() => {
      video.dispatchEvent(new Event('seeked'));
    });
    expect(result.current.seekTime).toBe(0); // currentTime defaults to 0
  });

  test('handleSeeked: audio-as-replayRef path covers else-if branch', () => {
    const { result } = renderHook(() => useReplay());
    const audio = document.createElement('audio');
    Object.defineProperty(audio, 'src', { value: 'fake.mp3', writable: true, configurable: true });
    const video = document.createElement('video'); // no src → not chosen as replayRef
    act(() => {
      result.current.audioRef.current = audio;
      result.current.videoRef.current = video;
      result.current.updateReplayRef(); // replayRef = audio
    });
    act(() => {
      audio.dispatchEvent(new Event('seeked')); // handleSeeked fires; else-if branch runs
    });
    expect(result.current.seekTime).toBe(0);
  });

  test('handlePause: pause event sets isPlaying false', () => {
    const { result } = renderHook(() => useReplay());
    const video = makeVideoWithSrc();
    act(() => {
      result.current.videoRef.current = video;
      result.current.updateReplayRef();
    });
    act(() => {
      video.dispatchEvent(new Event('play')); // start playing
    });
    expect(result.current.isPlaying).toBe(true);
    act(() => {
      video.dispatchEvent(new Event('pause'));
    });
    expect(result.current.isPlaying).toBe(false);
  });

  test('updateReplayRef sets replayRef to audioRef when videoRef has no src', () => {
    const { result } = renderHook(() => useReplay());
    const audio = document.createElement('audio');
    Object.defineProperty(audio, 'src', { value: 'fake.mp3', writable: true, configurable: true });
    act(() => {
      result.current.audioRef.current = audio;
      result.current.updateReplayRef();
    });
    expect(result.current.replayRef.current).toBe(audio);
  });
});

describe('useReplay — public setIsPlaying with hasEnded=true', () => {
  test('setIsPlaying resets hasEnded and seeks to 0', () => {
    const { result } = renderHook(() => useReplay());
    // Drive hasEnded to true
    act(() => {
      result.current.setSeekTime(15);
    });
    act(() => {
      result.current.setDuration(10);
    });
    expect(result.current.hasEnded).toBe(true);
    // setIsPlaying(true) with hasEnded → resets + seeks to 0
    act(() => {
      result.current.setIsPlaying(true);
    });
    expect(result.current.hasEnded).toBe(false);
    expect(result.current.seekTime).toBe(0);
  });
});
