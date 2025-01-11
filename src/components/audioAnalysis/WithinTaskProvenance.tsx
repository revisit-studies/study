/* eslint-disable @typescript-eslint/no-explicit-any */
import * as d3 from 'd3';
import { StoredAnswer } from '../../store/types';

const RECT_HEIGHT = 15;
const RECT_WIDTH = 3;

export function WithinTaskProvenance({
  xScale, answer, height, currentNode, setCurrentNode, taskName,
} : {answer: StoredAnswer, height: number, xScale: d3.ScaleLinear<number, number>, currentNode: string | null, setCurrentNode: (node: string, nodeTime: number, t: string) => void, taskName: string}) {
  return (
    <g style={{ cursor: 'pointer' }}>
      {answer.provenanceGraph ? Object.entries(answer.provenanceGraph.nodes).map((entry) => {
        const [nodeId, node] = entry;

        return <g key={nodeId} onClick={() => setCurrentNode(nodeId, node.createdOn, taskName)}><rect fill={nodeId === currentNode ? '#e15759' : '#484848'} x={xScale(node.createdOn) - RECT_WIDTH / 2} y={height / 2 - RECT_HEIGHT / 2} width={RECT_WIDTH} height={RECT_HEIGHT} /></g>;
      }) : null}
      {currentNode && answer.provenanceGraph && answer.provenanceGraph.nodes[currentNode] ? <rect fill="var(--mantine-color-blue-filled)" cx={xScale(answer.provenanceGraph.nodes[currentNode].createdOn)} cy={height / 2} r={5} /> : null}
    </g>
  );
}
