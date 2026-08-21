import * as d3 from 'd3';

export function SingleTaskLabelLines({
  xScale, height, labelHeight = 0, scaleStart,
} : {height: number, xScale: d3.ScaleLinear<number, number>, labelHeight?: number, scaleStart: number}) {
  return (
    <g>
      <line stroke="gray" strokeWidth={1} x1={xScale(scaleStart) + 2} x2={xScale(scaleStart) + 2} y1={height - 45 - labelHeight} y2={height - 25} />
    </g>
  );
}
