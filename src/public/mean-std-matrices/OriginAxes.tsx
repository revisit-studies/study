import { Text, Tooltip } from '@mantine/core';

import { useCallback, useMemo } from 'react';
import { useMatrixContext } from './MatrixContext';

export function OriginAxis({ showLines = true }: { showLines?: boolean }) {
  const {
    originScale, destinationScale, margin, setDestinationHighlight, setOriginHighlight,
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

  return (
    <>
      {showLines ? <path d={['M', 0, 0, 'V', destinationRange[1]].join(' ')} fill="none" stroke="lightgrey" /> : null}

      {ticks.map(({ value, offset }) => (
        <g key={`${value}`} transform={`translate(${offset},0 )`}>
          {showLines ? <line y2={`${destinationRange[1]}`} stroke="lightgray" x2={tickLineOffset} x1={tickLineOffset} /> : null}
          <foreignObject
            x={5}
            y={-tickLineOffset}
            width={margin.top - 5}
            height={20}
            style={{ transform: 'rotate(-90deg)', cursor: 'pointer' }}
            onMouseOver={() => onMouseOver(value)}
          >
            <Tooltip withinPortal label={value}>
              <Text
                size="s"
                style={{
                  textAlign: 'start',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}
              >
                {value}
              </Text>
            </Tooltip>
          </foreignObject>
        </g>
      ))}
    </>
  );
}
