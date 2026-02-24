import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { useSearchParams } from 'react-router';
import { syncChannel, syncEmitter } from '../../utils/syncReplay';
import EventEmitter from '../../utils/EventEmitter';

/**
 * Hook to subscribe to video/audio/provenance timing events for replay
 */
export function useReplay() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // isMasterplayer is true for the window where play button is clicked.
  // This is set to false when the video / provenance is initiated via different tab/window
  const [isMasterPlayer, setIsMasterPlayer] = useState(true);

  const emitterRef = useRef(new EventEmitter());

  // Replay ref points to whichever is active (video preferred)
  const replayRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);

  const [seekTime, _setSeekTime] = useState(0);

  const playTimeStamp = useRef(Date.now());

  const [duration, _setDuration] = useState(0);
  const internalDuration = useRef(duration);

  const internalSpeed = useRef(1);
  const [speed, _setSpeed] = useState(1);
  const [isPlaying, _setIsPlaying] = useState(false);

  const [hasEnded, setHasEnded] = useState(false);

  const setDuration = useCallback((d: number) => {
    _setDuration(d);
    internalDuration.current = d;
  }, []);

  const timerValue = useRef<number>(0);

  useEffect(() => {
    if (duration > 0 && (timerValue.current >= duration || (replayRef.current && timerValue.current >= replayRef.current.duration))) {
      setHasEnded(true);
    }
  }, [duration, isPlaying]);

  const setSpeed = useCallback((newSpeed: number, isRemoteTriggered = false) => {
    setIsMasterPlayer(!isRemoteTriggered);
    internalSpeed.current = newSpeed;
    _setSpeed(newSpeed);
    _setSeekTime(replayRef.current?.currentTime || timerValue.current);
  }, []);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

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
    _setIsPlaying(true);

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

    const elem = replayRef.current;
    if (elem) {
      timer.current = setInterval(() => {
        emitterRef.current.emit('timeupdate', elem.currentTime);
      }, 30);
    }
  }, []);

  const handleSeeked = useCallback(() => {
    const t = replayRef.current?.currentTime || 0;
    _setSeekTime(t);

    emitterRef.current.emit('timeupdate', t);
    if (videoRef.current === replayRef.current) {
      if (audioRef.current) {
        audioRef.current.currentTime = t;
      }
    } else if (videoRef.current) {
      videoRef.current.currentTime = t;
    }
  }, []);

  const setSeekTime = useCallback((time: number, isRemoteTriggered = false) => {
    setIsMasterPlayer(!isRemoteTriggered);
    _setSeekTime(time);
    playTimeStamp.current = Date.now();
    if (replayRef.current) {
      replayRef.current.currentTime = time;
    }
    emitterRef.current.emit('timeupdate', time);
    timerValue.current = time;
    setHasEnded(false);
  }, []);

  const handlePause = useCallback(() => {
    _setIsPlaying(false);

    timer.current && clearInterval(timer.current);
    const t = replayRef.current?.currentTime || 0;
    emitterRef.current.emit('pause', t);
    timerValue.current = t;

    if (videoRef.current === replayRef.current) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    } else {
      videoRef.current?.pause();
    }
  }, []);

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
      originalVideo.currentTime = initialTimestamp;

      originalVideo.removeEventListener('play', handlePlay);
      originalVideo.removeEventListener('pause', handlePause);
      originalVideo.removeEventListener('seeked', handleSeeked);
    }

    if (originalAudio) {
      originalAudio.playbackRate = internalSpeed.current;
      originalAudio.currentTime = initialTimestamp;

      originalAudio.removeEventListener('play', handlePlay);
      originalAudio.removeEventListener('pause', handlePause);
      originalAudio.removeEventListener('seeked', handleSeeked);
    }

    replayRef.current = (videoRef.current?.src ? videoRef.current : null) ?? (audioRef.current?.src ? audioRef.current : null);

    if (replayRef.current) {
      replayRef.current.addEventListener('play', handlePlay);
      replayRef.current.addEventListener('pause', handlePause);
      replayRef.current.addEventListener('seeked', handleSeeked);
    }
    forceEmitTimeUpdate();
  }, [handlePlay, handlePause, handleSeeked, initialTimestamp, forceEmitTimeUpdate]);

  // this should be the only way to start video/audio
  const setIsPlaying = useCallback((playing: boolean, isRemoteTriggered = false) => {
    setIsMasterPlayer(!isRemoteTriggered);
    if (hasEnded) {
      setHasEnded(false);
      setSeekTime(0);
    }
    _setIsPlaying(playing);
    if (playing) {
      replayRef.current?.play();
    } else {
      replayRef.current?.pause();
    }
  }, [hasEnded, setSeekTime]);

  useEffect(() => {
    if (isPlaying) {
      playTimeStamp.current = Date.now();
    } else {
      _setSeekTime((t) => {
        const diff = ((Date.now() - playTimeStamp.current) * internalSpeed.current) / 1000; // issue
        const ctime = diff < 0.5 ? t : t + diff;
        if (replayRef.current) {
          replayRef.current.currentTime = ctime;
        }
        return ctime;
      });
    }

    // setup timer to emit events if both video and audio aren't present.
    if (!audioRef.current && !videoRef.current) {
      if (isPlaying) {
        const startTime = Date.now();
        const timerStartValue = timerValue.current;
        timer.current = setInterval(() => {
          timerValue.current = timerStartValue + ((Date.now() - startTime) * internalSpeed.current) / 1000;
          emitterRef.current.emit('timeupdate', timerValue.current);
          if (timerValue.current >= internalDuration.current) {
            setIsPlaying(false);
          }
        }, 30);
      } else {
        timer.current && clearInterval(timer.current);
      }
    }
  }, [isPlaying, setIsPlaying]);

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
