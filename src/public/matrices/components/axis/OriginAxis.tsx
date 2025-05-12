import { Text, Tooltip } from '@mantine/core';

import { useCallback, useEffect, useMemo } from 'react';
import { useMatrixContext } from '../../utils/MatrixContext';
import { Link } from '../../utils/Interfaces';

export const getOrder = (node: string, data: Link[]) => {
  const connected = [
    ...new Set(data.filter((d) => d.origin === node).map((d) => d.destination)),
  ].sort();

  const disconnected = [...new Set(data.filter((d) => d.origin !== node).map((d) => d.destination))]
    .filter((d) => !connected.includes(d))
    .sort();

  const orderedNodes = [...connected, ...disconnected];
  return orderedNodes;
};

export function OriginAxis({ showLines = true }: { showLines?: boolean }) {
  const {
    configProps,
    data,
    originScale,
    destinationScale,

    margin,

    setDestinationHighlight,
    setOriginHighlight,

    orderingNode,
    setOrderingNode,

    orderedOrigins,
    setOrderedDestinations,

    trrack,
    actions,
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

  const onClick = useCallback(
    (node: string, oNode: string | null) => {
      if (configProps.nodeOrderingDisabled) return;
      if (oNode === node) {
        setOrderingNode(null);
        trrack?.apply('Reset Sort', actions?.setOrderingNode(null));
      } else {
        setOrderingNode(node);
        trrack?.apply('Sort', actions?.setOrderingNode(node));
      }
    },
    [configProps.nodeOrderingDisabled, trrack, actions, setOrderingNode],
  );

  useEffect(() => {
    if (configProps.nodeOrderingDisabled) return;
    if (orderingNode === null) {
      setOrderedDestinations(orderedOrigins);
      return;
    }
    const order = getOrder(orderingNode, data);
    setOrderedDestinations(order);
  }, [
    configProps.nodeOrderingDisabled,
    data,
    orderedOrigins,
    setOrderedDestinations,
    orderingNode,
  ]);

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
            className="axis-label"
            y={-tickLineOffset}
            width={margin.top}
            height={originScale.bandwidth()}
            style={{
              transform: 'rotate(-90deg)',
              cursor: 'pointer',
            }}
            onMouseOver={() => onMouseOver(value)}
            onClick={() => onClick(value, orderingNode)}
          >
            <div
              className="label-container"
              style={{
                height: originScale.bandwidth(),
              }}
            >
              <Tooltip
                transitionProps={{ transition: 'slide-down', duration: 300 }}
                label={value}
                withinPortal
                openDelay={200}
              >
                <Text className="axis-label" size="s">
                  {orderingNode === value ? `←  ${value}` : value}
                </Text>
              </Tooltip>
            </div>
          </foreignObject>
        </g>
      ))}
    </>
  );
}
