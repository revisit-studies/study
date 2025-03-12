/**
 * Authors: WPI Data Visualization Team
 * Modified by: The ReVISit Team
 * Description:
 *    This file loads a pre-generated dataset and renders a Parallel Coordinates Plot using D3.
 */

import { scaleLinear } from 'd3-scale';
import * as d3 from 'd3';
import { axisLeft } from 'd3-axis';
import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { select } from 'd3-selection';
import { PREFIX } from '../../../../../../utils/Prefix';

const width = 300;
const height = 300;

export default function ParallelCoordinates({ v, onClick, shouldNegate = false } : { v: number, onClick: () => void, shouldNegate?: boolean }) {
  const d3Container = useRef(null);
  const [data, setData] = useState<[number, number][]>([]);
  const [isHover, setIsHover] = useState<boolean>(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const baseCorrelations = [0.3, 0.6, 0.9];
        const shouldScramble = baseCorrelations.includes(v);
        const randomIndex = shouldScramble ? Math.floor(Math.random() * 5) + 1 : 1;

        const filePath = shouldScramble
          ? `${PREFIX}jnd-data/datasets/size_100/dataset_${v}_size_100_${randomIndex}.csv`
          : `${PREFIX}jnd-data/datasets/size_100/dataset_${v}_size_100.csv`;

        const response = await fetch(filePath);
        if (!response.ok) {
          throw new Error(`Failed to fetch dataset: ${filePath}`);
        }

        const text = await response.text();
        const rows = text.trim().split('\n').slice(1);

        const parsedData = rows.map((row) => {
          const [x, y] = row.split(',').map(Number);
          if (shouldNegate) {
            return [x, 1 - y] as [number, number];
          }
          return [x, y] as [number, number];
        });

        setData(parsedData);
      } catch (error) {
        console.error('Error loading dataset:', error);
      }
    };

    fetchData();
  }, [v]);

  const createChart = useCallback(() => {
    if (data.length === 0) return;

    const margin = {
      left: 20,
      top: 20,
      right: 20,
      bottom: 20,
    };

    // consts
    const innerHeight = height - margin.bottom;
    const innerWidth = width - margin.left - margin.right;
    const leftAry = data.map((d) => d[0]).filter((num) => !Number.isNaN(num));
    const rightAry = data.map((d) => d[1]).filter((num) => !Number.isNaN(num));

    if (leftAry.length === 0 || rightAry.length === 0) {
      console.error('Invalid data:', data);
      return;
    }

    const leftMin = d3.min(leftAry) ?? 0;
    const leftMax = d3.max(leftAry) ?? 1;
    const rightMin = d3.min(rightAry) ?? 0;
    const rightMax = d3.max(rightAry) ?? 1;

    const leftScale = scaleLinear().domain([leftMin, leftMax]).range([0, innerHeight]);
    const rightScale = scaleLinear().domain([rightMin, rightMax]).range([0, innerHeight]);

    const svg = select(d3Container.current);
    svg.selectAll('*').remove();

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .call(axis as any);
    };

    addAxistoChart(svg, '.x.axis', leftAxis, 'x axis', leftAxisTransform);
    addAxistoChart(svg, '.y.axis', rightAxis, 'y axis', rightAxisTransform);

    // console.log('v:', v);
    // console.log('Left Scale Domain:', leftMin, leftMax);
    // console.log('Right Scale Domain:', rightMin, rightMax);

    // add lines
    svg.selectAll('.line')
      .data(data)
      .enter()
      .append('line')
      .style('stroke', 'grey')
      .style('stroke-width', 0.5)
      .attr('x1', margin.left)
      .attr('y1', (d) => {
        const y1 = leftScale(d[0]) + margin.top;
        return Number.isNaN(y1) ? 0 : y1;
      })
      .attr('x2', margin.left + innerWidth)
      .attr('y2', (d) => {
        const y2 = rightScale(d[1]) + margin.top;
        return Number.isNaN(y2) ? 0 : y2;
      });
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
      <g id="d3Stuff" ref={d3Container} />
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
