/**
 * Authors: WPI Data Visualization Team
 * Modified by: The ReVISit Team
 * Description:
 *    This file loads a pre-generated dataset and renders a Scatter Plot using D3.
 */

import { scaleLinear } from 'd3-scale';
import { axisLeft, axisBottom } from 'd3-axis';
import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { select } from 'd3-selection';
import { PREFIX } from '../../../../../../utils/Prefix';

const width = 320;
const height = 300;

export default function ScatterPlots({ r, onClick } : { r: number, onClick: () => void}) {
  const d3Container = useRef(null);
  const [data, setData] = useState<[number, number][]>([]);
  const [isHover, setIsHover] = useState<boolean>(false);

  const margin = {
    left: 20, top: 20, right: 20, bottom: 20,
  };
  const innerHeight = height - margin.bottom;
  const innerWidth = width - margin.left - margin.right;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const filePath = `${PREFIX}jnd-data/datasets/size_100/dataset_${r}_size_100.csv`;

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

    const xScale = scaleLinear().domain([0, 1]).range([0, innerWidth]);
    const yScale = scaleLinear().domain([0, 1]).range([innerHeight, 0]);

    const xAxis = axisBottom(xScale).tickSize(0).tickFormat(() => '');
    const yAxis = axisLeft(yScale).tickSize(0);

    const svg = select(d3Container.current).attr('width', width).attr('height', height);
    svg.selectAll('*').remove();

    svg.append('g')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .attr('class', 'main axis date').call(xAxis);

    svg.append('g')
      .attr('class', 'main axis date').call(yAxis);

    svg.selectAll('.dot')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('r', 2)
      .attr('cx', (d) => xScale(d[0]))
      .attr('cy', (d) => yScale(d[1]))
      .style('fill', 'black');
  }, [data, innerWidth, innerHeight, margin.bottom]);

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
      <g id="d3Stuff" ref={d3Container} />
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
