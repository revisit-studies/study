import { useMemo } from 'react';
import * as d3 from 'd3';

export function AxisY({
  domain = [0, 100],
  range = [10, 300],
}:{
    domain: number[];
    range: number[];
}) {
  const ticks = useMemo(() => {
    const yScale = d3.scaleLinear()
      .domain(domain)
      .range(range);

    const height = range[1] - range[0];
    const pixelsPerTick = 10;
    const numberOfTicksTarget = Math.max(
      2,
      Math.floor(
        height / pixelsPerTick,
      ),
    );

    return yScale.ticks(numberOfTicksTarget)
      .map((value) => ({
        value,
        yOffset: yScale(value),
      }));
  }, [
    domain.join('-'),
    range.join('-'),
  ]);

  return (
    <svg>
      <path
        d={[
          'M', 10, range[0],
          'h', 6,
          'V', range[1],
          'h', -6,
        ].join(' ')}
        fill="none"
        strokeWidth={2}
        stroke="black"
      />
      {ticks.map(({ value, yOffset }) => (
        <g
          key={value}
          transform={`translate(5, ${yOffset})`}
        >
          <line
            x2="10"
            stroke="black"
            strokeWidth={2}
          />
          <text
            key={value}
            style={{
              fontSize: '10px',
              textAnchor: 'middle',
              transform: 'translate(3px, -3px)',
            }}
          >
            { value }
          </text>
        </g>
      ))}
    </svg>
  );
}
