import * as d3 from 'd3';
import { StoredAnswer } from '../../../store/types';

export function SingleTaskLabelLines({
  xScale, answer, height, labelHeight = 0,
} : {answer: StoredAnswer, height: number, xScale: d3.ScaleLinear<number, number>, labelHeight?: number}) {
  return (
    <g>
      <line stroke="gray" strokeWidth={1} x1={xScale(answer.startTime) + 2} x2={xScale(answer.startTime) + 2} y1={height - 45 - labelHeight} y2={height - 25} />
    </g>
  );
}
