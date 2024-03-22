import { useMemo } from 'react';
import * as d3 from 'd3';
import { timeAxisProps } from '../../types';

export function TimeAxisX(props: timeAxisProps) {
  const { domain, range } = props;
  const ticks = useMemo(() => {
    const xScale = d3.scaleTime()
      .domain(domain)
      .range(range);

    const width = range[1] - range[0];
    const pixelsPerTick = 200;
    const numberOfTicksTarget = Math.max(
      2,
      Math.floor(
        width / pixelsPerTick,
      ),
    );

    return xScale.ticks(numberOfTicksTarget)
      .map((value) => ({
        value,
        xOffset: xScale(value),
      }));
  }, [
    domain.join('-'),
    range.join('-'),
  ]);

  const generateTick = (value: Date) => {
    // console.log(domain[1].getTime() - domain[0].getTime(), 'time');

    if (Math.floor(domain[1].getTime()) - Math.floor(domain[0].getTime()) > 48 * 60 * 60 * 1000) return `${value.getMonth() + 1}/${value.getDate()}/${value.getFullYear()}`;
    return `${value.getMonth() + 1}/${value.getDate()} - ${value.getHours()}:${(value.getMinutes() < 10 ? '0' : '') + value.getMinutes()}`;
  };

  return (
    <svg>
      <path
        d={[
          'M', range[0], 15,
          'v', -15,
          'H', range[1],

        ].join(' ')}
        fill="none"
        stroke="black"
        strokeWidth={3}
      />
      {ticks.map(({ value, xOffset }) => (
        <g
          key={value.toTimeString()}
          transform={`translate(${xOffset}, 0)`}
        >
          <line
            y2="6"
            stroke="black"
            strokeWidth={2}
          />
          <text
            key={value.toTimeString()}
            style={{
              fontSize: '10px',
              textAnchor: 'middle',
              transform: 'translateY(20px)',
            }}
          >
            { generateTick(value)}
          </text>
        </g>
      ))}
    </svg>
  );
}
