import * as d3 from 'd3';
import { TrrackedProvenance } from '../../store/types';
import { getNodeColor } from './provenanceColors';

const RECT_HEIGHT = 15;
const RECT_WIDTH = 3;

export function TaskProvenanceNodes({
  height, xScale, currentNode, provenance,
}: {
  height: number, xScale: d3.ScaleLinear<number, number>, currentNode: string | null, provenance: TrrackedProvenance
}) {
  return (
    <g style={{ cursor: 'pointer' }}>
      {/* Provenance nodes */}
      {provenance ? Object.entries(provenance.nodes || {}).map((entry) => {
        const [nodeId, node] = entry;
        return (
          <g key={nodeId}>
            <rect fill={getNodeColor(node)} opacity={node.id === currentNode ? 1 : 0.7} x={xScale(node.createdOn) - RECT_WIDTH / 2} y={height / 2 - RECT_HEIGHT / 2} width={RECT_WIDTH} height={RECT_HEIGHT} />
          </g>
        );
      }) : null}
      {/* Currently active provenance node */}
      {currentNode && provenance && provenance.nodes[currentNode] && (
        <rect fill={getNodeColor(provenance.nodes[currentNode])} x={xScale(provenance.nodes[currentNode].createdOn) - RECT_WIDTH / 2} y={height / 2 - RECT_HEIGHT / 2} width={RECT_WIDTH} height={RECT_HEIGHT} />
      )}
    </g>
  );
}
