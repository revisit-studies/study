/**
 * Authors: WPI Data Visualization Team
 * Modified by: The ReVISit Team
 * Description:
 *    This file contains the functionality to create a Hexbin Plot.
 */

import { scaleLinear } from 'd3-scale';
import * as d3 from 'd3';
import { hexbin } from 'd3-hexbin';
import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { select } from 'd3-selection';
import { generateDataSetFixed } from '../../utils/dataGeneration';

const width = 300;
const height = 300;

export default function HexbinPlots({ r, onClick } : { r: number, onClick: () => void }) {
  const d3Container = useRef(null);

  const [isHover, setIsHover] = useState<boolean>(false);

  const createChart = useCallback(() => {
    const data: [number, number][] = generateDataSetFixed(r, Date.now().toString(), 1000) as [number, number][];
    const margin = {
      left: 0,
      top: 20,
      right: 20,
      bottom: 1,
    };

    const innerHeight = height - margin.bottom;
    const innerWidth = width - margin.left - margin.right;

    const xScale = scaleLinear().domain([d3.min(data, (d) => d[0])!, d3.max(data, (d) => d[0])!]).range([0, innerWidth]);
    const yScale = scaleLinear().domain([d3.min(data, (d) => d[1])!, d3.max(data, (d) => d[1])!]).range([innerHeight, 0]);

    const hexbinGenerator = hexbin()
      .x((d: [number, number]) => xScale(d[0]))
      .y((d: [number, number]) => yScale(d[1]))
      .radius(10)
      .extent([[0, 0], [innerWidth, innerHeight]]);

    const hexbinData = hexbinGenerator(data);

    const svg = select(d3Container.current)
      .attr('width', width)
      .attr('height', height);

    svg.selectAll('*').remove();

    svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    svg.append('g')
      .selectAll('.hexagon')
      .data(hexbinData)
      .enter()
      .append('path')
      .attr('class', 'hexagon')
      .attr('d', hexbinGenerator.hexagon())
      .attr('transform', (d) => `translate(${d.x}, ${d.y})`)
      .style('fill', (d) => d3.interpolateBlues(d.length / d3.max(hexbinData, (hd) => hd.length)!)) // Dynamic lightness
      .style('stroke', 'white')
      .style('stroke-width', '0.5px');

    const xAxis = d3.axisBottom(xScale).ticks(0);
    const yAxis = d3.axisLeft(yScale).ticks(0);

    svg.append('g')
      .attr('transform', `translate(${margin.left}, ${innerHeight})`)
      .call(xAxis);

    svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`)
      .call(yAxis);
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
        width={width}
        height={height}
        cursor="pointer"
        opacity={isHover ? 0.2 : 0.0}
        fill="cornflowerblue"
      />
    </svg>
  );
}
