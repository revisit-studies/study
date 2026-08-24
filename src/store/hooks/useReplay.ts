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

function hasMediaSource(media: HTMLMediaElement) {
  const sourceAttribute = media.getAttribute('src');
  if (sourceAttribute !== null) {
    return !!sourceAttribute;
  }
  return !!media.src
    && media.src !== document.baseURI
    && media.src !== window.location.href;
}

/**
 * Hook to subscribe to video/audio/provenance timing events for replay
 */
export function useReplay() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
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
  const timerValue = useRef<number>(0);

  const getMediaElements = useCallback(() => (
    [videoRef.current, webcamVideoRef.current, audioRef.current]
      .filter((media): media is HTMLMediaElement => !!media)
  ), []);

  const getActiveMediaElements = useCallback(() => (
    getMediaElements().filter(hasMediaSource)
  ), [getMediaElements]);

  const getSecondaryMediaElements = useCallback(() => (
    getActiveMediaElements().filter((media) => media !== replayRef.current)
  ), [getActiveMediaElements]);

  const updateMutedState = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMasterPlayer || replayRef.current !== videoRef.current;
    }
    if (webcamVideoRef.current) {
      webcamVideoRef.current.muted = true;
    }
    if (audioRef.current) {
      audioRef.current.muted = !isMasterPlayer || replayRef.current === videoRef.current;
    }
  }, [isMasterPlayer]);

  const updateIsPlaying = useCallback((playing: boolean) => {
    internalIsPlaying.current = playing;
    _setIsPlaying(playing);
  }, []);

  const requestReplayPlayback = useCallback((media: HTMLMediaElement) => {
    const handlePlaybackFailure = () => {
      if (isMountedRef.current && replayRef.current === media) {
        updateIsPlaying(false);
        emitterRef.current.emit('pause', timerValue.current);
      }
    };

    try {
      media.play().catch(handlePlaybackFailure);
    } catch {
      handlePlaybackFailure();
    }
  }, [updateIsPlaying]);

  const [hasEnded, setHasEnded] = useState(false);

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
    updateMutedState();
  }, [updateMutedState]);

  useEffect(() => {
    getMediaElements().forEach((media) => {
      media.playbackRate = speed;
    });
  }, [getMediaElements, speed]);

  const handlePlay = useCallback(() => {
    if (!isMountedRef.current) {
      return;
    }

    updateIsPlaying(true);

    const t = replayRef.current?.currentTime || 0;
    getSecondaryMediaElements().forEach((media) => {
      seekMedia(media, timerValue.current);
    });
    emitterRef.current.emit('play', t);

    updateMutedState();
    getSecondaryMediaElements().forEach((media) => {
      media.play().catch(() => undefined);
    });
  }, [getSecondaryMediaElements, updateIsPlaying, updateMutedState]);

  const handleSeeked = useCallback(() => {
    // Media may clamp a task-level seek to its shorter duration. Keep the task
    // clock authoritative instead of allowing that seeked event to move it.
    emitterRef.current.emit('timeupdate', timerValue.current);
  }, []);

  const setSeekTime = useCallback((time: number, isRemoteTriggered = false) => {
    setIsMasterPlayer(!isRemoteTriggered);
    _setSeekTime(time);
    timerValue.current = time;
    getMediaElements().forEach((media) => seekMedia(media, time));
    if (
      internalIsPlaying.current
      && replayRef.current?.paused
      && mediaIncludesTime(replayRef.current, time)
    ) {
      requestReplayPlayback(replayRef.current);
    }
    emitterRef.current.emit('timeupdate', time);
    setHasEnded(internalDuration.current > 0 && time >= internalDuration.current);
  }, [getMediaElements, requestReplayPlayback]);

  const handlePause = useCallback(() => {
    if (!isMountedRef.current) {
      return;
    }

    const mediaUnavailableBeforeTaskEnd = replayRef.current
      && internalIsPlaying.current
      && internalDuration.current > 0
      && timerValue.current < internalDuration.current
      && (replayRef.current.ended || !mediaIncludesTime(replayRef.current, timerValue.current));
    if (mediaUnavailableBeforeTaskEnd) {
      return;
    }

    updateIsPlaying(false);
    _setSeekTime(timerValue.current);

    emitterRef.current.emit('pause', timerValue.current);

    getSecondaryMediaElements().forEach((media) => media.pause());
  }, [getSecondaryMediaElements, updateIsPlaying]);

  const handleEnded = useCallback(() => {
    const mediaTime = replayRef.current?.currentTime;
    if (typeof mediaTime === 'number' && mediaTime > timerValue.current) {
      timerValue.current = Math.min(mediaTime, internalDuration.current || mediaTime);
      emitterRef.current.emit('timeupdate', timerValue.current);
    }

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
    const previousReplay = replayRef.current;
    const mediaElements = getMediaElements();

    previousReplay?.removeEventListener('play', handlePlay);
    previousReplay?.removeEventListener('pause', handlePause);
    previousReplay?.removeEventListener('seeked', handleSeeked);
    previousReplay?.removeEventListener('ended', handleEnded);

    mediaElements.forEach((media) => {
      media.playbackRate = internalSpeed.current;
      seekMedia(media, timerValue.current);
    });

    replayRef.current = (videoRef.current && hasMediaSource(videoRef.current) ? videoRef.current : null)
      ?? (audioRef.current && hasMediaSource(audioRef.current) ? audioRef.current : null)
      ?? (webcamVideoRef.current && hasMediaSource(webcamVideoRef.current) ? webcamVideoRef.current : null);

    if (previousReplay !== replayRef.current && internalIsPlaying.current) {
      getMediaElements().forEach((media) => media.pause());
      updateIsPlaying(false);
    }

    if (replayRef.current) {
      replayRef.current.addEventListener('play', handlePlay);
      replayRef.current.addEventListener('pause', handlePause);
      replayRef.current.addEventListener('seeked', handleSeeked);
      replayRef.current.addEventListener('ended', handleEnded);
    }
    updateMutedState();
    forceEmitTimeUpdate();
  }, [forceEmitTimeUpdate, getMediaElements, handleEnded, handlePause, handlePlay, handleSeeked, updateIsPlaying, updateMutedState]);

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
      requestReplayPlayback(replayRef.current);
    } else {
      getActiveMediaElements().forEach((media) => media.pause());
    }
  }, [getActiveMediaElements, requestReplayPlayback, setSeekTime, updateIsPlaying]);

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
        const media = replayRef.current;
        const mediaIsAvailable = media
          && !media.ended
          && mediaIncludesTime(media, timerValue.current);
        const nextTime = mediaIsAvailable
          ? Math.max(timerValue.current, media.currentTime)
          : getNextSyntheticReplayTime(
            timerValue.current,
            lastTickTime,
            now,
            internalSpeed.current,
          );
        lastTickTime = now;
        timerValue.current = internalDuration.current > 0
          ? Math.min(nextTime, internalDuration.current)
          : nextTime;
        getSecondaryMediaElements().forEach((secondary) => {
          if (!Number.isFinite(secondary.currentTime)
            || Math.abs(secondary.currentTime - timerValue.current) > 0.15) {
            seekMedia(secondary, timerValue.current);
          }
        });
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
  }, [getSecondaryMediaElements, isPlaying, setIsPlaying]);

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
      screenVideoRef: videoRef,
      webcamVideoRef,
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
    }),
    [replayEvent, seekTime, setSeekTime, duration, speed, isPlaying, setIsPlaying, updateReplayRef, setSpeed, forceEmitTimeUpdate, setDuration, hasEnded],
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
