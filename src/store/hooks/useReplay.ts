import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { useSearchParams } from 'react-router';
import { syncChannel, syncEmitter } from '../../utils/syncReplay';
import EventEmitter from '../../utils/EventEmitter';
import { getNextSyntheticReplayTime } from './replayTimer';

type ReplayMediaElement = HTMLVideoElement | HTMLAudioElement;

/**
 * Hook to subscribe to video/audio/provenance timing events for replay
 */
export function useReplay() {
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // isMasterPlayer is true for the window where play button is clicked.
  // This is set to false when the video / provenance is initiated via different tab/window
  const [isMasterPlayer, setIsMasterPlayer] = useState(true);

  const emitterRef = useRef(new EventEmitter());

  // Replay ref points to the preferred active media element (screen, then webcam, then audio).
  const replayRef = useRef<ReplayMediaElement | null>(null);

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

  const getActiveMediaElements = useCallback((): ReplayMediaElement[] => (
    [screenVideoRef.current, webcamVideoRef.current, audioRef.current]
      .filter((element): element is ReplayMediaElement => !!element && !!element.src)
  ), []);

  const getSecondaryMediaElements = useCallback((): ReplayMediaElement[] => (
    getActiveMediaElements().filter((element) => element !== replayRef.current)
  ), [getActiveMediaElements]);

  const syncSecondaryMediaToMaster = useCallback((targetTime?: number) => {
    const master = replayRef.current;
    const masterTime = targetTime ?? master?.currentTime ?? timerValue.current;

    getSecondaryMediaElements().forEach((element) => {
      if (Math.abs(element.currentTime - masterTime) > 0.15) {
        element.currentTime = masterTime;
      }
    });
  }, [getSecondaryMediaElements]);

  const updateMutedState = useCallback(() => {
    const master = replayRef.current;

    if (screenVideoRef.current) {
      screenVideoRef.current.muted = !isMasterPlayer || master !== screenVideoRef.current;
    }

    if (webcamVideoRef.current) {
      webcamVideoRef.current.muted = true;
    }

    if (audioRef.current) {
      const replayingScreenWithAudio = master === screenVideoRef.current;
      audioRef.current.muted = !isMasterPlayer || replayingScreenWithAudio;
    }
  }, [isMasterPlayer]);

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
    playTimeStamp.current = Date.now();
  }, []);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [searchParams] = useSearchParams();
  const searchParamTimestamp = useMemo(() => searchParams.get('t') || '', [searchParams]);
  const initialTimestamp = useMemo(() => {
    if (!searchParamTimestamp) {
      return 0;
    }

    if (!Number.isNaN(Number(searchParamTimestamp))) {
      return parseInt(searchParamTimestamp, 10) / 1000;
    }

    const hours = parseInt(searchParamTimestamp.match(/(\d+)h/)?.[1] || '0', 10);
    const minutes = parseInt(searchParamTimestamp.match(/(\d+)m/)?.[1] || '0', 10);
    const seconds = parseInt(searchParamTimestamp.match(/(\d+)s/)?.[1] || '0', 10);

    return hours * 3600 + minutes * 60 + seconds;
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
    getActiveMediaElements().forEach((element) => {
      element.playbackRate = speed;
    });
  }, [getActiveMediaElements, speed]);

  const handlePlay = useCallback(() => {
    _setIsPlaying(true);

    const t = replayRef.current?.currentTime || 0;
    emitterRef.current.emit('play', t);
    syncSecondaryMediaToMaster(t);
    updateMutedState();

    getSecondaryMediaElements().forEach((element) => {
      element.play().catch(() => undefined);
    });

    const elem = replayRef.current;
    if (elem) {
      timer.current = setInterval(() => {
        syncSecondaryMediaToMaster(elem.currentTime);
        emitterRef.current.emit('timeupdate', elem.currentTime);
      }, 30);
    }
  }, [getSecondaryMediaElements, syncSecondaryMediaToMaster, updateMutedState]);

  const handleSeeked = useCallback(() => {
    const t = replayRef.current?.currentTime || 0;
    _setSeekTime(t);

    syncSecondaryMediaToMaster(t);
    emitterRef.current.emit('timeupdate', t);
  }, [syncSecondaryMediaToMaster]);

  const setSeekTime = useCallback((time: number, isRemoteTriggered = false) => {
    setIsMasterPlayer(!isRemoteTriggered);
    _setSeekTime(time);
    playTimeStamp.current = Date.now();
    if (replayRef.current) {
      replayRef.current.currentTime = time;
    }
    syncSecondaryMediaToMaster(time);
    emitterRef.current.emit('timeupdate', time);
    timerValue.current = time;
    setHasEnded(false);
  }, [syncSecondaryMediaToMaster]);

  const handlePause = useCallback(() => {
    _setIsPlaying(false);

    if (timer.current) {
      clearInterval(timer.current);
    }
    const t = replayRef.current?.currentTime || 0;
    emitterRef.current.emit('pause', t);
    timerValue.current = t;

    getSecondaryMediaElements().forEach((element) => {
      element.pause();
    });
  }, [getSecondaryMediaElements]);

  const forceEmitTimeUpdate = useCallback(() => {
    emitterRef.current.emit('timeupdate', timerValue.current);
  }, []);

  const updateReplayRef = useCallback(() => {
    const mediaElements = getActiveMediaElements();

    mediaElements.forEach((element) => {
      element.playbackRate = internalSpeed.current;
      element.currentTime = initialTimestamp;
      element.removeEventListener('play', handlePlay);
      element.removeEventListener('pause', handlePause);
      element.removeEventListener('seeked', handleSeeked);
    });

    replayRef.current = (screenVideoRef.current?.src ? screenVideoRef.current : null)
      ?? (webcamVideoRef.current?.src ? webcamVideoRef.current : null)
      ?? (audioRef.current?.src ? audioRef.current : null);

    if (replayRef.current) {
      replayRef.current.addEventListener('play', handlePlay);
      replayRef.current.addEventListener('pause', handlePause);
      replayRef.current.addEventListener('seeked', handleSeeked);
    }

    updateMutedState();
    syncSecondaryMediaToMaster(initialTimestamp);
    forceEmitTimeUpdate();
  }, [
    forceEmitTimeUpdate,
    getActiveMediaElements,
    handlePause,
    handlePlay,
    handleSeeked,
    initialTimestamp,
    syncSecondaryMediaToMaster,
    updateMutedState,
  ]);

  const setIsPlaying = useCallback((playing: boolean, isRemoteTriggered = false) => {
    setIsMasterPlayer(!isRemoteTriggered);
    if (hasEnded) {
      setHasEnded(false);
      setSeekTime(0);
    }
    _setIsPlaying(playing);
    if (playing) {
      replayRef.current?.play().catch(() => undefined);
    } else {
      replayRef.current?.pause();
    }
  }, [hasEnded, setSeekTime]);

  useEffect(() => {
    if (isPlaying) {
      playTimeStamp.current = Date.now();
    } else {
      _setSeekTime((t) => {
        const diff = ((Date.now() - playTimeStamp.current) * internalSpeed.current) / 1000;
        const currentTime = diff < 0.5 ? t : t + diff;
        if (replayRef.current) {
          replayRef.current.currentTime = currentTime;
        }
        syncSecondaryMediaToMaster(currentTime);
        return currentTime;
      });
    }

    if (!audioRef.current && !screenVideoRef.current && !webcamVideoRef.current) {
      if (isPlaying) {
        let lastTickTime = Date.now();
        timer.current = setInterval(() => {
          const now = Date.now();
          timerValue.current = getNextSyntheticReplayTime(
            timerValue.current,
            lastTickTime,
            now,
            internalSpeed.current,
          );
          lastTickTime = now;
          emitterRef.current.emit('timeupdate', timerValue.current);
          if (timerValue.current >= internalDuration.current) {
            setIsPlaying(false);
          }
        }, 30);
      } else if (timer.current) {
        clearInterval(timer.current);
      }
    }
  }, [isPlaying, setIsPlaying, syncSecondaryMediaToMaster]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const replaySyncListener = (newValue: any) => {
      const {
        seekTime: remoteSeekTime, isPlaying: remoteIsPlaying, speed: remoteSpeed,
      } = newValue || {};
      setIsMasterPlayer(false);
      setSpeed(remoteSpeed, true);
      setSeekTime(remoteSeekTime, true);
      setIsPlaying(remoteIsPlaying, true);
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

  const value = useMemo(
    () => ({
      replayRef,
      videoRef: screenVideoRef,
      screenVideoRef,
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
    [
      replayEvent,
      seekTime,
      setSeekTime,
      duration,
      speed,
      isPlaying,
      setIsPlaying,
      updateReplayRef,
      setSpeed,
      forceEmitTimeUpdate,
      setDuration,
      hasEnded,
    ],
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
