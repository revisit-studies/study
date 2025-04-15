import { Text, Tooltip } from '@mantine/core';

import { useCallback, useMemo } from 'react';
import { useMatrixContext } from '../utils/MatrixContext';
import { ChartParams, link } from '../utils/Interfaces';
import { HIGHLIGHT_STROKE_WIDTH } from '../utils/Constants';

export const getOrder = (node: string, data: link[]) => {
  const connected = [
    ...new Set(data.filter((d) => d.origin === node).map((d) => d.destination)),
  ].sort();

  const disconnected = [...new Set(data.filter((d) => d.origin !== node).map((d) => d.destination))]
    .filter((d) => !connected.includes(d))
    .sort();

  const orderedNodes = [...connected, ...disconnected];
  return orderedNodes;
};

export function OriginAxis({
  parameters,
  showLines = true,
}: {
  parameters: ChartParams;
  showLines?: boolean;
}) {
  const {
    data,
    originScale,
    destinationScale,
    margin,
    setDestinationHighlight,
    setOriginHighlight,
    setOrderNode,
    setOrderedDestinations,
    orderNode,
    orderedOrigins,
    cellSize,
    size,
  } = useMatrixContext();

  const destinationRange = useMemo(() => destinationScale.range(), [destinationScale]);

  const tickLineOffset = useMemo(() => originScale.bandwidth() / 2, [originScale]);

  const ticks = useMemo(
    () => originScale.domain().map((value) => ({
      value,
      offset: (originScale(value) || 0) + tickLineOffset,
    })),
    [originScale, tickLineOffset],
  );

  const onMouseOver = useCallback(
    (node: string) => {
      setDestinationHighlight(node);
      setOriginHighlight(node);
    },
    [setDestinationHighlight, setOriginHighlight],
  );

  const onClick = (node: string) => {
    if (parameters.clusterMode) return;
    if (orderNode === node) {
      setOrderedDestinations(orderedOrigins);
      setOrderNode(null);
      return;
    }
    const order = getOrder(node, data);
    setOrderedDestinations(order);
    setOrderNode(node);
  };

  return (
    <>
      {showLines ? (
        <path className="axis-line" d={['M', 0, 0, 'V', destinationRange[1]].join(' ')} />
      ) : null}

      {ticks.map(({ value, offset }) => (
        <g key={`${value}`} transform={`translate(${offset},0 )`}>
          {showLines ? (
            <line
              className="axis-line"
              y2={`${destinationRange[1]}`}
              x2={tickLineOffset}
              x1={tickLineOffset}
            />
          ) : null}
          <foreignObject
            dominantBaseline="hanging"
            className="axis-label"
            y={-tickLineOffset}
            width={margin.top}
            height={originScale.bandwidth()}
            style={{ transform: 'rotate(-90deg)', cursor: 'pointer' }}
            onMouseOver={() => onMouseOver(value)}
            onClick={() => onClick(value)}
          >
            <div className="label-container">
              <Tooltip
                transitionProps={{ transition: 'slide-down', duration: 300 }}
                label={value}
                withinPortal
                openDelay={200}
              >
                <Text className="axis-label" size="s">
                  {orderNode === value ? `←  ${value}` : value}
                </Text>
              </Tooltip>
            </div>
          </foreignObject>
        </g>
      ))}

      <rect
        id="orderHighlight"
        className="order-highlight"
        width={cellSize}
        height={size + margin.top}
        y={-margin.top + HIGHLIGHT_STROKE_WIDTH}
        x={orderNode ? originScale(orderNode) : 0}
        visibility={orderNode ? 'visible' : 'hidden'}
        style={{ strokeWidth: HIGHLIGHT_STROKE_WIDTH }}
      />
    </>
  );
}
