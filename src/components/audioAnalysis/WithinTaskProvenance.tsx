import * as d3 from 'd3';
import {
  Affix, Button, ColorSwatch, Group, Popover, Stack,
} from '@mantine/core';
import { StoredAnswer } from '../../store/types';

const RECT_HEIGHT = 15;
const RECT_WIDTH = 3;

export function WithinTaskProvenance({
  xScale, answer, height, currentNode, setCurrentNode, taskName,
}: { answer: StoredAnswer, height: number, xScale: d3.ScaleLinear<number, number>, currentNode: string | null, setCurrentNode: (node: string, nodeTime: number, t: string) => void, taskName: string }) {
  const colorPlatte = [
    'var(--mantine-color-yellow-8)',
    'var(--mantine-color-green-8)',
    'var(--mantine-color-indigo-8)',
    'var(--mantine-color-violet-8)',
    'var(--mantine-color-cyan-8)',
    'var(--mantine-color-orange-3)',
    'var(--mantine-color-lime-3)',
    'var(--mantine-color-teal-3)',
    'var(--mantine-color-pink-3)',
  ];
  const colorMap = new Map();
  colorMap.set('Root', 'var(--mantine-color-grape-3)');
  if (answer.provenanceGraph) {
    let idx = 0;
    Object.entries(answer.provenanceGraph.nodes)
      .forEach((entry) => {
        const [, node] = entry;
        if (!colorMap.has(node.label)) {
          colorMap.set(node.label, colorPlatte[idx]);
          idx = (idx + 1) % colorPlatte.length;
        }
      });
  }

  return (
    <g style={{ cursor: 'pointer' }}>
      {answer.provenanceGraph ? Object.entries(answer.provenanceGraph.nodes).map((entry) => {
        const [nodeId, node] = entry;
        return <g key={nodeId} onClick={() => setCurrentNode(nodeId, node.createdOn, taskName)}><rect fill={nodeId === currentNode ? '#e15759' : colorMap.get(node.label)} x={xScale(node.createdOn) - RECT_WIDTH / 2} y={height / 2 - RECT_HEIGHT / 2} width={RECT_WIDTH} height={RECT_HEIGHT} /></g>;
      }) : null}
      {currentNode && answer.provenanceGraph && answer.provenanceGraph.nodes[currentNode] ? <rect fill="var(--mantine-color-blue-filled)" cx={xScale(answer.provenanceGraph.nodes[currentNode].createdOn)} cy={height / 2} r={5} /> : null}
      <Affix position={{ bottom: 10, left: 10 }}>
        <Popover width={200} position="bottom" withArrow shadow="md">
          <Popover.Target>
            <Button>Show Legend</Button>
          </Popover.Target>
          <Popover.Dropdown>
            <Stack>
              {
                Array.from(colorMap.keys()).map((key) => (
                  <Group key={key}>
                    <ColorSwatch color={colorMap.get(key)} />
                    <span>{key}</span>
                  </Group>
                ))
              }
            </Stack>
          </Popover.Dropdown>
        </Popover>
      </Affix>
    </g>
  );
}
