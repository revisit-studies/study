import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { useSearchParams } from 'react-router';
import { syncChannel, syncEmitter } from '../../utils/syncReplay';
import EventEmitter from '../../utils/EventEmitter';
import { getNextSyntheticReplayTime } from './replayTimer';

function seekMedia(media: HTMLMediaElement, time: number) {
  const mediaTime = Number.isFinite(media.duration) && media.duration > 0
    ? Math.min(time, media.duration)
    : time;
  media.currentTime = mediaTime;
}

function mediaIncludesTime(media: HTMLMediaElement, time: number) {
  return !Number.isFinite(media.duration) || media.duration <= 0 || time < media.duration;
}

/**
 * Hook to subscribe to video/audio/provenance timing events for replay
 */
export function useReplay() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isMountedRef = useRef(true);

  // isMasterplayer is true for the window where play button is clicked.
  // This is set to false when the video / provenance is initiated via different tab/window
  const [isMasterPlayer, setIsMasterPlayer] = useState(true);

  const emitterRef = useRef(new EventEmitter());

  // Replay ref points to whichever is active (video preferred)
  const replayRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);

  const [seekTime, _setSeekTime] = useState(0);

  const [duration, _setDuration] = useState(0);
  const internalDuration = useRef(duration);

  const internalSpeed = useRef(1);
  const [speed, _setSpeed] = useState(1);
  const [isPlaying, _setIsPlaying] = useState(false);
  const internalIsPlaying = useRef(false);

  const updateIsPlaying = useCallback((playing: boolean) => {
    internalIsPlaying.current = playing;
    _setIsPlaying(playing);
  }, []);

  const [hasEnded, setHasEnded] = useState(false);
  const timerValue = useRef<number>(0);

  const setDuration = useCallback((d: number) => {
    _setDuration(d);
    internalDuration.current = d;
    setHasEnded(d > 0 && timerValue.current >= d);
  }, []);

  const setSpeed = useCallback((newSpeed: number, isRemoteTriggered = false) => {
    setIsMasterPlayer(!isRemoteTriggered);
    internalSpeed.current = newSpeed;
    _setSpeed(newSpeed);
    _setSeekTime(timerValue.current);
  }, []);

  const syntheticReplayTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [searchParams] = useSearchParams();
  const searchParamTimestamp = useMemo(() => searchParams.get('t') || '', [searchParams]);
  const initialTimestamp = useMemo(() => {
    if (!searchParamTimestamp) {
      return 0;
    }

    // If the searchParamTimestamp is already in milliseconds, return it
    if (!Number.isNaN(Number(searchParamTimestamp))) {
      return parseInt(searchParamTimestamp, 10) / 1000;
    }

    const hours = parseInt(searchParamTimestamp.match(/(\d+)h/)?.[1] || '0', 10);
    const minutes = parseInt(searchParamTimestamp.match(/(\d+)m/)?.[1] || '0', 10);
    const seconds = parseInt(searchParamTimestamp.match(/(\d+)s/)?.[1] || '0', 10);

    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    return totalSeconds;
  }, [searchParamTimestamp]);

  useEffect(() => {
    if (isMasterPlayer) {
      syncChannel.postMessage({
        key: 'replaySync',
        value: {
          seekTime,
          isPlaying,
          speed,
        },
      });
    }
  }, [seekTime, isPlaying, speed, isMasterPlayer]);

  useEffect(() => {
    const muted = !isMasterPlayer;
    if (videoRef.current) videoRef.current.muted = muted;
    if (audioRef.current) audioRef.current.muted = muted;
  }, [isMasterPlayer]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed]);

  const handlePlay = useCallback(() => {
    if (!isMountedRef.current) {
      return;
    }

    updateIsPlaying(true);

    const t = replayRef.current?.currentTime || 0;
    emitterRef.current.emit('play', t);

    if (videoRef.current === replayRef.current) {
      if (audioRef.current) {
        audioRef.current.muted = true;
        audioRef.current.play();
      }
    } else {
      videoRef.current?.play();
    }
  }, [updateIsPlaying]);

  const handleSeeked = useCallback(() => {
    // Media may clamp a task-level seek to its shorter duration. Keep the task
    // clock authoritative instead of allowing that seeked event to move it.
    emitterRef.current.emit('timeupdate', timerValue.current);
  }, []);

  const setSeekTime = useCallback((time: number, isRemoteTriggered = false) => {
    setIsMasterPlayer(!isRemoteTriggered);
    _setSeekTime(time);
    timerValue.current = time;
    if (videoRef.current) {
      seekMedia(videoRef.current, time);
    }
    if (audioRef.current) {
      seekMedia(audioRef.current, time);
    }
    if (
      internalIsPlaying.current
      && replayRef.current?.paused
      && mediaIncludesTime(replayRef.current, time)
    ) {
      replayRef.current.play();
    }
    emitterRef.current.emit('timeupdate', time);
    setHasEnded(internalDuration.current > 0 && time >= internalDuration.current);
  }, []);

  const handlePause = useCallback(() => {
    if (!isMountedRef.current) {
      return;
    }

    const mediaEndedBeforeTask = replayRef.current?.ended
      && internalDuration.current > 0
      && timerValue.current < internalDuration.current;
    if (mediaEndedBeforeTask) {
      return;
    }

    updateIsPlaying(false);
    _setSeekTime(timerValue.current);

    emitterRef.current.emit('pause', timerValue.current);

    if (videoRef.current === replayRef.current) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    } else {
      videoRef.current?.pause();
    }
  }, [updateIsPlaying]);

  const handleEnded = useCallback(() => {
    if (internalDuration.current > 0 && timerValue.current < internalDuration.current) {
      updateIsPlaying(true);
      return;
    }

    updateIsPlaying(false);
    setHasEnded(internalDuration.current > 0);
  }, [updateIsPlaying]);

  const forceEmitTimeUpdate = useCallback(() => {
    emitterRef.current.emit('timeupdate', timerValue.current);
  }, []);

  /**
   * Whenever either video or audio mounts, update replayRef once.
   * This avoids re-assigning on every render.
   */
  const updateReplayRef = useCallback(() => {
    const originalVideo = videoRef.current;
    const originalAudio = audioRef.current;

    if (originalVideo) {
      originalVideo.playbackRate = internalSpeed.current;
      seekMedia(originalVideo, timerValue.current);

      originalVideo.removeEventListener('play', handlePlay);
      originalVideo.removeEventListener('pause', handlePause);
      originalVideo.removeEventListener('seeked', handleSeeked);
      originalVideo.removeEventListener('ended', handleEnded);
    }

    if (originalAudio) {
      originalAudio.playbackRate = internalSpeed.current;
      seekMedia(originalAudio, timerValue.current);

      originalAudio.removeEventListener('play', handlePlay);
      originalAudio.removeEventListener('pause', handlePause);
      originalAudio.removeEventListener('seeked', handleSeeked);
      originalAudio.removeEventListener('ended', handleEnded);
    }

    replayRef.current = (videoRef.current?.src ? videoRef.current : null) ?? (audioRef.current?.src ? audioRef.current : null);

    if (replayRef.current) {
      replayRef.current.addEventListener('play', handlePlay);
      replayRef.current.addEventListener('pause', handlePause);
      replayRef.current.addEventListener('seeked', handleSeeked);
      replayRef.current.addEventListener('ended', handleEnded);
    }
    forceEmitTimeUpdate();
  }, [handlePlay, handlePause, handleSeeked, handleEnded, forceEmitTimeUpdate]);

  // this should be the only way to start video/audio
  const setIsPlaying = useCallback((playing: boolean, isRemoteTriggered = false) => {
    if (!isMountedRef.current) {
      return;
    }

    setIsMasterPlayer(!isRemoteTriggered);
    if (
      playing
      && internalDuration.current > 0
      && timerValue.current >= internalDuration.current
    ) {
      setHasEnded(false);
      setSeekTime(0);
    }
    updateIsPlaying(playing);
    if (
      playing
      && replayRef.current
      && mediaIncludesTime(replayRef.current, timerValue.current)
    ) {
      replayRef.current.play();
    } else {
      replayRef.current?.pause();
    }
  }, [setSeekTime, updateIsPlaying]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (syntheticReplayTimer.current) {
        clearInterval(syntheticReplayTimer.current);
        syntheticReplayTimer.current = null;
      }

      // Remove listeners from replayRef.current, which is where they are attached
      // by updateReplayRef. This is the element that actually has the listeners,
      // rather than videoRef/audioRef which may be different or null.
      replayRef.current?.removeEventListener('play', handlePlay);
      replayRef.current?.removeEventListener('pause', handlePause);
      replayRef.current?.removeEventListener('seeked', handleSeeked);
      replayRef.current?.removeEventListener('ended', handleEnded);
    };
  }, [handleEnded, handlePause, handlePlay, handleSeeked]);

  useEffect(() => {
    if (isPlaying) {
      let lastTickTime = Date.now();
      syntheticReplayTimer.current = setInterval(() => {
        if (!isMountedRef.current) {
          if (syntheticReplayTimer.current) {
            clearInterval(syntheticReplayTimer.current);
            syntheticReplayTimer.current = null;
          }
          return;
        }

        const now = Date.now();
        const nextTime = getNextSyntheticReplayTime(
          timerValue.current,
          lastTickTime,
          now,
          internalSpeed.current,
        );
        lastTickTime = now;
        timerValue.current = internalDuration.current > 0
          ? Math.min(nextTime, internalDuration.current)
          : nextTime;
        emitterRef.current.emit('timeupdate', timerValue.current);

        if (internalDuration.current > 0 && timerValue.current >= internalDuration.current) {
          if (syntheticReplayTimer.current) {
            clearInterval(syntheticReplayTimer.current);
            syntheticReplayTimer.current = null;
          }
          _setSeekTime(timerValue.current);
          setHasEnded(true);
          setIsPlaying(false);
        }
      }, 30);
    } else if (syntheticReplayTimer.current) {
      clearInterval(syntheticReplayTimer.current);
      syntheticReplayTimer.current = null;
    }

    return () => {
      if (syntheticReplayTimer.current) {
        clearInterval(syntheticReplayTimer.current);
        syntheticReplayTimer.current = null;
      }
    };
  }, [isPlaying, setIsPlaying]);

  const resetReplay = useCallback(() => {
    replayRef.current?.pause();
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
    if (syntheticReplayTimer.current) {
      clearInterval(syntheticReplayTimer.current);
      syntheticReplayTimer.current = null;
    }
    replayRef.current = null;
    timerValue.current = 0;
    internalDuration.current = 0;
    _setSeekTime(0);
    _setDuration(0);
    updateIsPlaying(false);
    setHasEnded(false);
    emitterRef.current.emit('timeupdate', 0);
  }, [updateIsPlaying]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const replaySyncListener = (newValue: any) => {
      const {
        seekTime: __seekTime, isPlaying: __isPlaying, speed: __speed,
      } = newValue || {};
      setIsMasterPlayer(false);
      setSpeed(__speed, true);
      setSeekTime(__seekTime, true);
      setIsPlaying(__isPlaying, true);
    };

    syncEmitter.on('replaySync', replaySyncListener);

    return () => {
      syncEmitter.off('replaySync');
    };
  }, [setIsPlaying, setSeekTime, setSpeed]);

  useEffect(() => {
    setSeekTime(initialTimestamp);
  }, [initialTimestamp, setSeekTime]);

  const replayEvent = useMemo(() => ({
    on: emitterRef.current.on.bind(emitterRef.current),
    off: emitterRef.current.off.bind(emitterRef.current),
  }), []);

  // Return a memoized object so context value is stable across renders
  const value = useMemo(
    () => ({
      replayRef,
      videoRef,
      audioRef,
      updateReplayRef,
      seekTime,
      setSeekTime,
      duration,
      setDuration,
      speed,
      setSpeed,
      isPlaying,
      setIsPlaying,
      replayEvent,
      forceEmitTimeUpdate,
      hasEnded,
      resetReplay,
    }),
    [replayEvent, seekTime, setSeekTime, duration, speed, isPlaying, setIsPlaying, updateReplayRef, setSpeed, forceEmitTimeUpdate, setDuration, hasEnded, resetReplay],
  );

  return value;
}

type ReplayContextType = ReturnType<typeof useReplay>;

export const ReplayContext = createContext<ReplayContextType | undefined>(undefined);

export function useReplayContext() {
  const context = useContext(ReplayContext);
  if (!context) {
    throw new Error('useReplayContext must be used within a ReplayProvider');
  }
  return context;
}
