/**
 * Authors: WPI Data Visualization Team
 * Modified by: The ReVISit Team
 * Description:
 *    This file contains the functionality to create a Hexbin Plot using a pre-existing dataset.
 */

import { scaleLinear } from 'd3-scale';
import * as d3 from 'd3';
import { hexbin } from 'd3-hexbin';
import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { select } from 'd3-selection';
import { PREFIX } from '../../../../../../utils/Prefix';

const width = 300;
const height = 300;

export default function HexbinPlots({ r, onClick } : { r: number, onClick: () => void }) {
  const d3Container = useRef(null);
  const [data, setData] = useState<[number, number][]>([]);
  const [isHover, setIsHover] = useState<boolean>(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const filePath = `${PREFIX}jnd-data/datasets/size_1000/dataset_${r}_size_1000.csv`;

        const response = await fetch(filePath);
        if (!response.ok) {
          throw new Error(`Failed to fetch dataset: ${filePath}`);
        }

        const text = await response.text();
        const rows = text.trim().split('\n').slice(1);

        const parsedData = rows.map((row) => {
          const [x, y] = row.split(',').map(Number);
          return [x, y] as [number, number];
        });

        setData(parsedData);
      } catch (error) {
        console.error('Error loading dataset:', error);
      }
    };

    fetchData();
  }, [r]);

  const createChart = useCallback(() => {
    if (data.length === 0) return;

    const margin = {
      left: 40, top: 20, right: 20, bottom: 40,
    };

    const innerHeight = height - margin.bottom;
    const innerWidth = width - margin.left - margin.right;

    const xScale = scaleLinear()
      .domain([d3.min(data, (d) => d[0])!, d3.max(data, (d) => d[0])!])
      .range([0, innerWidth]);

    const yScale = scaleLinear()
      .domain([d3.min(data, (d) => d[1])!, d3.max(data, (d) => d[1])!])
      .range([innerHeight, 0]);

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

    const chartGroup = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    chartGroup.append('g')
      .selectAll('.hexagon')
      .data(hexbinData)
      .enter()
      .append('path')
      .attr('class', 'hexagon')
      .attr('d', hexbinGenerator.hexagon())
      .attr('transform', (d) => `translate(${d.x}, ${d.y})`)
      .style('fill', (d) => d3.interpolateBlues(d.length / d3.max(hexbinData, (hd) => hd.length)!))
      .style('stroke', 'white')
      .style('stroke-width', '0.5px');

    const xAxis = d3.axisBottom(xScale).tickFormat(() => '').tickSize(0);
    const yAxis = d3.axisLeft(yScale).tickFormat(() => '').tickSize(0);

    chartGroup.append('g')
      .attr('transform', `translate(-10, ${innerHeight + 5})`)
      .call(xAxis)
      .selectAll('line, text')
      .remove();

    chartGroup.append('g')
      .attr('transform', 'translate(-10, 5)')
      .call(yAxis)
      .selectAll('line, text')
      .remove();
  }, [data]);

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
