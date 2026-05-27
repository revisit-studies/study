import { useMemo } from 'react';
import * as d3 from 'd3';
import { TaskProvenanceNodes } from './TaskProvenanceNodes';
import type { StoredProvenance } from '../../store/types';
import { PROVENANCE_LOCATIONS } from '../../store/provenance';

export function TaskProvenanceTimeline({
  xScale,
  provenanceGraph,
  width,
  height,
  currentNode,
  trialName,
  startTime,
  margin,
}: {
  xScale: d3.ScaleLinear<number, number>;
  provenanceGraph: StoredProvenance;
  width: number;
  height: number;
  currentNode: string | null;
  trialName: string;
  startTime: number;
  margin: { left: number; right: number; top: number; bottom: number };
}) {
  const newXScale = useMemo(
    () => xScale
      .copy()
      .range([0, xScale.range()[1]])
      .domain([
        startTime + xScale.domain()[0] * 1000,
        startTime + xScale.domain()[1] * 1000,
      ]),
    [startTime, xScale],
  );

  const provenanceNodes = useMemo(
    () => PROVENANCE_LOCATIONS.map((provenanceArea) => {
      const graph = provenanceGraph[provenanceArea];
      if (graph) {
        return (
          <TaskProvenanceNodes
            key={`${trialName}-${provenanceArea}`}
            height={height}
            currentNode={currentNode}
            xScale={newXScale}
            provenance={graph}
          />
        );
      }
      return null;
    }),
    [currentNode, height, provenanceGraph, trialName, newXScale],
  );

  return (
    <svg style={{ width, height, marginLeft: margin.left }}>
      <line stroke="black" strokeWidth={1} x1={0} x2={width} y1={height / 2} y2={height / 2} />
      {provenanceNodes}
    </svg>
  );
}
