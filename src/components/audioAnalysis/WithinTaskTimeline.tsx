import {
  useCallback, useMemo,
} from 'react';
import * as d3 from 'd3';
import { ParticipantData } from '../../storage/types';
import { WithinTaskProvenance } from './WithinTaskProvenance';

const margin = {
  left: 5, top: 0, right: 5, bottom: 0,
};
export function WithinTaskTimeline({
  xScale, participantData, width, height, currentNode, setCurrentNode, setPlayTime, trialName,
} : {xScale: d3.ScaleLinear<number, number>, participantData: ParticipantData, width: number, height: number, currentNode: string | null, setCurrentNode: (node: string) => void, setPlayTime: (n: number, p: number) => void, trialName: string}) {
  const totalLength = useMemo(() => xScale.domain()[1] - xScale.domain()[0], [xScale]);

  const currentNodeCallback = useCallback((node: string, nodeTime: number) => {
    setPlayTime(nodeTime, (nodeTime - xScale.domain()[0]) / totalLength);

    setCurrentNode(node);
  }, [setCurrentNode, setPlayTime, totalLength, xScale]);

  const circles = useMemo(() => Object.entries(participantData.answers).filter((entry) => (trialName ? trialName === entry[0] : true)).map((entry) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [name, answer] = entry;

    return <WithinTaskProvenance key={name} taskName={name} answer={answer} height={height} currentNode={currentNode} setCurrentNode={currentNodeCallback} xScale={xScale} />;
  }), [currentNode, currentNodeCallback, height, participantData.answers, trialName, xScale]);

  return (
    <svg style={{ width, height }}>
      <line stroke="black" strokeWidth={1} x1={margin.left} x2={width + margin.left} y1={height / 2} y2={height / 2} />
      {circles}
    </svg>
  );
}
