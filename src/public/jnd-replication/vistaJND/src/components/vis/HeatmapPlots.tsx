/**
 * Authors: WPI Data Visualization Team
 * Modified by: The ReVISit Team
 * Description:
 *    This file contains the functionality to create a Heatmap Plot using pre-existing dataset.
 */

import * as d3 from 'd3';
import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { select } from 'd3-selection';
import { PREFIX } from '../../../../../../utils/Prefix';

const width = 400;
const height = 40;
const spacing = 10;

export default function HeatmapPlots({ r, onClick, shouldNegate = false }: { r: number, onClick: () => void, shouldNegate?: boolean }) {
  const d3Container = useRef(null);
  const [data, setData] = useState<[number, number][]>([]);
  const [isHover, setIsHover] = useState<boolean>(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const baseCorrelations = [0.3, 0.6, 0.9];
        const shouldScramble = baseCorrelations.includes(r);
        const randomIndex = shouldScramble ? Math.floor(Math.random() * 5) + 1 : 1;

        const filePath = shouldScramble
          ? `${PREFIX}jnd-data/datasets/size_100/dataset_${r}_size_100_${randomIndex}.csv`
          : `${PREFIX}jnd-data/datasets/size_100/dataset_${r}_size_100.csv`;

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

    const sortedPairs = [...data].sort((a, b) => a[0] - b[0]);
    const xSorted = sortedPairs.map((d) => d[0]);
    const correlatedX = shouldNegate ? sortedPairs.map((d) => 1 - d[1]) : sortedPairs.map((d) => d[1]);

    const svg = select(d3Container.current)
      .attr('width', width)
      .attr('height', height * 2 + spacing);

    svg.selectAll('*').remove();

    svg.append('g')
      .selectAll('rect')
      .data(xSorted)
      .enter()
      .append('rect')
      .attr('x', (_, i) => i * (width / xSorted.length))
      .attr('y', 0)
      .attr('width', width / xSorted.length)
      .attr('height', height)
      .style('fill', (d) => d3.interpolateRdBu(d / 1))
      .style('cursor', 'pointer')
      .on('click', onClick);

    svg.append('g')
      .selectAll('rect')
      .data(correlatedX)
      .enter()
      .append('rect')
      .attr('x', (_, i) => i * (width / correlatedX.length))
      .attr('y', height + spacing)
      .attr('width', width / correlatedX.length)
      .attr('height', height)
      .style('fill', (d) => d3.interpolateRdBu(d / 1))
      .style('cursor', 'pointer')
      .on('click', onClick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, r]);

  useEffect(() => {
    createChart();
  }, [createChart]);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
      style={{
        display: 'inline-block',
        padding: '5px',
        border: isHover ? '4px solid cornflowerblue' : '4px solid transparent',
        cursor: 'pointer',
      }}
    >
      <svg
        ref={d3Container}
        className="d3-component"
        width={width}
        height={height * 2 + spacing}
      />
    </div>
  );
}
