import * as d3 from 'd3';
import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { useEvent } from '../../store/hooks/useEvent';

export function Timer({
  width, height, debounceUpdateTimer, directUpdateTimer, duration, isPlaying, xScale, startTime, initialTime, speed,
}: { width: number, height: number, debounceUpdateTimer: (time: number, percent: number | undefined) => void, directUpdateTimer: (time: number, percent: number | undefined) => void, duration: number, isPlaying: boolean, xScale: d3.ScaleLinear<number, number>, startTime: number, initialTime: number, speed: number }) {
  const timer = useRef<number>(0);
  const startDate = useRef<number>(Date.now());
  const [forceRerenderInt, setForceRerenderInt] = useState<number>(0);

  useEffect(() => {
    if (startTime) {
      // Initial time is the time the user wants to start at, if it's not provided, we start at the beginning
      const time = initialTime;
      timer.current = time - startTime;
      directUpdateTimer(time, (time - startTime) / duration);

      localStorage.setItem('currentTime', `${startTime + timer.current}_${(timer.current / duration).toString()}_${timer.current}`);
    }
  }, [startTime, directUpdateTimer, initialTime, duration]);

  const incrementTimer = useEvent(() => {
    if (timer.current >= duration) {
      return;
    }

    const temp = Date.now();

    timer.current += (temp - startDate.current) * speed;

    startDate.current = temp;
    debounceUpdateTimer(startTime + timer.current, undefined);
    setForceRerenderInt(forceRerenderInt + 1);
  });

  useEffect(() => {
    // if were past the end of the timer but someone hit play, reset the timer to the beginning
    if (isPlaying && timer.current >= duration) {
      directUpdateTimer(startTime, 0);
      startDate.current = Date.now() - timer.current;
      timer.current = 0;
    }
  }, [startTime, isPlaying, duration, directUpdateTimer]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying && timer.current < duration) {
      startDate.current = Date.now();

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

  useEffect(() => {
    const listener = (e: StorageEvent) => {
      if (e.key === 'currentTime' && e.newValue) {
        timer.current = +e.newValue.split('_')[2];
        startDate.current = Date.now();

        directUpdateTimer(+e.newValue.split('_')[0], +e.newValue.split('_')[1]);
        setForceRerenderInt(forceRerenderInt + 1);
      }
    };

    window.addEventListener('storage', listener);

    return () => window.removeEventListener('storage', listener);
  }, [directUpdateTimer, forceRerenderInt, xScale]);

  const clickOnSvg = useCallback((e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    timer.current = xScale.invert(e.clientX - 10) - xScale.domain()[0];
    startDate.current = Date.now();
    setForceRerenderInt(forceRerenderInt + 1);

    localStorage.setItem('currentTime', `${startTime + timer.current}_${(timer.current / duration)}_${timer.current}`);

    directUpdateTimer(startTime + timer.current, timer.current / duration);
  }, [directUpdateTimer, duration, forceRerenderInt, startTime, xScale]);

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
