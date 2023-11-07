import { Center, Group, Text } from '@mantine/core';
import * as React from 'react';
import { useMemo } from 'react';
import * as d3 from 'd3';

// code taken from https://wattenberger.com/blog/react-and-d3
export function YAxis({ yScale, xRange, horizontalPosition, label }: {yScale: any, xRange: any, horizontalPosition: any, label: string}) {
  const ticks = useMemo(() => {
    return yScale.ticks(5).map((value: any) => ({
      value,
      yOffset: yScale(value),
    }));
  }, [yScale]);

  const format = useMemo(() => {
    return d3.format('.2s');
  }, []);

  return (
    <>
    <g transform={`translate(${horizontalPosition - 60}, ${yScale.range()[0]}) rotate(-90)`}>
        <foreignObject width={Math.abs(yScale.range()[1] - yScale.range()[0])} height={20}>
          <Center>
            <Group spacing={3}>

              <Text size={14} style={{ color: '#878E95' }}>
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
      <path transform={`translate(${xRange[1]}, 0)`} d={['M', 0, yScale.range()[0], 'V', yScale.range()[1]].join(' ')} fill="none" stroke="lightgray" />
      {ticks.map(({ value, yOffset }: {value: number, yOffset: number}) => (
        <g key={value} transform={`translate(${horizontalPosition}, ${yOffset})`}>
          <line x2="-6" stroke="currentColor" />
          <line x2={`${xRange[1] - xRange[0]}`} stroke={`${value === 0 ? 'black' : 'lightgray'}`} />
          <text
            key={value}
            style={{
              dominantBaseline: 'middle',
              fontSize: '10px',
              textAnchor: 'end',
              transform: 'translateX(-8px)',
              fill: 'black',
              font: 'Roboto'
            }}
          >
            {format(value)}
          </text>
        </g>
      ))}
    </>
  );
}