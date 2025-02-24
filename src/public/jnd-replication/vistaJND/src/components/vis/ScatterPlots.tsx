/**
 * Authors: WPI Data Visualization Team
 * Modified by: The ReVISit Team
 * Description:
 *    This file contains the functionality to create a Scatter Plot.
 */

import { scaleLinear } from 'd3-scale';
import * as d3 from 'd3';
import { axisLeft } from 'd3-axis';
import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { select } from 'd3-selection';
import { axisBottom } from 'd3';
import { generateDataSetFixed } from '../../utils/dataGeneration';

const width = 300;
const height = 300;

export default function ScatterPlots({ r, onClick } : { r: number, onClick: () => void}) {
  const d3Container = useRef(null);

  const [isHover, setIsHover] = useState<boolean>(false);
  const margin = {
    left: 40,
    top: 20,
    right: 20,
    bottom: 20,
  };

  const innerHeight = height - margin.bottom;
  const innerWidth = width - margin.left - margin.right;

  const createChart = useCallback(() => {
    const data = generateDataSetFixed(r, Date.now().toString());
    // data in format [x1,y1], [x2,y2]

    const xAry = data.map((d) => d[0]);
    const yAry = data.map((d) => d[1]);
    const xScale = scaleLinear().range([0, innerWidth]);
    const yScale = scaleLinear().range([innerHeight, 0]);
    const xAxis = axisBottom(xScale)
      .tickSize(0)
      .tickFormat(() => '');

    const yAxis = axisLeft(yScale)
      .tickSize(0);

    const svg = select(d3Container.current)
      .attr('width', width)
      .attr('height', height);

    svg.selectAll('*').remove();

    svg.append('g')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .attr('class', 'main axis date').call(xAxis);

    svg.append('g')
      .attr('class', 'main axis date').call(yAxis);
    xScale.domain([d3.min(xAry)!, d3.max(xAry)!]).range([0 + 10, innerWidth - 10]);
    yScale.domain([d3.min(yAry)!, d3.max(yAry)!]).range([innerHeight - 10, 0 + 10]);

    svg.selectAll('.dot')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      // .attr('r', Math.sqrt(8))
      .attr('r', 2)
      .attr('cx', (d) => xScale(d[0]))
      .attr('cy', (d) => yScale(d[1]))
      .style('fill', 'black');
  }, [r]);

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
        width={innerWidth}
        height={innerHeight}
        cursor="pointer"
        opacity={isHover ? 0.2 : 0.0}
        fill="cornflowerblue"
      />
    </svg>
  );
}
