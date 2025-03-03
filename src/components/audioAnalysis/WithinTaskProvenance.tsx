import * as d3 from 'd3';
import { TrrackedProvenance } from '../../store/types';

const RECT_HEIGHT = 15;
const RECT_WIDTH = 3;

export function WithinTaskProvenance({
  xScale, height, currentNode, setCurrentNode, taskName, provenance,
}: { height: number, xScale: d3.ScaleLinear<number, number>, currentNode: string | null, setCurrentNode: (node: string, nodeTime: number, t: string) => void, taskName: string, provenance: TrrackedProvenance }) {
  return (
    <g style={{ cursor: 'pointer' }}>
      {provenance ? Object.entries(provenance.nodes || {}).map((entry) => {
        const [nodeId, node] = entry;
        return <g key={nodeId} onClick={() => setCurrentNode(nodeId, node.createdOn, taskName)}><rect fill={nodeId === currentNode ? '#e15759' : 'gray'} x={xScale(node.createdOn) - RECT_WIDTH / 2} y={height / 2 - RECT_HEIGHT / 2} width={RECT_WIDTH} height={RECT_HEIGHT} /></g>;
      }) : null}
      {currentNode && provenance && provenance.nodes[currentNode]
        && <rect fill="var(--mantine-color-blue-filled)" cx={xScale(provenance.nodes[currentNode].createdOn)} cy={height / 2} r={5} />}
    </g>
  );
}
