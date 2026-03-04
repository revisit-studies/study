import * as d3 from 'd3';

export function getSeekTimeFromSvgPosition(
  clientX: number,
  svgLeftOffset: number,
  xScale: d3.ScaleLinear<number, number>,
) {
  const localX = clientX - svgLeftOffset;
  return xScale.invert(localX) - xScale.domain()[0];
}
