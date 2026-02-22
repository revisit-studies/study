import * as d3 from 'd3';
import {
  useCallback, useEffect, useRef,
} from 'react';
import { useReplayContext } from '../../store/hooks/useReplay';

export function Timer({
  width,
  height,
  debounceUpdateTimer,
  xScale,
}: {
  width: number;
  height: number;
  debounceUpdateTimer: (time: number, percent: number | undefined) => void;
  xScale: d3.ScaleLinear<number, number>;
}) {
  const timerRef = useRef<SVGLineElement | null>(null);

  const { setSeekTime, replayEvent, forceEmitTimeUpdate } = useReplayContext();

  useEffect(() => {
    const onTimeUpdate = (t: number) => {
      if (timerRef.current) {
        const x = xScale(t);
        const d3Line = d3.select(timerRef.current);
        d3Line.attr('x1', x).attr('x2', x);
      }
      debounceUpdateTimer(t * 1000, undefined);
    };
    replayEvent.on('timeupdate', onTimeUpdate);
    forceEmitTimeUpdate();
    return () => {
      replayEvent.off('timeupdate', onTimeUpdate);
    };
  }, [replayEvent, xScale, debounceUpdateTimer, forceEmitTimeUpdate]);

  useEffect(() => {
    forceEmitTimeUpdate();
  }, [forceEmitTimeUpdate]);

  const clickOnSvg = useCallback(
    (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
      setSeekTime(xScale.invert(e.clientX) - xScale.domain()[0]);
    },
    [xScale, setSeekTime],
  );

  return (
    <svg
      onClick={clickOnSvg}
      style={{
        width, height, position: 'absolute', zIndex: 10000,
      }}
    >
      <line ref={timerRef} stroke="#e15759" strokeWidth={3} y1={0} y2={height} />
    </svg>
  );
}
