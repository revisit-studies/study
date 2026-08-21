import { Tooltip } from '@mantine/core';
import type { KeyboardEvent } from 'react';
import { useMemo } from 'react';
import type {
  PositionedSequenceEdge, PositionedSequenceNode, SequenceVisNode,
} from './sequenceVisModel';
import { AnimatedArrow } from './AnimatedArrow';
import { AnimatedCircle } from './AnimatedCircle';
import { AnimatedRect } from './AnimatedRect';

const RECT_HEIGHT = 27;
const COMPONENT_RADIUS = 3.5;

function nodeColor(node: PositionedSequenceNode): string {
  if (!node.active) {
    return '#adb5bd';
  }
  if (node.kind === 'factor') {
    return '#7950f2';
  }
  if (node.kind === 'dynamic') {
    return '#f59f00';
  }
  if (node.kind === 'condition') {
    return '#228be6';
  }
  if (node.kind === 'overflow') {
    return '#dee2e6';
  }
  return '#4c6ef5';
}

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function nodeSubtitle(node: PositionedSequenceNode): string | undefined {
  if (node.kind === 'factor') {
    const action = node.factorDetails?.action ?? 'factor';
    const participantSelection = node.selectedConditions === undefined
      ? ''
      : `${node.selectedConditions} selected · `;
    const sampling = node.numSamples === undefined ? '' : ` · sample ${node.numSamples}`;
    return `${action} · ${participantSelection}${node.totalConditions ?? 0} conditions${sampling}`;
  }
  if (node.kind === 'block') {
    const sampling = node.numSamples === undefined ? '' : ` · sample ${node.numSamples}`;
    return `${node.order ?? 'fixed'}${sampling}`;
  }
  if (node.kind === 'dynamic') {
    return 'runtime';
  }
  return node.summary;
}

function tooltipLabel(node: PositionedSequenceNode): string {
  const subtitle = nodeSubtitle(node);
  return subtitle ? `${node.label} — ${subtitle}` : node.label;
}

function interactiveProps(node: PositionedSequenceNode, onSelectNode: (node: SequenceVisNode) => void) {
  if (node.kind !== 'factor') {
    return {};
  }
  return {
    onClick: () => onSelectNode(node),
    onKeyDown: (event: KeyboardEvent<SVGGElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelectNode(node);
      }
    },
    role: 'button',
    tabIndex: 0,
    style: { cursor: 'pointer' },
    'aria-label': `Show details for factor ${node.label}`,
  };
}

export function SequenceComponent({
  nodes, edges, selectedNodeKey, onSelectNode,
}: {
  nodes: PositionedSequenceNode[];
  edges: PositionedSequenceEdge[];
  selectedNodeKey?: string;
  onSelectNode: (node: SequenceVisNode) => void;
}) {
  const edgeLines = useMemo(() => edges.map((edge) => (
    <AnimatedArrow
      key={edge.key}
      x1={edge.x1}
      x2={edge.x2}
      y1={edge.y1 + (RECT_HEIGHT / 2)}
      y2={edge.y2 - (RECT_HEIGHT / 2)}
    />
  )), [edges]);

  const shapes = useMemo(() => nodes.map((node) => {
    if (node.kind === 'component') {
      return (
        <Tooltip withinPortal withArrow key={node.key} label={node.label}>
          <g>
            <AnimatedCircle
              id={node.key}
              cx={node.x}
              cy={node.y}
              r={COMPONENT_RADIUS}
              fill={node.active ? '#228be6' : '#adb5bd'}
            />
          </g>
        </Tooltip>
      );
    }

    const fill = nodeColor(node);
    const isSelected = node.key === selectedNodeKey;
    const textColor = node.kind === 'overflow' ? '#343a40' : '#ffffff';
    const subtitle = nodeSubtitle(node);
    return (
      <Tooltip withinPortal withArrow key={node.key} label={tooltipLabel(node)}>
        <g {...interactiveProps(node, onSelectNode)}>
          <AnimatedRect
            width={node.width}
            x={node.x - (node.width / 2)}
            y={node.y - (RECT_HEIGHT / 2)}
            height={RECT_HEIGHT}
            fill={fill}
            stroke={isSelected ? '#212529' : 'none'}
          />
          <text
            fill={textColor}
            fontSize={8.5}
            fontWeight={700}
            textAnchor="middle"
            x={node.x}
            y={node.y - 2}
          >
            {truncate(node.label, 22)}
          </text>
          {subtitle ? (
            <text
              fill={textColor}
              fontSize={6.5}
              opacity={0.9}
              textAnchor="middle"
              x={node.x}
              y={node.y + 8}
            >
              {truncate(subtitle, 29)}
            </text>
          ) : null}
        </g>
      </Tooltip>
    );
  }), [nodes, onSelectNode, selectedNodeKey]);

  return (
    <g>
      <g>{edgeLines}</g>
      <g>{shapes}</g>
    </g>
  );
}
