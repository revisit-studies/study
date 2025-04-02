import {
  useMemo,
} from 'react';
import * as d3 from 'd3';
import { ParticipantData } from '../../storage/types';
import { WithinTaskProvenance } from './WithinTaskProvenance';

const margin = {
  left: 5, top: 0, right: 5, bottom: 0,
};
export function WithinTaskTimeline({
  xScale, answers, width, height, currentNode, trialName,
} : {xScale: d3.ScaleLinear<number, number>, answers: ParticipantData['answers'], width: number, height: number, currentNode: string | null, trialName: string}) {
  const circles = useMemo(() => Object.entries(answers).filter((entry) => (trialName ? trialName === entry[0] : true)).map((entry) => {
    const [name, answer] = entry;

    const allCircles = Object.keys(answer.provenanceGraph).map((provenanceArea) => {
      const graph = answer.provenanceGraph[provenanceArea as keyof typeof answer.provenanceGraph];
      if (graph) {
        return <WithinTaskProvenance answer={answers[trialName]} key={name + provenanceArea} height={height} currentNode={currentNode} xScale={xScale} provenance={graph} />;
      }
      return null;
    });

    return allCircles;
  }), [currentNode, height, answers, trialName, xScale]);

  return (
    <svg style={{ width, height }}>
      <line stroke="black" strokeWidth={1} x1={margin.left} x2={width + margin.left} y1={height / 2} y2={height / 2} />
      {circles}
    </svg>
  );
}
