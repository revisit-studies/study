import * as d3 from 'd3';
import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { useEvent } from '../../store/hooks/useEvent';

export function Timer({
  width, height, updateTimer, duration, isPlaying, xScale, startTime, initialTime, onClickUpdateTimer,
}: { width: number, height: number, updateTimer: (time: number, percent: number | undefined) => void, duration: number, isPlaying: boolean, xScale: d3.ScaleLinear<number, number>, startTime: number, initialTime?: number, onClickUpdateTimer: (timeMs: number) => void }) {
  const timer = useRef<number>(0);
  const startDate = useRef<number>(Date.now());
  const [forceRerenderInt, setForceRerenderInt] = useState<number>(0);

  useEffect(() => {
    if (startTime) {
      // Initial time is the time the user wants to start at, if it's not provided, we start at the beginning
      const time = initialTime !== undefined ? initialTime : startTime;
      timer.current = time - startTime;
      updateTimer(time, (time - startTime) / duration);
    }
  }, [startTime, updateTimer, initialTime, duration]);

  const incrementTimer = useEvent(() => {
    if (timer.current >= duration) {
      return;
    }

    const temp = Date.now();

    timer.current = temp - startDate.current;
    updateTimer(startTime + timer.current, undefined);
    setForceRerenderInt(forceRerenderInt + 1);
  });

  useEffect(() => {
    // if were past the end of the timer but someone hit play, reset the timer to the beginning
    if (isPlaying && timer.current >= duration) {
      updateTimer(startTime, 0);
      startDate.current = Date.now() - timer.current;
      timer.current = 0;
    }
  }, [startTime, isPlaying, duration, updateTimer]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying && timer.current < duration) {
      startDate.current = Date.now() - timer.current;

      interval = setInterval(() => {
        if (isPlaying) {
          incrementTimer();
        }
      }, 30);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [duration, incrementTimer, isPlaying]);

  const clickOnSvg = useCallback((e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    timer.current = xScale.invert(e.clientX - 10) - xScale.domain()[0];
    startDate.current = Date.now() - timer.current;
    setForceRerenderInt(forceRerenderInt + 1);

    updateTimer(startTime + timer.current, timer.current / duration);

    onClickUpdateTimer(timer.current);
  }, [duration, forceRerenderInt, startTime, updateTimer, xScale, onClickUpdateTimer]);

  return (
    <svg
      onClick={clickOnSvg}
      style={{
        width, height, position: 'absolute', zIndex: 10000,
      }}
    >
      <line stroke="#e15759" strokeWidth={3} y1={0} y2={height} x1={xScale(startTime + timer.current)} x2={xScale(startTime + timer.current)} />
    </svg>
  );
}
