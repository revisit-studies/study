import * as d3 from 'd3';
import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { useEvent } from '../../store/hooks/useEvent';

export function Timer({
  width, height, updateTimer, duration, isPlaying, xScale, startTime,
}: { width: number, height: number, updateTimer: (time: number, percent: number | undefined) => void, duration: number, isPlaying: boolean, xScale: d3.ScaleLinear<number, number>, startTime: number }) {
  const timer = useRef<number>(0);
  const startDate = useRef<number>(Date.now());
  const [forceRerenderInt, setForceRerenderInt] = useState<number>(0);

  useEffect(() => {
    if (startTime) {
      timer.current = 0;
      updateTimer(startTime, 0);
    }
  }, [startTime, updateTimer]);

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
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying) {
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
  }, [incrementTimer, isPlaying]);

  const clickOnSvg = useCallback((e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    timer.current = xScale.invert(e.clientX - 10) - xScale.domain()[0];
    startDate.current = Date.now() - timer.current;
    setForceRerenderInt(forceRerenderInt + 1);

    updateTimer(startTime + timer.current, timer.current / duration);
  }, [duration, forceRerenderInt, startTime, updateTimer, xScale]);

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
