import { Card, Text } from '@mantine/core';
import { useEffect, useState, useRef } from 'react';
import { useMatrixContext } from '../utils/MatrixContext';
import {
  destinationAccesor, meanAccesor, originAccesor, stdAccesor,
} from '../utils/Accesors';

type Anchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
const [width, height] = [300, 105];

function getAnchoredPosition(
  x: number,
  y: number,
  w: number,
  h: number,
  cellS: number,
  anchor: Anchor,
) {
  switch (anchor) {
    case 'top-right':
      return { x: x - w, y: y + cellS };
    case 'bottom-left':
      return { x: x + cellS, y: y - h };
    case 'bottom-right':
      return { x: x - w, y: y - h };
    default:
      return { x: x + cellS, y: y + cellS };
  }
}

function getAnchor(x: number, y: number, containerWidth: number, containerHeight: number): Anchor {
  const centerX = containerWidth / 2;
  const centerY = containerHeight / 2;
  const isTop = y < centerY;
  const isLeft = x < centerX;
  if (isTop && isLeft) return 'top-left';
  if (isTop && !isLeft) return 'top-right';
  if (!isTop && isLeft) return 'bottom-left';
  return 'bottom-right';
}

export function MatrixTooltip() {
  const {
    data,
    originScale,
    destinationScale,
    originHighlight,
    destinationHighlight,
    cellSize,
    size,
  } = useMatrixContext();

  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const item = data.find(
    (d) => originAccesor(d) === originHighlight && destinationAccesor(d) === destinationHighlight,
  );

  const isActive = !!item && originHighlight != null && destinationHighlight != null;

  useEffect(() => {
    if (!isActive) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setVisible(false);
      return;
    }

    const x = originScale(originHighlight!);
    const y = destinationScale(destinationHighlight!);
    if (x == null || y == null) return;

    const anchor = getAnchor(x, y, size, size);
    const { x: posX, y: posY } = getAnchoredPosition(x, y, width, height, cellSize, anchor);

    // Cancelar cualquier timeout anterior
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setVisible(false); // Ocultar inmediatamente
    timeoutRef.current = setTimeout(() => {
      setPosition({ x: posX, y: posY });
      setVisible(true);
    }, 200); // Espera antes de mostrar
  }, [
    originScale,
    originHighlight,
    destinationHighlight,
    data,
    size,
    cellSize,
    destinationScale,
    isActive,
  ]);

  if (!isActive) return null;

  return (
    <foreignObject
      x={position.x}
      y={position.y}
      width={width}
      height={height}
      style={{ pointerEvents: 'none' }}
    >
      <Card
        shadow="sm"
        radius="md"
        p="xs"
        withBorder
        style={{
          backgroundColor: 'white',
          height,
          display: 'flex',
          flexDirection: 'column',
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.95)',
          transition: 'opacity 200ms ease, transform 200ms ease',
        }}
      >
        <Text size="sm" fw={500}>
          Origin:
          {' '}
          {originHighlight}
        </Text>
        <Text size="sm" fw={500}>
          Destination:
          {' '}
          {destinationHighlight}
        </Text>
        <Text size="sm" c="blue">
          Mean:
          {' '}
          {meanAccesor(item).toFixed(2)}
        </Text>
        <Text size="sm" c="orange">
          Deviation: ±
          {stdAccesor(item).toFixed(2)}
        </Text>
        {/*         <svg width="100%" height="100%" style={{ background: 'red' }} />
         */}
        {' '}
      </Card>
    </foreignObject>
  );
}
