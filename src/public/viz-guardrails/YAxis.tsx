/* eslint-disable react/no-unused-prop-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from 'react';
import * as d3 from 'd3';

// code taken from https://wattenberger.com/blog/react-and-d3
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function YAxis({
  dataset, yScale, xRange, horizontalPosition,
}: { dataset: string, yScale: any, xRange: any, horizontalPosition: any }) {
  const ticks = useMemo(
    () => yScale.ticks(6).map((value: any) => ({
      value,
      yOffset: yScale(value),
    })),
    [yScale],
  );

  const format = useMemo(() => {
    if (dataset === 'clean_stocks') {
      return d3.format(',.0%');
    }

    return (yScale.domain()[1]) < 5 ? d3.format(',.2r') : d3.format(',.0f');
  }, [dataset, yScale]);

  return (
    <>
      {ticks.map(({ value, yOffset }: { value: number, yOffset: number }) => (
        <g key={value} transform={`translate(${horizontalPosition}, ${yOffset})`}>

          <line
            x2={`${xRange[1] - xRange[0]}`}
            stroke={`${value === 0 ? 'black' : 'gainsboro'}`}
            strokeWidth={value === 0 ? 1 : 0.4}
          />
          <text
            key={value}
            style={{
              dominantBaseline: 'middle',
              fontSize: '10px',
              textAnchor: 'end',
              transform: 'translateX(-6px)',
              fill: 'black',
              font: 'Roboto',
            }}
          >
            {format(value)}
          </text>
        </g>
      ))}
    </>
  );
}
