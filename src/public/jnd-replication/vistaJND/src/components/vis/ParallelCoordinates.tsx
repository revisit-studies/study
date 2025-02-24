/**
 * Authors: WPI Data Visualization Team
 * Modified by: The ReVISit Team
 * Description:
 *    This file contains the functionality to create a Parallel Coordinates Plot.
 */

import { scaleLinear } from 'd3-scale';
import * as d3 from 'd3';
import { axisLeft } from 'd3-axis';
import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { select } from 'd3-selection';
import { generateDataSetFixed } from '../../utils/dataGeneration';

const width = 300;
const height = 300;

export default function ParallelCoordinates({ v, onClick } : { v: number, onClick: () => void}) {
  const d3Container = useRef(null);

  const [isHover, setIsHover] = useState<boolean>(false);

  const createChart = useCallback(() => {
    const data = generateDataSetFixed(v, Date.now().toString());
    // data in format [x1,y1], [x2,y2]
    const margin = {
      left: 40,
      top: 20,
      right: 20,
      bottom: 20,
    };

    // consts
    const innerHeight = height - margin.bottom;
    const innerWidth = width - margin.left - margin.right;
    const leftAry = data.map((d) => d[0]);
    const rightAry = data.map((d) => d[1]);
    const svg = select(d3Container.current);
    svg.selectAll('*').remove();

    // scale
    const leftScale = scaleLinear().range([0, innerHeight]);
    const rightScale = scaleLinear().range([0, innerHeight]);

    // domain
    leftScale.domain([d3.min(leftAry)!, d3.max(leftAry)!]).range([0, innerHeight]);
    rightScale.domain([d3.min(rightAry)!, d3.max(rightAry)!]).range([0, innerHeight]);

    // axis
    const leftAxis = axisLeft(leftScale).tickSize(0).tickValues([]);
    const rightAxis = axisLeft(rightScale).tickSize(0).tickValues([]);
    const leftAxisTransform = `translate(${margin.left},${margin.top})`;
    const rightAxisTransform = `translate(${margin.left + innerWidth},${margin.top})`;

    const addAxistoChart = (chart: d3.Selection<null, unknown, null, undefined>, selector: string, axis: d3.Axis<d3.NumberValue>, customClass: string, transform: string) => {
      chart.selectAll(selector)
        .data([0]).enter()
        .append('g')
        .attr('class', customClass);
      chart.selectAll(selector)
        .data([0]).exit()
        .remove();
      chart.selectAll(selector)
        .attr('transform', transform)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
        .call(axis as any);
    };
    // add Axis to chart
    addAxistoChart(svg, '.x.axis', leftAxis, 'x axis', leftAxisTransform);
    addAxistoChart(svg, '.y.axis', rightAxis, 'y axis', rightAxisTransform);

    // add lines
    svg.selectAll('.line')
      .data(data)
      .enter()
      .append('line')
      .style('stroke', 'grey')
      .style('stroke-width', 0.5)
      .attr('x1', margin.left)
      .attr('y1', (d) => leftScale(d[0]) + margin.top)
      .attr('x2', margin.left + innerWidth)
      .attr('y2', (d) => rightScale(d[1]) + margin.top);
  }, [v]);

  useEffect(() => {
    createChart();
  }, [createChart]);

  return (
    <svg
      className="d3-component"
      width={width}
      height={height}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
    >
      <g
        id="d3Stuff"
        ref={d3Container}
      />
      <rect
        onClick={onClick}
        x={0}
        y={0}
        width={width}
        height={height}
        cursor="pointer"
        opacity={isHover ? 0.2 : 0.0}
        fill="cornflowerblue"
      />
    </svg>
  );
}
