import * as d3 from 'd3';

import {
  Affix,
} from '@mantine/core';
import { useMemo } from 'react';
import { StoredAnswer, TrrackedProvenance } from '../../store/types';

const RECT_HEIGHT = 15;
const RECT_WIDTH = 3;

const colorPlatte = ['#4269d0', '#ff725c', '#6cc5b0', '#3ca951', '#ff8ab7', '#a463f2', '#97bbf5', '#9c6b4e'];

export function WithinTaskProvenance({
  xScale, height, currentNode, provenance, answer,
}: {answer: StoredAnswer, height: number, xScale: d3.ScaleLinear<number, number>, currentNode: string | null, provenance: TrrackedProvenance }) {
  const colorMap = useMemo(() => {
    const _colorMap = new Map();
    _colorMap.set('Root', '#efb118');
    if (answer.provenanceGraph) {
      let idx = 0;
      Object.entries(answer.provenanceGraph.stimulus?.nodes || {})
        .forEach((entry) => {
          const [, node] = entry;
          if (!_colorMap.has(node.label)) {
            _colorMap.set(node.label, colorPlatte[idx]);
            idx = (idx + 1) % colorPlatte.length;
          }
        });
    }

    return _colorMap;
  }, [answer]);

  return (
    <g style={{ cursor: 'pointer' }}>
      {provenance ? Object.entries(provenance.nodes || {}).map((entry) => {
        const [nodeId, node] = entry;
        return <g key={nodeId}><rect fill={colorMap.get(node.label) || '#9498a0'} opacity={node.id === currentNode ? 1 : 0.7} x={xScale(node.createdOn) - RECT_WIDTH / 2} y={height / 2 - RECT_HEIGHT / 2} width={RECT_WIDTH} height={RECT_HEIGHT} /></g>;
      }) : null}
      {currentNode && provenance && provenance.nodes[currentNode]
        && <rect fill={colorMap.get(provenance.nodes[currentNode].label) || '#9498a0'} x={xScale(provenance.nodes[currentNode].createdOn) - RECT_WIDTH / 2} y={height / 2 - RECT_HEIGHT / 2} width={RECT_WIDTH} height={RECT_HEIGHT} />}
      <Affix position={{ bottom: 10, left: 10 }}>
        {/* <Popover width={200} position="bottom" withArrow shadow="md">
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
        </Popover> */}
      </Affix>
    </g>
  );
}
