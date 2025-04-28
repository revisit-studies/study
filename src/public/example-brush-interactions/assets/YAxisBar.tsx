import * as React from 'react';
import { useMemo } from 'react';
import { Center, Group, Text } from '@mantine/core';

// code taken from https://wattenberger.com/blog/react-and-d3
export function YAxisBar({
  yScale,
  xRange,
  horizontalPosition,
  label,
  ticks,
  showLines,
  compact = false,
}: {
  yScale: d3.ScaleBand<string>
  xRange: [number, number];
  horizontalPosition: number;
  label: string;
  ticks: { value: string; offset: number }[];
  showLines?: boolean;
  compact?: boolean;
}) {
  const labelSpacing = useMemo(() => {
    const maxLabelLength = ticks.reduce((max, { value }) => {
      const { length } = `${value}`;
      return length > max ? length : max;
    }, 0);

    return maxLabelLength > 10 ? 60 : maxLabelLength * 6;
  }, [ticks]);

  return (
    <>
      <g transform={`translate(${horizontalPosition - labelSpacing - 40}, ${yScale.range()[1]}) rotate(-90)`}>
        <foreignObject width={Math.abs(yScale.range()[1] - yScale.range()[0])} height={20}>
          <Center>
            <Group gap={3}>

              <Text size={compact ? '10px' : '14px'} style={{ color: '#878E95' }}>
                {label}
              </Text>
            </Group>
          </Center>
        </foreignObject>
      </g>
      <path
        transform={`translate(${horizontalPosition}, 0)`}
        d={['M', 0, yScale.range()[0], 'V', yScale.range()[1]].join(' ')}
        fill="none"
        stroke="lightgray"
      />
      {showLines ? <path transform={`translate(${xRange[1]}, 0)`} d={['M', 0, yScale.range()[0], 'V', yScale.range()[1]].join(' ')} fill="none" stroke="lightgray" /> : null }
      {ticks.map(({ value, offset }) => (
        <g key={value} transform={`translate(${horizontalPosition}, ${offset})`}>
          <line x2="-6" stroke="currentColor" />
          {showLines ? <line x2={`${xRange[1] - xRange[0]}`} stroke="lightgray" /> : null}
          <g
            key={value}
            style={{
              transform: `translate(-${labelSpacing + 10}px, -9px)`,
            }}
          >
            <foreignObject width={labelSpacing} height={20}>
              <Group style={{ width: '100%', height: '100%' }} justify="right">
                <Text style={{ textOverflow: 'ellipsis', overflow: 'hidden' }} size="10px">
                  {value}
                </Text>
              </Group>
            </foreignObject>
          </g>
        </g>
      ))}
    </>
  );
}
