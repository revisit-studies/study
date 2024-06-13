import {
  Center, Group, Text, Tooltip,
} from '@mantine/core';
import { useCallback, useMemo } from 'react';
import * as d3 from 'd3';

// code taken from https://wattenberger.com/blog/react-and-d3
export function XAxisBar({
  xScale,
  yRange,
  vertPosition,
  label,
  ticks,
  isDate = false,
  showLines = true,
  compact = false,
}: {
  showLines?: boolean;
  isDate?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  xScale: d3.ScaleTime<any, any> | d3.ScaleLinear<number, number>;
  yRange: [number, number];
  vertPosition: number;
  label: string;
  ticks: { value: string; offset: number }[];
  compact?: boolean;
}) {
  const tickWidth = useMemo(() => {
    if (ticks.length > 1) {
      return Math.abs(ticks[1].offset - ticks[0].offset);
    }

    return xScale.range()[0] - xScale.range()[1];
  }, [ticks, xScale]);

  const format = useCallback((str: string | Date) => {
    const myFormat = isDate ? d3.utcFormat('%B') : d3.format('.2s');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return myFormat(str as any);
  }, [isDate]);

  return (
    <>
      <g transform={`translate(${xScale.range()[0]}, ${vertPosition + 25})`}>
        <foreignObject width={Math.abs(xScale.range()[0] - xScale.range()[1])} height={20}>
          <Center>
            <Group gap={3}>
              <Text size={compact ? '10px' : '14px'} style={{ color: '#878E95' }}>
                {label}
              </Text>
            </Group>
          </Center>
        </foreignObject>
      </g>
      <path transform={`translate(0, ${vertPosition})`} d={['M', xScale.range()[0], 0, 'H', xScale.range()[1]].join(' ')} fill="none" stroke="lightgray" />

      {showLines ? <path transform={`translate(0, ${yRange[1]})`} d={['M', xScale.range()[0], 0, 'H', xScale.range()[1]].join(' ')} fill="none" stroke="lightgray" /> : null }

      {ticks.map(({ value, offset }) => (
        <g key={value} transform={`translate(${offset}, ${vertPosition})`}>
          <line y2="6" stroke="currentColor" />
          {showLines ? <line y2={`${-(yRange[0] - yRange[1])}`} stroke="lightgray" /> : null}
          <foreignObject x={0 - tickWidth / 2} y={10} width={tickWidth} height={20}>
            <Center>
              <Tooltip withinPortal label={value}>
                <Text
                  px={2}
                  size="10px"
                  style={{
                    textAlign: 'center', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap',
                  }}
                >
                  {+value === 0 ? 0 : format(isDate ? new Date(value) : value)}
                </Text>
              </Tooltip>
            </Center>
          </foreignObject>
        </g>
      ))}
    </>
  );
}
