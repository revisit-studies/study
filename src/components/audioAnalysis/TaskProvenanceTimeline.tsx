import { useMemo } from 'react';
import * as d3 from 'd3';
import { ParticipantData } from '../../storage/types';
import { TaskProvenanceNodes } from './TaskProvenanceNodes';

export function TaskProvenanceTimeline({
  xScale,
  answers,
  width,
  height,
  currentNode,
  trialName,
  startTime,
  margin,
}: {
  xScale: d3.ScaleLinear<number, number>;
  answers: ParticipantData['answers'];
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
    () => Object.entries(answers)
      .filter((entry) => (trialName ? trialName === entry[0] : true))
      .map((entry) => {
        const [name, answer] = entry;

        const provenanceGraphComponents = Object.keys(answer.provenanceGraph).map(
          (provenanceArea) => {
            const graph = answer.provenanceGraph[
                  provenanceArea as keyof typeof answer.provenanceGraph
            ];
            if (graph) {
              return (
                <TaskProvenanceNodes
                  key={name + provenanceArea}
                  height={height}
                  currentNode={currentNode}
                  xScale={newXScale}
                  provenance={graph}
                />
              );
            }
            return null;
          },
        );

        return provenanceGraphComponents;
      }),
    [currentNode, height, answers, trialName, newXScale],
  );

  return (
    <svg style={{ width, height, marginLeft: margin.left }}>
      <line stroke="black" strokeWidth={1} x1={0} x2={width} y1={height / 2} y2={height / 2} />
      {provenanceNodes}
    </svg>
  );
}
